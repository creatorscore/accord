-- Add blur_data_uri column to photos table for server-side blurred thumbnails
-- Stores a ~20px wide JPEG as a base64 data URI (~300-500 bytes per photo)
-- Used to provide real blur on Android where RenderScript crashes
ALTER TABLE photos ADD COLUMN IF NOT EXISTS blur_data_uri TEXT;
