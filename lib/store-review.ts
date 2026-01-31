import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEW_STATE_KEY = '@accord_review_state';

interface ReviewState {
  matchCount: number;
  lastPromptedAt: string | null;
  hasBeenPrompted: boolean;
}

async function getReviewState(): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { matchCount: 0, lastPromptedAt: null, hasBeenPrompted: false };
}

async function saveReviewState(state: ReviewState) {
  try {
    await AsyncStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * Call after a match celebration is dismissed.
 * Triggers the native store review dialog on the 2nd match,
 * then again after every 10th match, with a minimum 60-day gap.
 */
export async function maybeRequestReview() {
  try {
    const state = await getReviewState();
    state.matchCount += 1;

    const shouldPrompt =
      (!state.hasBeenPrompted && state.matchCount >= 2) ||
      (state.hasBeenPrompted && state.matchCount % 10 === 0);

    // Enforce 60-day cooldown
    if (shouldPrompt && state.lastPromptedAt) {
      const daysSince =
        (Date.now() - new Date(state.lastPromptedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSince < 60) {
        await saveReviewState(state);
        return;
      }
    }

    if (shouldPrompt && (await StoreReview.hasAction())) {
      // Small delay so the modal dismiss animation finishes
      setTimeout(async () => {
        try {
          await StoreReview.requestReview();
        } catch {}
      }, 800);
      state.hasBeenPrompted = true;
      state.lastPromptedAt = new Date().toISOString();
    }

    await saveReviewState(state);
  } catch {}
}
