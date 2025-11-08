// Supabase Edge Function: reviews-get-profile
// Get review data for a profile (aggregate + detailed if matched)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
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

    // Get profile_id from query parameter
    const url = new URL(req.url);
    const profileId = url.searchParams.get('profile_id');

    if (!profileId) {
      throw new Error('profile_id is required');
    }

    // Get current user's profile ID
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!currentProfile) {
      throw new Error('Current user profile not found');
    }

    // Check if profiles are matched
    const { data: match } = await supabase
      .from('matches')
      .select('id')
      .or(
        `and(profile1_id.eq.${currentProfile.id},profile2_id.eq.${profileId}),and(profile1_id.eq.${profileId},profile2_id.eq.${currentProfile.id})`
      )
      .eq('status', 'active')
      .single();

    const hasMatched = !!match;

    // Get review settings for the profile
    const { data: settings } = await supabase
      .from('profile_review_settings')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    // If reviews are disabled, return early
    if (!settings || !settings.reviews_enabled) {
      return new Response(
        JSON.stringify({
          reviews_enabled: false,
          aggregate_score: null,
          review_count: 0,
          has_matched: hasMatched,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get aggregate data
    const { data: aggregate } = await supabase
      .from('profile_review_aggregates')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    // Check if minimum reviews threshold is met
    const reviewCount = aggregate?.review_count || 0;
    const meetsThreshold = reviewCount >= settings.minimum_reviews_threshold;

    // Build response
    const response: any = {
      reviews_enabled: true,
      aggregate_score: meetsThreshold && settings.show_aggregate_publicly ? aggregate?.aggregate_score : null,
      review_count: meetsThreshold ? reviewCount : 0,
      has_matched: hasMatched,
    };

    // Add detailed reviews if matched and settings allow
    if (hasMatched && settings.show_detailed_after_match && aggregate) {
      response.detailed_reviews = {
        category_averages: {
          communication_responsiveness: aggregate.avg_communication_responsiveness,
          honesty_authenticity: aggregate.avg_honesty_authenticity,
          respect_boundaries: aggregate.avg_respect_boundaries,
          compatibility_intent: aggregate.avg_compatibility_intent,
          reliability_followthrough: aggregate.avg_reliability_followthrough,
        },
      };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
