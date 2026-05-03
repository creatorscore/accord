-- Function to get blocked profile IDs based on phone number hashes
-- This runs server-side with access to auth.users table
CREATE OR REPLACE FUNCTION get_contact_blocked_profiles(
  requesting_profile_id UUID
)
RETURNS TABLE(profile_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
AS $$
BEGIN
  RETURN QUERY
  WITH blocked_phones AS (
    -- Get all phone hashes blocked by the requesting user
    SELECT phone_number as phone_hash
    FROM contact_blocks
    WHERE contact_blocks.profile_id = requesting_profile_id
  ),
  user_phone_hashes AS (
    -- Hash all user phone numbers
    -- Note: This requires the pgcrypto extension for digest function
    SELECT
      p.id as profile_id,
      encode(digest(
        regexp_replace(COALESCE(au.phone, ''), '[^0-9]', '', 'g'),
        'sha256'
      ), 'hex') as phone_hash
    FROM profiles p
    INNER JOIN auth.users au ON p.user_id = au.id
    WHERE au.phone IS NOT NULL
  )
  -- Return profile IDs where phone hash matches blocked list
  SELECT uph.profile_id
  FROM user_phone_hashes uph
  INNER JOIN blocked_phones bp ON uph.phone_hash = bp.phone_hash
  WHERE uph.profile_id != requesting_profile_id; -- Don't block yourself
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_contact_blocked_profiles(UUID) TO authenticated;

-- Add RLS policy to ensure users can only check their own blocks
CREATE POLICY "Users can check their own contact blocks"
  ON contact_blocks
  FOR SELECT
  USING (profile_id = auth.uid()::UUID);

-- Create an RPC function that can be called from the client
CREATE OR REPLACE FUNCTION get_contact_blocked_profile_ids(
  requesting_profile_id UUID
)
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT array_agg(profile_id)
  FROM get_contact_blocked_profiles(requesting_profile_id);
$$;

GRANT EXECUTE ON FUNCTION get_contact_blocked_profile_ids(UUID) TO authenticated;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_contact_blocks_profile_phone
  ON contact_blocks(profile_id, phone_number);