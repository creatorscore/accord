import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Backfill Blur Thumbnails
 *
 * Generates blur_data_uri for existing photos that don't have one.
 * Uses Supabase Storage image transforms to resize server-side,
 * then stores the result as a base64 data URI (~300-500 bytes per photo).
 *
 * Input: { batch_size?: number, offset?: number }
 * Output: { processed: number, remaining: number, errors: number }
 *
 * Run repeatedly until remaining === 0.
 * Requires service role key (admin only).
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the requesting user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || 20, 50); // Cap at 50
    const offset = body.offset || 0;

    // Get photos without blur_data_uri
    const { data: photos, error: fetchError } = await supabaseAdmin
      .from('photos')
      .select('id, url, storage_path')
      .is('blur_data_uri', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch photos', details: fetchError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Count total remaining
    const { count: remaining } = await supabaseAdmin
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .is('blur_data_uri', null);

    if (!photos || photos.length === 0) {
      return new Response(JSON.stringify({ processed: 0, remaining: 0, errors: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let processed = 0;
    let errors = 0;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    for (const photo of photos) {
      try {
        // Use signed URL with transform params for private bucket access
        const storagePath = photo.storage_path || photo.url;
        const { data: signedData, error: signError } = await supabaseAdmin.storage
          .from('profile-photos')
          .createSignedUrl(storagePath, 600, {
            transform: { width: 20, quality: 50 },
          });

        if (signError || !signedData?.signedUrl) {
          console.error(`[Backfill] Failed to sign URL for photo ${photo.id}:`, signError);
          errors++;
          continue;
        }

        const response = await fetch(signedData.signedUrl);

        if (!response.ok) {
          // If transform API fails, try fetching original and skip
          console.error(`[Backfill] Transform failed for photo ${photo.id}: ${response.status}`);
          errors++;
          continue;
        }

        const imageBuffer = await response.arrayBuffer();
        const base64 = base64Encode(new Uint8Array(imageBuffer));
        const dataUri = `data:image/jpeg;base64,${base64}`;

        // Update the photo record
        const { error: updateError } = await supabaseAdmin
          .from('photos')
          .update({ blur_data_uri: dataUri })
          .eq('id', photo.id);

        if (updateError) {
          console.error(`[Backfill] Update failed for photo ${photo.id}:`, updateError);
          errors++;
        } else {
          processed++;
        }
      } catch (err) {
        console.error(`[Backfill] Error processing photo ${photo.id}:`, err);
        errors++;
      }
    }

    console.log(`[Backfill] Processed: ${processed}, Errors: ${errors}, Remaining: ${(remaining || 0) - processed}`);

    return new Response(JSON.stringify({
      processed,
      remaining: Math.max(0, (remaining || 0) - processed),
      errors,
      batch_size: batchSize,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Backfill] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
