-- Migration: Add server-side notification triggers
-- These triggers call edge functions to send push notifications reliably
-- Uses pg_net for async HTTP calls to avoid blocking the main transaction

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- LIKE NOTIFICATIONS
-- ============================================

-- Function to notify on new like
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT := 'https://xcaktvlosjsaxcntxbyf.supabase.co';
  service_role_key TEXT;
BEGIN
  -- Get the service role key from vault (or use env)
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- If no vault secret, use the one from settings
  IF service_role_key IS NULL THEN
    service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- Call edge function asynchronously
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-new-like',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'liker_profile_id', NEW.liker_profile_id,
      'liked_profile_id', NEW.liked_profile_id,
      'like_type', NEW.like_type
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on likes table
DROP TRIGGER IF EXISTS trigger_notify_on_like ON likes;
CREATE TRIGGER trigger_notify_on_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_like();

-- ============================================
-- MATCH NOTIFICATIONS
-- ============================================

-- Function to notify on new match
CREATE OR REPLACE FUNCTION notify_on_match()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT := 'https://xcaktvlosjsaxcntxbyf.supabase.co';
  service_role_key TEXT;
BEGIN
  -- Get the service role key from vault (or use env)
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- If no vault secret, use the one from settings
  IF service_role_key IS NULL THEN
    service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- Call edge function asynchronously
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-new-match',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'profile1_id', NEW.profile1_id,
      'profile2_id', NEW.profile2_id,
      'match_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on matches table
DROP TRIGGER IF EXISTS trigger_notify_on_match ON matches;
CREATE TRIGGER trigger_notify_on_match
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_match();

-- ============================================
-- MESSAGE NOTIFICATIONS
-- ============================================

-- Function to notify on new message
CREATE OR REPLACE FUNCTION notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT := 'https://xcaktvlosjsaxcntxbyf.supabase.co';
  service_role_key TEXT;
BEGIN
  -- Get the service role key from vault (or use env)
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- If no vault secret, use the one from settings
  IF service_role_key IS NULL THEN
    service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- Call edge function asynchronously
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-new-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'sender_profile_id', NEW.sender_profile_id,
      'receiver_profile_id', NEW.receiver_profile_id,
      'match_id', NEW.match_id,
      'content_type', NEW.content_type
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS trigger_notify_on_message ON messages;
CREATE TRIGGER trigger_notify_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_message();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION notify_on_like() IS 'Sends push notification when someone likes a profile';
COMMENT ON FUNCTION notify_on_match() IS 'Sends push notification to both users when they match';
COMMENT ON FUNCTION notify_on_message() IS 'Sends push notification when a new message is received';
