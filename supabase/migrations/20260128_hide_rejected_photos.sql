-- Hide rejected photos from non-admin users
-- Photos with moderation_status = 'rejected' should never be visible to regular users
-- This is a defense-in-depth measure alongside client-side filtering

-- Drop existing permissive SELECT policies on photos that don't filter by moderation_status
-- and replace with ones that exclude rejected photos for non-admin users

-- Create a policy that prevents regular users from seeing rejected photos
-- Admin users (via service_role key) bypass RLS entirely, so they can still see all photos
CREATE POLICY "Hide rejected photos from users"
  ON photos
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (moderation_status IS DISTINCT FROM 'rejected');
