// Edge Function: moderate-photo
// Scans uploaded photos for NSFW content using AWS Rekognition
// Called after photo upload to detect and block explicit content

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AWS_ACCESS_KEY = Deno.env.get('AWS_ACCESS_KEY_ID');
const AWS_SECRET_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';

// Moderation thresholds
const NSFW_CONFIDENCE_THRESHOLD = 70; // Auto-reject if confidence > 70%
const AUTO_BAN_THRESHOLD = 90; // Auto-ban user if confidence > 90%

// Labels that indicate explicit/NSFW content
const EXPLICIT_LABELS = [
  'Explicit Nudity',
  'Nudity',
  'Graphic Male Nudity',
  'Graphic Female Nudity',
  'Sexual Activity',
  'Illustrated Explicit Nudity',
  'Adult Toys',
];

// Labels that need review (suggestive but not explicit)
const SUGGESTIVE_LABELS = [
  'Suggestive',
  'Female Swimwear Or Underwear',
  'Male Swimwear Or Underwear',
  'Partial Nudity',
  'Barechested Male',
  'Revealing Clothes',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate AWS credentials
    if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
      console.error('❌ AWS credentials not configured!');
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request body
    const { photo_url, photo_id, profile_id } = await req.json();

    if (!photo_url || !profile_id) {
      return new Response(
        JSON.stringify({ error: 'Missing photo_url or profile_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`🔍 Moderating photo for profile ${profile_id}`);
    console.log(`  - Photo URL: ${photo_url.substring(0, 100)}...`);

    // Download the photo
    const photoResponse = await fetch(photo_url);
    if (!photoResponse.ok) {
      throw new Error(`Failed to fetch photo: ${photoResponse.status}`);
    }

    const photoBuffer = await photoResponse.arrayBuffer();
    console.log(`  - Photo size: ${photoBuffer.byteLength} bytes`);

    // Convert to base64
    const photoBytes = new Uint8Array(photoBuffer);
    let photoBase64 = '';
    const chunkSize = 32768;
    for (let i = 0; i < photoBytes.length; i += chunkSize) {
      const chunk = photoBytes.subarray(i, Math.min(i + chunkSize, photoBytes.length));
      photoBase64 += String.fromCharCode.apply(null, chunk as any);
    }
    photoBase64 = btoa(photoBase64);

    // Call AWS Rekognition DetectModerationLabels
    console.log('🚀 Calling AWS Rekognition DetectModerationLabels...');
    const moderationResult = await callRekognition('DetectModerationLabels', {
      Image: { Bytes: photoBase64 },
      MinConfidence: 50, // Get all labels with 50%+ confidence
    });

    console.log('✅ Moderation result:', JSON.stringify(moderationResult));

    const labels = moderationResult.ModerationLabels || [];

    // Check for explicit content
    let isExplicit = false;
    let isSuggestive = false;
    let highestExplicitConfidence = 0;
    let flaggedLabels: string[] = [];

    for (const label of labels) {
      const labelName = label.Name || '';
      const confidence = label.Confidence || 0;

      if (EXPLICIT_LABELS.includes(labelName)) {
        if (confidence >= NSFW_CONFIDENCE_THRESHOLD) {
          isExplicit = true;
          flaggedLabels.push(`${labelName} (${Math.round(confidence)}%)`);
          if (confidence > highestExplicitConfidence) {
            highestExplicitConfidence = confidence;
          }
        }
      } else if (SUGGESTIVE_LABELS.includes(labelName)) {
        if (confidence >= NSFW_CONFIDENCE_THRESHOLD) {
          isSuggestive = true;
          flaggedLabels.push(`${labelName} (${Math.round(confidence)}%)`);
        }
      }
    }

    console.log(`📊 Moderation result:`);
    console.log(`  - Is explicit: ${isExplicit}`);
    console.log(`  - Is suggestive: ${isSuggestive}`);
    console.log(`  - Highest explicit confidence: ${highestExplicitConfidence}%`);
    console.log(`  - Flagged labels: ${flaggedLabels.join(', ')}`);

    // Take action based on results
    if (isExplicit) {
      console.log('🚨 EXPLICIT CONTENT DETECTED - Rejecting photo');

      // Update photo status to rejected
      if (photo_id) {
        await supabaseAdmin
          .from('photos')
          .update({
            moderation_status: 'rejected',
            moderation_reason: `Explicit content detected: ${flaggedLabels.join(', ')}`,
            moderated_at: new Date().toISOString(),
          })
          .eq('id', photo_id);
      }

      // Flag user's profile for review
      await supabaseAdmin
        .from('profiles')
        .update({
          photo_review_required: true,
        })
        .eq('id', profile_id);

      // Log moderation action
      await supabaseAdmin
        .from('moderation_logs')
        .insert({
          profile_id,
          action: 'photo_rejected',
          reason: `AWS Rekognition detected explicit content: ${flaggedLabels.join(', ')}`,
          details: {
            photo_url,
            photo_id,
            labels: moderationResult.ModerationLabels,
            highest_confidence: highestExplicitConfidence,
          },
        });

      // Auto-ban if very high confidence explicit content
      if (highestExplicitConfidence >= AUTO_BAN_THRESHOLD) {
        console.log('🚨🚨 AUTO-BAN TRIGGERED - Very high confidence NSFW');

        // Get user_id for ban
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('id', profile_id)
          .single();

        if (profile?.user_id) {
          // Check if already banned
          const { data: existingBan } = await supabaseAdmin
            .from('bans')
            .select('id')
            .eq('banned_profile_id', profile_id)
            .maybeSingle();

          if (!existingBan) {
            await supabaseAdmin
              .from('bans')
              .insert({
                banned_profile_id: profile_id,
                banned_user_id: profile.user_id,
                ban_reason: `Auto-ban: Explicit NSFW content detected with ${Math.round(highestExplicitConfidence)}% confidence. Labels: ${flaggedLabels.join(', ')}`,
                is_permanent: true,
                admin_notes: 'Automatic ban by AWS Rekognition moderation system',
              });

            // Set profile as incomplete to hide from discovery
            await supabaseAdmin
              .from('profiles')
              .update({ profile_complete: false })
              .eq('id', profile_id);

            console.log('✅ User auto-banned for explicit content');
          }
        }
      }

      return new Response(
        JSON.stringify({
          approved: false,
          reason: 'explicit_content',
          labels: flaggedLabels,
          auto_banned: highestExplicitConfidence >= AUTO_BAN_THRESHOLD,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (isSuggestive) {
      console.log('⚠️ Suggestive content detected - Flagging for review');

      // Update photo status to pending review
      if (photo_id) {
        await supabaseAdmin
          .from('photos')
          .update({
            moderation_status: 'pending',
            moderation_reason: `Suggestive content flagged for review: ${flaggedLabels.join(', ')}`,
          })
          .eq('id', photo_id);
      }

      return new Response(
        JSON.stringify({
          approved: false,
          reason: 'needs_review',
          labels: flaggedLabels,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Photo is clean - approve it
    console.log('✅ Photo approved - No NSFW content detected');

    if (photo_id) {
      await supabaseAdmin
        .from('photos')
        .update({
          moderation_status: 'approved',
          moderated_at: new Date().toISOString(),
        })
        .eq('id', photo_id);
    }

    return new Response(
      JSON.stringify({
        approved: true,
        labels: labels.map((l: any) => `${l.Name} (${Math.round(l.Confidence)}%)`),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in moderate-photo:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper function to call AWS Rekognition API with AWS Signature V4
async function callRekognition(action: string, params: any) {
  const endpoint = `https://rekognition.${AWS_REGION}.amazonaws.com/`;
  const body = JSON.stringify(params);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = await sha256(body);
  const headers: Record<string, string> = {
    'content-type': 'application/x-amz-json-1.1',
    'host': `rekognition.${AWS_REGION}.amazonaws.com`,
    'x-amz-date': amzDate,
    'x-amz-target': `RekognitionService.${action}`,
  };

  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const signedHeaders = Object.keys(headers).sort().join(';');

  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${AWS_REGION}/rekognition/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');

  const signingKey = await getSignatureKey(AWS_SECRET_KEY!, dateStamp, AWS_REGION, 'rekognition');
  const signature = await hmacSha256(signingKey, stringToSign);

  headers['authorization'] = `${algorithm} Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Rekognition API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<Uint8Array> {
  const kDate = await hmacSha256Bytes(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256Bytes(kDate, regionName);
  const kService = await hmacSha256Bytes(kRegion, serviceName);
  const kSigning = await hmacSha256Bytes(kService, 'aws4_request');
  return kSigning;
}

async function hmacSha256Bytes(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}
