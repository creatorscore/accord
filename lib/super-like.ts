import { supabase } from '@/lib/supabase';
import { purchasePackage } from '@/lib/revenue-cat';
import { trackUserAction } from '@/lib/analytics';

// Shared Lavender (super like) send + purchase plumbing.
//
// This mirrors the semantics of discover.tsx's handleSwipeUp (the canonical
// implementation) so new surfaces (Standouts) behave identically:
//  - premium members spend their 5/week allowance first, then purchased credits
//  - free members need purchased credits (profiles.super_like_credits)
//  - the enforce_like_limits / enforce_super_like_on_update triggers are the
//    real gatekeepers; server-side P0001 rejections are mapped to outcomes here
//  - credits are decremented server-side by the trigger, never by the client
// discover.tsx still carries its own inline copy — if you change behavior here,
// check handleSwipeUp too.

export const WEEKLY_SUPER_LIKE_LIMIT = 5;

export type SuperLikeOutcome =
  | {
      status: 'sent';
      usedWeeklyAllowance: boolean;
      weeklyRemaining: number;
      matched: boolean;
      matchId: string | null;
    }
  | { status: 'weekly_limit'; resetDay: number }
  | { status: 'premium_required' }
  | { status: 'match_limit' }
  | { status: 'photos_under_review' }
  | { status: 'server_rejected'; message: string }
  | { status: 'error' };

interface SendSuperLikeParams {
  currentProfileId: string;
  targetProfileId: string;
  targetCompatibilityScore?: number | null;
  isPremium: boolean;
  /** Current purchased-credit balance (profiles.super_like_credits). */
  superLikeCredits: number;
}

export async function sendSuperLike({
  currentProfileId,
  targetProfileId,
  targetCompatibilityScore,
  isPremium,
  superLikeCredits,
}: SendSuperLikeParams): Promise<SuperLikeOutcome> {
  try {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('super_likes_count, super_likes_reset_date')
      .eq('id', currentProfileId)
      .single();

    let usedWeeklyAllowance = false;
    let currentCount = profileData?.super_likes_count || 0;

    if (profileData && isPremium) {
      const resetDate = new Date(profileData.super_likes_reset_date);
      const now = new Date();
      const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceReset >= 7) {
        currentCount = 0;
        const { error: resetError } = await supabase
          .from('profiles')
          .update({ super_likes_count: 0, super_likes_reset_date: now.toISOString() })
          .eq('id', currentProfileId);
        if (resetError) console.error('Failed to reset super like count:', resetError);
      }

      if (currentCount < WEEKLY_SUPER_LIKE_LIMIT) {
        usedWeeklyAllowance = true;
      } else if (superLikeCredits <= 0) {
        return { status: 'weekly_limit', resetDay: (resetDate.getDay() + 7) % 7 };
      }
      // else: allowance exhausted but purchased credits cover it — proceed,
      // the like trigger consumes a credit server-side.
    }

    // Upgrade an existing standard like, otherwise insert a new super like.
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id, like_type')
      .eq('liker_profile_id', currentProfileId)
      .eq('liked_profile_id', targetProfileId)
      .maybeSingle();

    if (existingLike) {
      const { error: updateError } = await supabase
        .from('likes')
        .update({ like_type: 'super_like' })
        .eq('id', existingLike.id);
      if (updateError) throw updateError;
    } else {
      const { error: likeError } = await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: targetProfileId,
        like_type: 'super_like',
      });
      if (likeError) throw likeError;
    }

    trackUserAction.superLikeUsed(targetProfileId);

    const { error: superLikeCountError } = await supabase
      .from('profiles')
      .update({ super_likes_count: currentCount + 1 })
      .eq('id', currentProfileId);
    if (superLikeCountError) {
      console.error('Failed to update super like count:', superLikeCountError);
    }

    // Mutual like → match (SECURITY DEFINER RPC bypasses likes RLS).
    let matched = false;
    let matchId: string | null = null;
    const { data: mutualLikeId } = await supabase
      .rpc('check_mutual_like', { p_target_profile_id: targetProfileId });

    if (mutualLikeId) {
      const profile1Id = currentProfileId < targetProfileId ? currentProfileId : targetProfileId;
      const profile2Id = currentProfileId < targetProfileId ? targetProfileId : currentProfileId;

      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('profile1_id', profile1Id)
        .eq('profile2_id', profile2Id)
        .maybeSingle();

      if (existingMatch) {
        matched = true;
        matchId = existingMatch.id;
      } else {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .insert({
            profile1_id: profile1Id,
            profile2_id: profile2Id,
            initiated_by: currentProfileId,
            compatibility_score: targetCompatibilityScore ?? null,
            status: 'active',
          })
          .select('id')
          .single();

        if (matchError) {
          if (matchError.message?.includes('MATCH_LIMIT_REACHED')) {
            // The like still went through; only the match creation was blocked.
            return { status: 'match_limit' };
          }
          console.error('Match creation error:', matchError);
        } else {
          matched = true;
          matchId = matchData?.id || null;
        }
      }
      // Match notification is sent by the notify_on_match DB trigger.
    }

    return {
      status: 'sent',
      usedWeeklyAllowance,
      weeklyRemaining: usedWeeklyAllowance
        ? Math.max(0, WEEKLY_SUPER_LIKE_LIMIT - (currentCount + 1))
        : 0,
      matched,
      matchId,
    };
  } catch (error: any) {
    console.error('Error recording super like:', error);
    if (error?.code === 'P0001' && error?.message?.includes('Premium subscription')) {
      return { status: 'premium_required' };
    }
    if (error?.code === 'P0001' && error?.message?.includes('Weekly super like limit')) {
      return { status: 'weekly_limit', resetDay: 0 };
    }
    if (error?.code === 'P0001' && error?.message?.includes('approved photos')) {
      return { status: 'photos_under_review' };
    }
    if (error?.code === 'P0001' && error?.message) {
      return { status: 'server_rejected', message: error.message };
    }
    return { status: 'error' };
  }
}

export type PurchaseCreditsResult =
  | { status: 'granted'; credits: number }
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'failed' };

/**
 * Buy a Lavender pack, then poll profiles.super_like_credits until the
 * RevenueCat webhook lands the credits (usually 1-3s). The grant is
 * server-side only — polling the profile is the source of truth.
 */
export async function purchaseSuperLikeCredits(pkg: any, profileId: string): Promise<PurchaseCreditsResult> {
  try {
    const info = await purchasePackage(pkg);
    if (!info) return { status: 'cancelled' };
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      const { data } = await supabase
        .from('profiles')
        .select('super_like_credits')
        .eq('id', profileId)
        .maybeSingle();
      const credits = (data as any)?.super_like_credits || 0;
      if (credits > 0) return { status: 'granted', credits };
    }
    return { status: 'pending' };
  } catch (e) {
    console.error('Super-like purchase failed:', e);
    return { status: 'failed' };
  }
}
