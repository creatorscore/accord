// Edge Function: photo-verification-start
// Verifies user's selfie matches their profile photos using AWS Rekognition
// FREE feature - available to all users

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AWS_ACCESS_KEY = Deno.env.get('AWS_ACCESS_KEY_ID');
const AWS_SECRET_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get request body with selfie image
    const { selfie_base64 } = await req.json();
    if (!selfie_base64) {
      return new Response(
        JSON.stringify({ error: 'Missing selfie image' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, photo_verified, photo_verification_status, photo_verification_attempts')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if already verified
    if (profile.photo_verified) {
      return new Response(
        JSON.stringify({ error: 'Already verified', message: 'Your photos are already verified.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Rate limiting: Max 5 attempts
    if (profile.photo_verification_attempts >= 5) {
      return new Response(
        JSON.stringify({
          error: 'Too many attempts',
          message: 'You have exceeded the maximum number of verification attempts (5). Please contact support.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Update verification status to pending
    await supabase
      .from('profiles')
      .update({
        photo_verification_status: 'pending',
        photo_verification_started_at: new Date().toISOString(),
        photo_verification_attempts: (profile.photo_verification_attempts || 0) + 1
      })
      .eq('id', profile.id);

    // Get user's profile photos
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('url, storage_path')
      .eq('profile_id', profile.id)
      .eq('moderation_status', 'approved')
      .order('is_primary', { ascending: false })
      .limit(3); // Compare against top 3 photos

    if (photosError || !photos || photos.length === 0) {
      await supabase
        .from('profiles')
        .update({ photo_verification_status: 'failed' })
        .eq('id', profile.id);

      return new Response(
        JSON.stringify({
          error: 'No photos to compare',
          message: 'You need to upload profile photos before verifying.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Step 1: Detect face in selfie and check liveness indicators
    console.log('🔍 Step 1: Detecting face in selfie...');
    const selfieBytes = Uint8Array.from(atob(selfie_base64), c => c.charCodeAt(0));

    const detectFacesResult = await callRekognition('DetectFaces', {
      Image: { Bytes: selfieBytes },
      Attributes: ['ALL']
    });

    if (!detectFacesResult.FaceDetails || detectFacesResult.FaceDetails.length === 0) {
      await supabase
        .from('profiles')
        .update({ photo_verification_status: 'failed' })
        .eq('id', profile.id);

      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          message: 'No face detected in selfie. Please take a clear photo of your face.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (detectFacesResult.FaceDetails.length > 1) {
      await supabase
        .from('profiles')
        .update({ photo_verification_status: 'failed' })
        .eq('id', profile.id);

      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          message: 'Multiple faces detected. Please take a selfie with only your face visible.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const faceDetails = detectFacesResult.FaceDetails[0];
    console.log('✅ Face detected. Quality:', faceDetails.Quality);

    // Check face quality
    if (faceDetails.Quality.Brightness < 40 || faceDetails.Quality.Sharpness < 40) {
      await supabase
        .from('profiles')
        .update({ photo_verification_status: 'failed' })
        .eq('id', profile.id);

      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          message: 'Image quality too low. Please take a well-lit, clear selfie.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Step 2: Compare selfie against profile photos
    console.log('🔍 Step 2: Comparing selfie to profile photos...');
    let highestSimilarity = 0;
    let matchedPhotoUrl = '';

    for (const photo of photos) {
      try {
        // Download profile photo
        const photoResponse = await fetch(photo.url);
        const photoBuffer = await photoResponse.arrayBuffer();
        const photoBytes = new Uint8Array(photoBuffer);

        // Compare faces
        const compareResult = await callRekognition('CompareFaces', {
          SourceImage: { Bytes: selfieBytes },
          TargetImage: { Bytes: photoBytes },
          SimilarityThreshold: 80
        });

        if (compareResult.FaceMatches && compareResult.FaceMatches.length > 0) {
          const similarity = compareResult.FaceMatches[0].Similarity;
          console.log(`✅ Match found! Similarity: ${similarity}%`);

          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            matchedPhotoUrl = photo.url;
          }
        }
      } catch (error) {
        console.error('Error comparing with photo:', photo.url, error);
      }
    }

    // Step 3: Determine verification result
    const VERIFICATION_THRESHOLD = 85; // 85% similarity required
    const isVerified = highestSimilarity >= VERIFICATION_THRESHOLD;

    console.log(`📊 Highest similarity: ${highestSimilarity}%`);
    console.log(`✅ Verified: ${isVerified}`);

    // Update profile with result
    await supabase
      .from('profiles')
      .update({
        photo_verified: isVerified,
        photo_verification_status: isVerified ? 'verified' : 'failed',
        photo_verification_completed_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    // Send notification
    await supabase.from('notification_queue').insert({
      recipient_profile_id: profile.id,
      notification_type: isVerified ? 'photo_verification_success' : 'photo_verification_failed',
      title: isVerified ? 'Photos Verified! ✓' : 'Verification Unsuccessful',
      body: isVerified
        ? 'Your photos have been verified. Your profile now shows a verified badge!'
        : 'We couldn\'t verify your photos. Please try again with a clear selfie that matches your profile pictures.',
      data: {
        type: 'photo_verification_update',
        verified: isVerified,
        similarity: highestSimilarity
      },
      status: 'pending'
    });

    return new Response(
      JSON.stringify({
        success: true,
        verified: isVerified,
        similarity: Math.round(highestSimilarity),
        message: isVerified
          ? `Photos verified! Match confidence: ${Math.round(highestSimilarity)}%`
          : `Verification failed. Match confidence too low: ${Math.round(highestSimilarity)}% (need 85%+)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in photo-verification-start:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to verify photos',
        details: error.toString()
      }),
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

  // Create canonical request
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

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${AWS_REGION}/rekognition/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');

  // Calculate signature
  const signingKey = await getSignatureKey(AWS_SECRET_KEY!, dateStamp, AWS_REGION, 'rekognition');
  const signature = await hmacSha256(signingKey, stringToSign);

  // Add authorization header
  headers['authorization'] = `${algorithm} Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Rekognition API error:', errorText);
    throw new Error(`Rekognition API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// AWS Signature V4 helper functions
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
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
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}
