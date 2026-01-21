-- Migration: Add expiration notification tracking
-- Tracks which expiration reminders have been sent for each match

-- Add notification tracking fields to matches table
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS notified_5_days BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notified_3_days BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notified_1_day BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN matches.notified_5_days IS 'True if 5-day expiration reminder was sent';
COMMENT ON COLUMN matches.notified_3_days IS 'True if 3-day expiration reminder was sent';
COMMENT ON COLUMN matches.notified_1_day IS 'True if 1-day (24h) expiration reminder was sent';

-- Create index for efficient notification queries
-- Find matches that need notifications (not yet messaged, expiring soon, notification not sent)
CREATE INDEX IF NOT EXISTS idx_matches_expiration_notifications
  ON matches(expires_at, first_message_sent_at, notified_5_days, notified_3_days, notified_1_day)
  WHERE expires_at IS NOT NULL AND first_message_sent_at IS NULL AND status = 'active';
