import { useCallback, useRef } from 'react';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/safe-storage';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DraftEnvelope<T> {
  subStep: number;
  data: T;
  savedAt: number;
}

/**
 * Persists onboarding form data + sub-step to AsyncStorage so progress
 * survives auth-token refreshes and app restarts.
 *
 * Usage:
 *   const { loadDraft, saveDraft, clearDraft } = useOnboardingDraft<MyFormData>(userId, 'basic-info');
 *   // On mount (after DB load): const draft = await loadDraft();
 *   // On sub-step advance: await saveDraft(nextSubStep, formSnapshot);
 *   // After successful DB save: await clearDraft();
 */
export function useOnboardingDraft<T>(userId: string | undefined, screenName: string) {
  const keyRef = useRef(`onboarding_draft:${userId ?? 'anon'}:${screenName}`);

  // Update key if userId changes (unlikely during onboarding, but safe)
  keyRef.current = `onboarding_draft:${userId ?? 'anon'}:${screenName}`;

  const loadDraft = useCallback(async (): Promise<DraftEnvelope<T> | null> => {
    if (!userId) return null;
    const raw = await safeGetItem(keyRef.current);
    if (!raw) return null;

    try {
      const envelope: DraftEnvelope<T> = JSON.parse(raw);
      // Discard stale drafts
      if (Date.now() - envelope.savedAt > TTL_MS) {
        await safeRemoveItem(keyRef.current);
        return null;
      }
      return envelope;
    } catch {
      await safeRemoveItem(keyRef.current);
      return null;
    }
  }, [userId]);

  const saveDraft = useCallback(async (subStep: number, data: T): Promise<void> => {
    if (!userId) return;
    const envelope: DraftEnvelope<T> = { subStep, data, savedAt: Date.now() };
    await safeSetItem(keyRef.current, JSON.stringify(envelope));
  }, [userId]);

  const clearDraft = useCallback(async (): Promise<void> => {
    if (!userId) return;
    await safeRemoveItem(keyRef.current);
  }, [userId]);

  return { loadDraft, saveDraft, clearDraft };
}
