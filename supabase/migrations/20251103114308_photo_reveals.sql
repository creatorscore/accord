-- Create photo_reveals table for selective photo unblurring
CREATE TABLE IF NOT EXISTS photo_reveals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revealer_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  revealed_to_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  revealed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(revealer_profile_id, revealed_to_profile_id)
);

-- Index for fast lookups
CREATE INDEX idx_photo_reveals_revealer ON photo_reveals(revealer_profile_id);
CREATE INDEX idx_photo_reveals_revealed_to ON photo_reveals(revealed_to_profile_id);
CREATE INDEX idx_photo_reveals_match ON photo_reveals(match_id);

-- RLS Policies
ALTER TABLE photo_reveals ENABLE ROW LEVEL SECURITY;

-- Users can view reveals where they are either the revealer or the person being revealed to
CREATE POLICY "Users can view their own photo reveals"
  ON photo_reveals FOR SELECT
  USING (
    revealer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    revealed_to_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Users can only reveal their own photos
CREATE POLICY "Users can reveal their own photos"
  ON photo_reveals FOR INSERT
  WITH CHECK (
    revealer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Users can only delete their own reveals (re-blur)
CREATE POLICY "Users can delete their own reveals"
  ON photo_reveals FOR DELETE
  USING (
    revealer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Comment
COMMENT ON TABLE photo_reveals IS 'Tracks which users have revealed their blurred photos to specific matches';
