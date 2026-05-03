-- Migration: Add match expiration (7 days to send first message)
-- This creates urgency and encourages users to start conversations
-- SAFE: Only adds nullable columns, doesn't modify existing data behavior

-- Add expiration fields to matches table (nullable, safe to add)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_message_sent_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN matches.expires_at IS 'Match expires 7 days after matched_at if no message sent (NULL = no expiration set yet)';
COMMENT ON COLUMN matches.first_message_sent_at IS 'Timestamp of first message - prevents expiration once set';

-- Create index for efficient expiration queries (only for matches that can expire)
CREATE INDEX IF NOT EXISTS idx_matches_expires_at
  ON matches(expires_at)
  WHERE expires_at IS NOT NULL AND first_message_sent_at IS NULL AND status = 'active';

-- NOTE: This migration ONLY adds the columns and index
-- The app code will handle:
-- 1. Setting expires_at = matched_at + 7 days for NEW matches
-- 2. Setting first_message_sent_at when first message is sent
-- 3. Filtering out expired matches in the UI
--
-- Existing matches will have NULL values and won't be affected until app update
