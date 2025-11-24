// Supabase Edge Function: reviews-submit
// Submit a review for a matched profile

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewRatings {
  communication_responsiveness: number;
  honesty_authenticity: number;
  respect_boundaries: number;
  compatibility_intent: number;
  reliability_followthrough: number;
}

interface SubmitReviewPayload {
  match_id: string;
  reviewer_id: string;
  reviewee_id: string;
  ratings: ReviewRatings;
  feedback_text?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with user's token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // Parse request body
    const payload: SubmitReviewPayload = await req.json();
    const { match_id, reviewer_id, reviewee_id, ratings, feedback_text } = payload;

    // Validate payload
    if (!match_id || !reviewer_id || !reviewee_id || !ratings) {
      throw new Error('Missing required fields');
    }

    // Verify reviewer owns this profile
    const { data: reviewerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', reviewer_id)
      .eq('user_id', user.id)
      .single();

    if (!reviewerProfile) {
      throw new Error('Unauthorized: You can only submit reviews from your own profile');
    }

    // Verify match exists and is active
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', match_id)
      .eq('status', 'active')
      .single();

    if (matchError || !match) {
      throw new Error('Match not found or inactive');
    }

    // Verify reviewer and reviewee are part of this match
    const isValidMatch =
      (match.profile1_id === reviewer_id && match.profile2_id === reviewee_id) ||
      (match.profile2_id === reviewer_id && match.profile1_id === reviewee_id);

    if (!isValidMatch) {
      throw new Error('Invalid match configuration');
    }

    // Check if review already exists
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('match_id', match_id)
      .eq('reviewer_id', reviewer_id)
      .eq('reviewee_id', reviewee_id)
      .single();

    if (existingReview) {
      throw new Error('You have already reviewed this person');
    }

    // Check if reviewee allows new reviews
    const { data: revieweeSettings } = await supabase
      .from('profile_review_settings')
      .select('allow_new_reviews')
      .eq('profile_id', reviewee_id)
      .single();

    if (revieweeSettings && !revieweeSettings.allow_new_reviews) {
      throw new Error('This person is not accepting new reviews');
    }

    // Get or create review prompt (Airbnb-style: 3-day window after 7-day trigger)
    let reviewPrompt;
    const { data: existingPrompt } = await supabase
      .from('review_prompts')
      .select('*')
      .eq('match_id', match_id)
      .single();

    if (existingPrompt) {
      reviewPrompt = existingPrompt;

      // Check if review period has started (7 days after match)
      const triggerDate = new Date(reviewPrompt.trigger_date);
      if (triggerDate > new Date()) {
        const daysRemaining = Math.ceil((triggerDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        throw new Error(`You can submit a review ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} after matching.`);
      }

      // Check if window has expired
      const expiresAt = new Date(reviewPrompt.window_expires_at);
      if (expiresAt < new Date()) {
        throw new Error('Review window has expired. Reviews were auto-revealed after 3 days.');
      }
    } else {
      // Create new review prompt
      // Trigger date is 7 days after match (users must wait 7 days before reviewing)
      const triggerDate = new Date(match.matched_at);
      triggerDate.setDate(triggerDate.getDate() + 7);

      // Check if 7 days have passed since match
      if (triggerDate > new Date()) {
        const daysRemaining = Math.ceil((triggerDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        throw new Error(`You can submit a review ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} after matching.`);
      }

      // Window expires 3 days after trigger (total 10 days after match)
      const expiresAt = new Date(triggerDate);
      expiresAt.setDate(expiresAt.getDate() + 3);

      const { data: newPrompt, error: promptError } = await supabase
        .from('review_prompts')
        .insert({
          match_id,
          profile1_id: match.profile1_id,
          profile2_id: match.profile2_id,
          trigger_date: triggerDate.toISOString(),
          window_expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (promptError) {
        throw new Error(`Failed to create review prompt: ${promptError.message}`);
      }

      reviewPrompt = newPrompt;
    }

    // Calculate overall rating
    const ratingsArray = Object.values(ratings);
    const overallRating = ratingsArray.reduce((sum, val) => sum + val, 0) / ratingsArray.length;

    // Insert review
    const { data: newReview, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        match_id,
        reviewer_id,
        reviewee_id: reviewee_id,
        overall_rating: overallRating,
        communication_responsiveness: ratings.communication_responsiveness,
        honesty_authenticity: ratings.honesty_authenticity,
        respect_boundaries: ratings.respect_boundaries,
        compatibility_intent: ratings.compatibility_intent,
        reliability_followthrough: ratings.reliability_followthrough,
        feedback_text: feedback_text || null,
        is_revealed: false,
        review_window_expires_at: reviewPrompt.window_expires_at,
      })
      .select()
      .single();

    if (reviewError) {
      throw new Error(`Failed to submit review: ${reviewError.message}`);
    }

    // Update review prompt submission status
    const updateData: any = {};
    if (reviewer_id === reviewPrompt.profile1_id) {
      updateData.profile1_reviewed = true;
      updateData.profile1_notified = true; // Mark as notified since they just submitted
    } else {
      updateData.profile2_reviewed = true;
      updateData.profile2_notified = true;
    }

    const { data: updatedPrompt } = await supabase
      .from('review_prompts')
      .update(updateData)
      .eq('id', reviewPrompt.id)
      .select()
      .single();

    // Check if both parties have now submitted
    const bothSubmitted =
      (updatedPrompt.profile1_reviewed && updatedPrompt.profile2_reviewed) ||
      (reviewPrompt.profile1_reviewed && reviewPrompt.profile2_reviewed);

    let revealed = false;

    if (bothSubmitted) {
      // Reveal all reviews for this match
      await supabase
        .from('reviews')
        .update({
          is_revealed: true,
          revealed_at: new Date().toISOString(),
        })
        .eq('match_id', match_id);

      // Update prompt status
      await supabase
        .from('review_prompts')
        .update({
          reviews_revealed: true,
        })
        .eq('id', reviewPrompt.id);

      revealed = true;

      // Recalculate aggregates for both profiles (using service role)
      const supabaseService = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseService.rpc('calculate_review_aggregates', {
        target_profile_id: reviewee_id,
      });

      await supabaseService.rpc('calculate_review_aggregates', {
        target_profile_id: reviewer_id,
      });

      // Send notification to both parties that reviews are revealed
      // (This would integrate with your notification system)
    }

    return new Response(
      JSON.stringify({
        success: true,
        review_id: newReview.id,
        revealed,
        message: revealed
          ? 'Review submitted and revealed! Both parties have reviewed.'
          : 'Review submitted! It will be revealed when the other party reviews or after the window expires.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
