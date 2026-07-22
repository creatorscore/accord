import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

// Real rewarded ad unit IDs, per platform. Filled in from AdMob once the
// account exists. Until then every build falls back to Google's PUBLIC TEST
// unit (TestIds.REWARDED) so we never accidentally serve — or click — real
// inventory during development (an AdMob policy strike risk).
const REWARDED_UNIT_IDS: { ios?: string; android?: string } = {
  android: 'ca-app-pub-4165784296968148/3311792681', // Accord Rewarded – Likes (Android)
  ios: 'ca-app-pub-4165784296968148/8083742794',     // Accord Rewarded – Likes (iOS)
};

function rewardedUnitId(): string {
  if (__DEV__) return TestIds.REWARDED;
  const id = Platform.select(REWARDED_UNIT_IDS);
  return id || TestIds.REWARDED; // no real unit wired yet → stay on test inventory
}

let initialized = false;

/**
 * Initialize the Mobile Ads SDK. Safe to call more than once (no-ops after the
 * first success). Call it once at app startup, AFTER any ATT/consent gate.
 * Never blocks app boot — ads are supplementary.
 */
export async function initializeAds(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    // Family-safe: Accord is an LGBTQ+ safety app — never serve mature ad content.
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
  } catch (e) {
    console.warn('[ads] initialize failed', e);
    initialized = false; // allow a later retry
  }
}

/**
 * Rewarded-ad hook. Preloads a rewarded ad and exposes `showAd()`, which
 * resolves `true` only if the user earned the reward (watched to completion),
 * and `false` otherwise (dismissed early, failed to load, or errored). It
 * auto-reloads after each show so the next ad is ready.
 *
 * ⚠️ Earning the reward client-side is NOT proof for crediting anything of
 * value — a determined user can spoof `EARNED_REWARD`. The actual like credit
 * MUST be granted by the server after verifying the reward via AdMob
 * Server-Side Verification (SSV). This hook only tells the UI whether to
 * *attempt* the credit; the server is the source of truth. See the consuming
 * call site's TODO.
 */
export function useRewardedAd(enabled: boolean = true) {
  const [ready, setReady] = useState(false);
  const adRef = useRef<RewardedAd | null>(null);
  const earnedRef = useRef(false);

  const load = useCallback(() => {
    const ad = RewardedAd.createForAdRequest(rewardedUnitId(), {
      // Safe default until a real consent flow decides personalization.
      requestNonPersonalizedAdsOnly: true,
    });
    earnedRef.current = false;
    adRef.current = ad;

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => setReady(true));
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earnedRef.current = true;
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (err) => {
      console.warn('[ads] rewarded load error', err);
      setReady(false);
    });

    ad.load();

    return () => {
      unsubLoaded();
      unsubEarned();
      unsubError();
    };
  }, []);

  useEffect(() => {
    // The premium guarantee lives here: when disabled we never create, load, or
    // show an ad. Callers pass
    //   enabled = !isPremium && !isPlatinum && FeatureFlags.REWARDED_LIKES_ENABLED
    // so premium/platinum users (and the flag-off state) never even preload one.
    if (!enabled) return;
    const cleanup = load();
    return cleanup;
  }, [enabled, load]);

  const showAd = useCallback((): Promise<boolean> => {
    const ad = adRef.current;
    if (!enabled || !ad || !ready) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        unsubClosed();
        const earned = earnedRef.current;
        setReady(false);
        load(); // preload the next ad
        resolve(earned);
      });
      try {
        ad.show();
      } catch (e) {
        console.warn('[ads] rewarded show failed', e);
        unsubClosed();
        resolve(false);
      }
    });
  }, [enabled, ready, load]);

  return { ready: enabled && ready, showAd };
}
