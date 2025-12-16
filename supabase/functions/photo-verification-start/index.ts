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

// Log AWS config status at startup (redacted for security)
console.log('🔧 AWS Config Check:');
console.log('  - AWS_ACCESS_KEY_ID:', AWS_ACCESS_KEY ? `SET (${AWS_ACCESS_KEY.substring(0, 4)}...)` : 'NOT SET');
console.log('  - AWS_SECRET_ACCESS_KEY:', AWS_SECRET_KEY ? 'SET (hidden)' : 'NOT SET');
console.log('  - AWS_REGION:', AWS_REGION);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate AWS credentials first
    if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
      console.error('❌ AWS credentials not configured!');
      return new Response(
        JSON.stringify({
          error: 'AWS credentials not configured',
          details: 'Contact support - AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
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
          message: 'You have exceeded the maximum number of verification attempts (5). Please contact support at hello@joinaccord.app to reset your attempts.'
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
    console.log('  - Base64 length:', selfie_base64.length);

    // Validate base64 is decodable
    try {
      const decoded = atob(selfie_base64);
      console.log('  - Decoded bytes:', decoded.length);
    } catch (decodeError) {
      console.error('❌ Failed to decode base64:', decodeError);
      return new Response(
        JSON.stringify({
          error: 'Invalid image format',
          message: 'Failed to decode selfie image. Please try again.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // AWS Rekognition expects base64 string for Bytes, not raw Uint8Array
    console.log('🚀 Calling AWS Rekognition DetectFaces...');
    let detectFacesResult;
    try {
      detectFacesResult = await callRekognition('DetectFaces', {
        Image: { Bytes: selfie_base64 },
        Attributes: ['ALL']
      });
      console.log('✅ DetectFaces succeeded');
    } catch (rekognitionError: any) {
      console.error('❌ DetectFaces failed:', rekognitionError.message);
      throw new Error(`Face detection failed: ${rekognitionError.message}`);
    }

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
        // Download profile photo and convert to base64
        console.log('  - Fetching photo:', photo.url);
        const photoResponse = await fetch(photo.url);

        if (!photoResponse.ok) {
          console.error(`  - Failed to fetch photo: ${photoResponse.status} ${photoResponse.statusText}`);
          continue;
        }

        const photoBuffer = await photoResponse.arrayBuffer();
        console.log('  - Photo buffer size:', photoBuffer.byteLength, 'bytes');

        // Convert to base64 safely (handles large files)
        const photoBytes = new Uint8Array(photoBuffer);
        let photoBase64 = '';
        const chunkSize = 32768; // Process in chunks to avoid call stack issues
        for (let i = 0; i < photoBytes.length; i += chunkSize) {
          const chunk = photoBytes.subarray(i, Math.min(i + chunkSize, photoBytes.length));
          photoBase64 += String.fromCharCode.apply(null, chunk as any);
        }
        photoBase64 = btoa(photoBase64);
        console.log('  - Photo base64 length:', photoBase64.length);

        // Compare faces - AWS expects base64 strings for Bytes
        console.log('  - Calling CompareFaces...');
        const compareResult = await callRekognition('CompareFaces', {
          SourceImage: { Bytes: selfie_base64 },
          TargetImage: { Bytes: photoBase64 },
          SimilarityThreshold: 80
        });

        console.log('  - CompareFaces response:', JSON.stringify(compareResult).substring(0, 200));

        if (compareResult.FaceMatches && compareResult.FaceMatches.length > 0) {
          const similarity = compareResult.FaceMatches[0].Similarity;
          console.log(`  ✅ Match found! Similarity: ${similarity}%`);

          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            matchedPhotoUrl = photo.url;
          }
        } else if (compareResult.UnmatchedFaces && compareResult.UnmatchedFaces.length > 0) {
          console.log(`  ⚠️ Face found in photo but no match. UnmatchedFaces: ${compareResult.UnmatchedFaces.length}`);
        } else {
          console.log('  ❌ No face detected in profile photo');
        }
      } catch (error: any) {
        console.error('Error comparing with photo:', photo.url);
        console.error('  - Error message:', error.message);
        console.error('  - Error details:', error.toString());
      }
    }

    // Step 3: Determine verification result
    const VERIFICATION_THRESHOLD = 80;
    const isVerified = highestSimilarity >= VERIFICATION_THRESHOLD;

    console.log(`📊 Highest similarity: ${highestSimilarity}%`);
    console.log(`📊 Threshold: ${VERIFICATION_THRESHOLD}%`);
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

    // Generate helpful message based on result
    let message: string;
    if (isVerified) {
      message = `Photos verified! Match confidence: ${Math.round(highestSimilarity)}%`;
    } else if (highestSimilarity >= 50) {
      message = `Almost there! Match confidence: ${Math.round(highestSimilarity)}%. Try taking a selfie with better lighting and facing the camera directly, similar to your profile photos.`;
    } else if (highestSimilarity > 0) {
      message = `Low match confidence: ${Math.round(highestSimilarity)}%. Make sure your selfie clearly shows your face and matches your profile photos.`;
    } else {
      message = `Could not match your selfie to your profile photos. Please ensure your profile photos clearly show your face, and take a well-lit selfie looking directly at the camera.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: isVerified,
        similarity: Math.round(highestSimilarity),
        threshold: VERIFICATION_THRESHOLD,
        message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in photo-verification-start:', error);
    // Return 200 with success=false so client can see full error details
    return new Response(
      JSON.stringify({
        success: false,
        verified: false,
        error: error.message || 'Failed to verify photos',
        details: error.toString(),
        debug: {
          has_aws_key: !!AWS_ACCESS_KEY,
          has_aws_secret: !!AWS_SECRET_KEY,
          aws_region: AWS_REGION,
          key_prefix: AWS_ACCESS_KEY ? AWS_ACCESS_KEY.substring(0, 4) : 'MISSING'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});

// Helper function to call AWS Rekognition API with AWS Signature V4
async function callRekognition(action: string, params: any) {
  console.log(`📡 callRekognition: ${action}`);
  console.log(`  - Region: ${AWS_REGION}`);
  console.log(`  - Has Image.Bytes: ${!!params?.Image?.Bytes}`);
  console.log(`  - Image.Bytes length: ${params?.Image?.Bytes?.length || 0}`);

  const endpoint = `https://rekognition.${AWS_REGION}.amazonaws.com/`;
  const body = JSON.stringify(params);
  console.log(`  - Body length: ${body.length}`);

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

  console.log(`  - Sending request to AWS...`);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: body,
    });
    console.log(`  - Response status: ${response.status}`);
  } catch (fetchError: any) {
    console.error('❌ Fetch failed:', fetchError.message);
    throw new Error(`Network error calling AWS: ${fetchError.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Rekognition API error:');
    console.error('  - Status:', response.status);
    console.error('  - Response:', errorText);
    console.error('  - Action:', action);
    console.error('  - Region:', AWS_REGION);
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
