-- Migration: Create app_config table for app-wide configuration
-- This table stores key-value configuration pairs including app version info

CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);

-- Insert initial app version configuration
-- This controls the app update checker modal
INSERT INTO app_config (key, value, description) VALUES (
  'app_version',
  '{
    "latest_version": "1.0.19",
    "minimum_version": "1.0.19",
    "minimum_version_ios": "1.0.19",
    "minimum_version_android": "1.0.19",
    "update_message": "We have made significant improvements to the app. Update now to get the latest features and bug fixes!",
    "is_forced": false
  }'::jsonb,
  'App version configuration for update checker'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- Add RLS policies
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read app_config (needed for version checks)
CREATE POLICY "Anyone can read app config"
  ON app_config
  FOR SELECT
  USING (true);

-- Only admins can update app_config
CREATE POLICY "Only admins can update app config"
  ON app_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Add comment
COMMENT ON TABLE app_config IS 'App-wide configuration key-value store';
