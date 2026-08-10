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
   * Rewarded "watch an ad for +1 like" on the who-liked-you tab. Monetizes
   * non-paying users (esp. low-payment-rail geos) without a card. Reward is
   * exactly ONE like per completed ad view — maximizes ad impressions and keeps
   * "unlimited likes" premium clearly better than the free-with-ads path.
   *
   * STATUS 2026-08-10: the AdMob dependency, its config plugin, and lib/ads.ts
   * were REMOVED. Including the package broke the first native build it was ever
   * part of, on both platforms (Android: play-services-ads built with Kotlin
   * 2.3.0 vs the toolchain's 2.1.0; iOS: pod install fails on AppCheckCore /
   * GoogleUtilities modular headers). Recover lib/ads.ts and the App IDs from
   * commit 755b3bc when picking this up; expect to solve both native issues then.
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
