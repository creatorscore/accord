-- Migration: Add daily likes tracking to profiles
-- This switches the app from swipe limits to like limits (5 likes/day for free, unlimited for premium)
--
-- DO NOT APPLY THIS UNTIL YOU'RE READY TO DEPLOY THE NEW APP VERSION TO APP STORES
-- This requires the updated app code to be deployed first

-- Add daily likes tracking fields to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS daily_likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_likes_reset_date DATE DEFAULT CURRENT_DATE;

-- Create index for efficient daily like queries
CREATE INDEX IF NOT EXISTS idx_profiles_daily_likes_reset
  ON profiles(daily_likes_reset_date);

-- Add comments for documentation
COMMENT ON COLUMN profiles.daily_likes_count IS 'Number of likes used today (resets daily at midnight)';
COMMENT ON COLUMN profiles.daily_likes_reset_date IS 'Date when daily likes counter was last reset';

-- Migration complete
-- After applying this migration, the app will enforce:
-- - Free users: 5 likes per day (unlimited browsing)
-- - Premium users: unlimited likes (no restrictions)
