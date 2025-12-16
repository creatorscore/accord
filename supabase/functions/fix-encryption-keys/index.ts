// Edge Function: fix-encryption-keys
// One-time migration to fix all users' encryption keys to use deterministic derivation
// This ensures iOS and Android users can read each other's messages

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same salt used in the app - MUST MATCH lib/encryption.ts
const ENCRYPTION_SALT = 'accord_e2e_encryption_v1_';

// Simple SHA-256 implementation for Deno
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate deterministic public key for a user
// This MUST match generateKeyPairForUser() in lib/encryption.ts
async function generateDeterministicPublicKey(userId: string): Promise<string> {
  // Step 1: Derive private key from salt + userId
  const seedString = ENCRYPTION_SALT + userId;
  const privateKey = await sha256(seedString);

  // Step 2: Derive public key from private key
  const publicKey = await sha256(privateKey);

  return publicKey;
}

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

    // Create client with user's auth token to verify identity
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requester is an admin
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Get all profiles with their user_ids
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, encryption_public_key, display_name');

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} profiles to process`);

    let fixed = 0;
    let alreadyCorrect = 0;
    let errors = 0;
    const details: { profileId: string; displayName: string; status: string }[] = [];

    // Process each profile
    for (const profile of profiles || []) {
      try {
        // Generate the correct deterministic public key
        const correctPublicKey = await generateDeterministicPublicKey(profile.user_id);

        // Check if it matches what's in the database
        if (profile.encryption_public_key === correctPublicKey) {
          alreadyCorrect++;
          details.push({
            profileId: profile.id,
            displayName: profile.display_name || 'Unknown',
            status: 'already_correct'
          });
        } else {
          // Update to the correct key
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ encryption_public_key: correctPublicKey })
            .eq('id', profile.id);

          if (updateError) {
            errors++;
            details.push({
              profileId: profile.id,
              displayName: profile.display_name || 'Unknown',
              status: `error: ${updateError.message}`
            });
          } else {
            fixed++;
            console.log(`Fixed encryption key for ${profile.display_name || profile.id}`);
            details.push({
              profileId: profile.id,
              displayName: profile.display_name || 'Unknown',
              status: 'fixed'
            });
          }
        }
      } catch (err: any) {
        errors++;
        details.push({
          profileId: profile.id,
          displayName: profile.display_name || 'Unknown',
          status: `error: ${err.message}`
        });
      }
    }

    console.log(`Migration complete: ${fixed} fixed, ${alreadyCorrect} already correct, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Encryption key migration complete',
        summary: {
          total: profiles?.length || 0,
          fixed,
          alreadyCorrect,
          errors
        },
        details: details.filter(d => d.status !== 'already_correct') // Only show non-correct ones
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in fix-encryption-keys:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fix encryption keys' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
