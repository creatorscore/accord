import { supabase } from './supabase';
import { isAuthExpiredError } from './error-messages';

/**
 * Recover from an expired Supabase session.
 *
 * When the access token expires and the client hasn't refreshed yet, requests
 * go out as the `anon` role. `anon` holds only SELECT on most tables, so an
 * insert comes back as `42501 permission denied for table likes` — which is
 * why that string appeared in Sentry with no user id attached. Nothing is
 * broken: the grants are correct and the RLS policies are correct. The session
 * is simply gone.
 *
 * Before this, the user tapped like, got told something was denied, and had no
 * way forward. A refresh usually succeeds silently because the refresh token
 * outlives the access token.
 *
 * Returns true when a valid session is in place afterwards.
 */
export async function recoverSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session) return true;
  } catch {
    // fall through — treat any throw as "could not recover"
  }
  // refreshSession can fail transiently while a valid session already exists
  // (e.g. two refreshes racing), so check before giving up.
  try {
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  } catch {
    return false;
  }
}

/**
 * Run a Supabase operation, and if it fails purely because the session lapsed,
 * refresh once and run it again.
 *
 * `op` should return the usual `{ error }` shape. The retry happens at most
 * once, so a genuinely revoked session surfaces its error to the caller rather
 * than looping.
 */
// `op` is typed PromiseLike, not Promise: Supabase's query builder is a
// thenable that only becomes a real Promise once awaited, so requiring
// Promise here would reject `() => supabase.from(...).insert(...)`.
export async function withSessionRetry<T extends { error: any }>(
  op: () => PromiseLike<T>,
): Promise<T> {
  const first = await op();
  if (!first?.error || !isAuthExpiredError(first.error)) return first;

  const recovered = await recoverSession();
  if (!recovered) return first;

  return op();
}
