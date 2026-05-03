-- Add preferred_language column to profiles table for localized push notifications
-- This stores the user's language preference to send notifications in their chosen language

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en';

-- Add index for efficient filtering by language (useful for batch notification queries)
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language
  ON profiles(preferred_language);

-- Add comment for documentation
COMMENT ON COLUMN profiles.preferred_language IS 'User preferred language code (e.g., en, es, ar) for push notifications. Defaults to English.';
