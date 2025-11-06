-- Contact Blocking Feature
-- Allows users to prevent profiles with matching phone numbers from their contacts from appearing

CREATE TABLE IF NOT EXISTS contact_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  phone_number TEXT NOT NULL, -- Hashed phone number for privacy
  blocked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, phone_number)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_contact_blocks_profile ON contact_blocks(profile_id);
CREATE INDEX IF NOT EXISTS idx_contact_blocks_phone ON contact_blocks(phone_number);

-- RLS Policies
ALTER TABLE contact_blocks ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own contact blocks
CREATE POLICY "Users manage own contact blocks" ON contact_blocks
  FOR ALL USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
