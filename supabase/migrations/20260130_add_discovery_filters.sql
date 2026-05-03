ALTER TABLE preferences ADD COLUMN IF NOT EXISTS discovery_filters JSONB DEFAULT '{}'::jsonb;
