/**
 * Anti-scam Phase 3 — off-platform / financial-scam signal detection.
 *
 * WHY CLIENT-SIDE: chat messages are end-to-end encrypted (see lib/encryption).
 * The server only ever stores ciphertext, so it CANNOT scan message content.
 * Detection therefore runs on-device, on plaintext, in two places:
 *   - sender side (before encrypt): a soft safety nudge, easily bypassed by a
 *     modified client — low trust, education only.
 *   - RECEIVER side (after decrypt): the un-bypassable path. A victim's honest
 *     client sees the plaintext, warns the victim, and reports the SENDER to the
 *     server with the CATEGORY ONLY (never the content — E2E is preserved). A
 *     scammer's tampered client can't stop the victim's client from reporting.
 *
 * PRODUCT CONSTRAINT: sharing contact info is deliberately allowed (see
 * containsContactInfo in content-moderation.ts — disabled on purpose, like
 * Hinge/Tinder/Bumble). So a bare "here's my instagram" is NOT high-risk. The
 * scam pattern we care about is FINANCIAL: crypto/investment solicitation,
 * money transfers, and pressure to move off-platform to run that play. We flag
 * that, not ordinary contact exchange, to keep false positives low.
 */

export type ScamCategory =
  | 'crypto_investment'   // crypto / trading / "guaranteed returns" — classic pig-butchering
  | 'money_transfer'      // send money / gift cards / wire / cashapp-me
  | 'off_platform_move';  // pushing to WhatsApp/Telegram/etc. — only high-risk WITH the above

export type ScamRisk = 'high' | 'medium';

export interface ScamSignal {
  categories: ScamCategory[];
  risk: ScamRisk;
  matched: string[]; // the phrases that tripped it (for logging/debug only — never sent to server)
}

// Word-boundary-ish matcher: case-insensitive, tolerant of surrounding punctuation.
// We avoid \b on either side of multi-word phrases so "whats app" style splits
// still catch, but keep it anchored enough to avoid substring false positives.
function makePattern(terms: string[]): RegExp {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?:^|[^a-z0-9])(?:${escaped.join('|')})(?:[^a-z0-9]|$)`, 'i');
}

// Crypto / investment solicitation — the highest-signal romance-scam category.
const CRYPTO_TERMS = [
  'crypto', 'cryptocurrency', 'bitcoin', 'btc', 'ethereum', 'eth',
  'usdt', 'tether', 'binance', 'coinbase', 'blockchain', 'altcoin',
  'forex', 'day trading', 'trading signals', 'trading account',
  'investment opportunity', 'guaranteed profit', 'guaranteed return',
  'guaranteed returns', 'passive income', 'roi', 'liquidity mining',
  'mining pool', 'crypto wallet', 'trust wallet', 'metamask',
];

// Broader "invest" terms that are only meaningful alongside a crypto/return cue.
const INVEST_SOFT = ['invest', 'investment', 'investing', 'portfolio', 'traders', 'trader'];
const RETURN_CUE = ['profit', 'returns', 'return', 'double your', 'guaranteed', 'daily', 'weekly', 'per day', 'per week'];

// Money-transfer solicitation.
const MONEY_TERMS = [
  'send money', 'send me money', 'wire transfer', 'western union',
  'moneygram', 'gift card', 'gift cards', 'itunes card', 'steam card',
  'google play card', 'cashapp me', 'cash app me', 'venmo me',
  'paypal me', 'zelle me', 'need money', 'lend me', 'loan me',
  'help me pay', 'pay my', 'bank transfer', 'iban', 'swift code',
];

// Off-platform move — allowed on its own, escalates when paired with money/crypto.
const OFF_PLATFORM_TERMS = [
  'whatsapp', 'whats app', 'telegram', 'signal app', 'wechat', 'kik',
  'hangouts', 'google chat', 'move to', 'move this to', 'chat on',
  'text me on', 'text me at', 'add me on', 'reach me on', 'contact me on',
  'lets talk on', "let's talk on", 'continue on',
];

const CRYPTO_RE = makePattern(CRYPTO_TERMS);
const INVEST_RE = makePattern(INVEST_SOFT);
const RETURN_RE = makePattern(RETURN_CUE);
const MONEY_RE = makePattern(MONEY_TERMS);
const OFF_PLATFORM_RE = makePattern(OFF_PLATFORM_TERMS);

function collect(text: string, re: RegExp, terms: string[]): string[] {
  if (!re.test(text)) return [];
  const lower = text.toLowerCase();
  return terms.filter((t) => lower.includes(t.toLowerCase()));
}

/**
 * Analyze a single plaintext message. Returns null when nothing trips.
 *
 * Risk model (false-positive-conscious):
 *  - crypto/investment or money-transfer  -> HIGH (report + warn)
 *  - off-platform move ALONE              -> MEDIUM (warn only; contact sharing is allowed)
 *  - off-platform move + crypto/money     -> HIGH
 */
export function detectScamSignals(text: string): ScamSignal | null {
  if (!text || text.trim().length < 3) return null;

  const categories: ScamCategory[] = [];
  const matched: string[] = [];

  const cryptoHits = collect(text, CRYPTO_RE, CRYPTO_TERMS);
  // "invest" only counts with a returns cue, so "I invest in my community" is ignored.
  const softInvest = INVEST_RE.test(text) && RETURN_RE.test(text)
    ? collect(text, INVEST_RE, INVEST_SOFT)
    : [];
  if (cryptoHits.length || softInvest.length) {
    categories.push('crypto_investment');
    matched.push(...cryptoHits, ...softInvest);
  }

  const moneyHits = collect(text, MONEY_RE, MONEY_TERMS);
  if (moneyHits.length) {
    categories.push('money_transfer');
    matched.push(...moneyHits);
  }

  const offHits = collect(text, OFF_PLATFORM_RE, OFF_PLATFORM_TERMS);
  if (offHits.length) {
    categories.push('off_platform_move');
    matched.push(...offHits);
  }

  if (categories.length === 0) return null;

  const hasFinancial =
    categories.includes('crypto_investment') || categories.includes('money_transfer');
  // Off-platform alone is medium (allowed behavior); financial signals are high.
  const risk: ScamRisk = hasFinancial ? 'high' : 'medium';

  return { categories, risk, matched };
}

/** Convenience: should the RECEIVER's client report this sender to the server? */
export function shouldReportSender(signal: ScamSignal | null): boolean {
  return !!signal && signal.risk === 'high';
}
