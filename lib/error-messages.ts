/**
 * User-facing error copy.
 *
 * Supabase/PostgREST errors arrive with raw Postgres text attached, and for a
 * long time we passed that straight to the user via `error.message || fallback`.
 * Because the raw string is almost never empty, the fallback effectively never
 * ran and people saw things like:
 *
 *   "value too long for type character varying(50)"
 *   "permission denied for table likes"
 *   "duplicate key value violates unique constraint \"likes_liker_..._key\""
 *   "failed to parse logic tree ((display_name.ilike.%,%,...))"
 *
 * That is what an App Store reviewer meant by "built with vibe code" — the app
 * looks broken even when the underlying state is recoverable and ordinary
 * (an expired session, a double-tap, a too-long name).
 *
 * `toUserMessage` is the single boundary: give it any thrown value and a
 * fallback, and it returns something safe to show a human. It deliberately
 * preserves messages we wrote *for* users (see P0001 below) so this doesn't
 * flatten intentional product copy into a generic string.
 */

/**
 * SQLSTATE / PostgREST codes mapped to copy a user can act on.
 *
 * P0001 is intentionally absent: it's `RAISE EXCEPTION` from our own
 * triggers/RPCs, where the message is already written for the user
 * (e.g. the anti-scam distance gate). Those pass through untouched.
 */
const CODE_MESSAGES: Record<string, string> = {
  // string_data_right_truncation — a value exceeded a varchar(n) column
  '22001': 'One of your entries was too long. Please shorten it and try again.',
  // unique_violation — usually a double-tap or an already-saved row
  '23505': 'That’s already saved.',
  // foreign_key_violation
  '23503': 'Something referenced here is no longer available. Please refresh and try again.',
  // check_violation
  '23514': 'Some of your details couldn’t be saved. Please review them and try again.',
  // not_null_violation
  '23502': 'Something required is missing. Please fill in the remaining fields.',
  // invalid_text_representation
  '22P02': 'Something in that entry wasn’t in the expected format. Please check and try again.',
  // insufficient_privilege — in practice this is an expired/anonymous session,
  // because `anon` lacks the grants that `authenticated` has.
  '42501': 'Your session expired. Please sign in again.',
  // query_canceled — our statement_timeout
  '57014': 'That took longer than expected. Please try again.',
  // connection failures
  '08006': 'We couldn’t reach the server. Please check your connection and try again.',
  '08003': 'We couldn’t reach the server. Please check your connection and try again.',
  // PostgREST: JWT invalid / expired
  PGRST301: 'Your session expired. Please sign in again.',
  PGRST303: 'Your session expired. Please sign in again.',
  // PostgREST: no rows when one was required
  PGRST116: 'We couldn’t find that. It may have been removed.',
  // Our own client-side timeout race marker
  TIMEOUT: 'That took longer than expected. Please try again.',
};

/**
 * Text that betrays database/transport internals. If a message matches any of
 * these it is never shown to a user, regardless of code.
 */
const INTERNAL_PATTERNS: RegExp[] = [
  /value too long for type/i,
  /violates (check|foreign key|unique|not-null|row-level security) constraint/i,
  /duplicate key value/i,
  /permission denied for (table|relation|schema|function|sequence)/i,
  /(column|relation|table|function|operator) .* does not exist/i,
  /failed to parse (logic tree|filter|order)/i,
  /invalid input syntax for/i,
  /null value in column/i,
  /(canceling statement|statement timeout)/i,
  /could not serialize access/i,
  /syntax error at or near/i,
  /deadlock detected/i,
  /JWSError|JWTIssuedAtFuture|jwt (expired|malformed|invalid)/i,
  /^PGRST\d*/i,
  /row-level security policy/i,
  /infinite recursion detected/i,
  /^\s*\{.*\}\s*$/, // a JSON blob leaked as a message
  /at .+:\d+:\d+/, // a stack frame leaked as a message
];

/** Network/offline conditions, which deserve their own copy. */
const NETWORK_PATTERNS: RegExp[] = [
  /network request (failed|timed out)/i,
  /failed to fetch/i,
  /request timed out/i,
  /the internet connection appears to be offline/i,
  /connection (refused|reset|aborted)/i,
];

const NETWORK_MESSAGE =
  'We couldn’t reach the server. Please check your connection and try again.';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

function readCode(error: any): string | undefined {
  const code = error?.code ?? error?.error?.code ?? error?.details?.code;
  return code == null ? undefined : String(code);
}

function readMessage(error: any): string {
  if (typeof error === 'string') return error;
  const raw =
    error?.message ??
    error?.error_description ??
    error?.error?.message ??
    error?.details ??
    '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Convert any thrown value into copy that is safe to show a user.
 *
 * @param error    The caught value (Supabase error, Error, string, anything).
 * @param fallback Screen-specific copy, e.g. t('toast.profileSaveError').
 *                 Used when we have nothing better and nothing safe.
 *
 * Resolution order:
 *   1. P0001 — our own RAISE EXCEPTION copy, already written for users.
 *   2. A known SQLSTATE/PostgREST code.
 *   3. Network/offline detection.
 *   4. Anything matching an internal pattern is suppressed to `fallback`.
 *   5. Otherwise the message itself (auth errors like "Invalid login
 *      credentials" are genuinely useful and read fine).
 */
export function toUserMessage(error: any, fallback?: string): string {
  const safeFallback = fallback?.trim() || GENERIC_MESSAGE;
  if (error == null) return safeFallback;

  const code = readCode(error);
  const message = readMessage(error);

  // 1. Deliberate, user-facing messages raised by our own triggers/RPCs.
  if (code === 'P0001' && message) return message;

  // 2. Known codes win over free text — the text is usually the raw jargon.
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  if (!message) return safeFallback;

  // 3. Offline/transport.
  if (NETWORK_PATTERNS.some((re) => re.test(message))) return NETWORK_MESSAGE;

  // 4. Never leak internals.
  if (INTERNAL_PATTERNS.some((re) => re.test(message))) return safeFallback;

  // 5. Plain-language messages (Supabase Auth, our own thrown Errors).
  return message;
}

/**
 * True when the error means "the session is gone" — callers may want to route
 * to sign-in rather than just toast. Kept here so the detection logic lives in
 * one place alongside the copy.
 */
export function isAuthExpiredError(error: any): boolean {
  const code = readCode(error);
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST303') return true;
  const message = readMessage(error);
  return /jwt (expired|invalid|malformed)|permission denied for (table|relation)/i.test(
    message,
  );
}
