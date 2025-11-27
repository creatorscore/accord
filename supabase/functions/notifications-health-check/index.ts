import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get total profile count
    const { count: totalProfiles, error: countError } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Get profiles with push tokens
    const { data: withTokens, error: tokenError } = await supabaseClient
      .from('profiles')
      .select('id, push_token, push_enabled')
      .not('push_token', 'is', null);

    if (tokenError) throw tokenError;

    // Get profiles without push tokens
    const { data: withoutTokens, error: noTokenError } = await supabaseClient
      .from('profiles')
      .select('id, display_name, created_at')
      .is('push_token', null)
      .order('created_at', { ascending: false });

    if (noTokenError) throw noTokenError;

    const stats = {
      totalProfiles: totalProfiles || 0,
      profilesWithToken: withTokens?.length || 0,
      profilesWithoutToken: withoutTokens?.length || 0,
      percentageWithToken: totalProfiles
        ? Math.round(((withTokens?.length || 0) / totalProfiles) * 100 * 100) / 100
        : 0,
      profilesWithTokenEnabled: withTokens?.filter(p => p.push_enabled).length || 0,
    };

    const response = {
      success: true,
      stats,
      message: `${stats.percentageWithToken}% of users have push tokens registered`,
      recommendation: stats.percentageWithToken < 90
        ? '⚠️  Low token registration rate. Users need to open the app for tokens to be registered. The new retry mechanism will automatically register tokens when users next open the app.'
        : '✅ Good token registration rate',
      profilesWithoutTokens: withoutTokens?.slice(0, 10).map(p => ({
        id: p.id,
        displayName: p.display_name,
        createdAt: p.created_at,
      })),
    };

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error in notifications health check:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
