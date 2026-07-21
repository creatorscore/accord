/**
 * Lightweight client feature flags. Defaults are conservative (OFF) so a new
 * capability can ship inside a native build and be switched on later — flipping
 * a default here is OTA-shippable and needs no new store submission.
 *
 * NOTE: these are compile-time defaults, not remote config. When we need
 * per-region or percentage rollout, back these with a remote source (e.g. a
 * `feature_flags` row fetched at boot) without changing call sites.
 */
export const FeatureFlags = {
  /**
   * Rewarded "watch an ad for +N likes" on the who-liked-you tab. Monetizes
   * non-paying users (esp. low-payment-rail geos) without a card.
   *
   * Requires ALL of the following before it can be turned on:
   *  1. A native build that includes the AdMob module (react-native-google-mobile-ads).
   *  2. Real AdMob App IDs (app.config.js) + rewarded unit IDs (lib/ads.ts).
   *  3. Server-side bonus-like credit verified via AdMob SSV (NOT built yet —
   *     without it the reward is spoofable and the server trigger still caps likes).
   *  4. An iOS ATT / GDPR consent flow.
   * Keep OFF until 1–4 land.
   */
  REWARDED_LIKES_ENABLED: false,
} as const;
