-- Fix: enforce_like_limits trigger updates to daily_likes_count / super_likes_count
-- were being silently reverted by protect_profile_columns (which locks those columns
-- for anything not running as service_role/postgres at the session level).
-- SECURITY DEFINER doesn't change session role, so the nested UPDATE always tripped
-- the lockdown, the counter never incremented, the check always saw 0, and the 5/day
-- limit was never enforced server-side.
--
-- Fix: enforce_like_limits sets a transaction-scoped GUC 'app.internal_profile_update'
-- before each UPDATE on profiles. protect_profile_columns bypasses the lockdown when
-- the GUC is set. set_config(..., true) is xact-local so it can never leak.

-- 1. protect_profile_columns: add GUC bypass
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR current_setting('role', true) = 'postgres'
     OR session_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.internal_profile_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.is_admin := OLD.is_admin;
  NEW.is_premium := OLD.is_premium;
  NEW.is_platinum := OLD.is_platinum;
  NEW.is_verified := OLD.is_verified;
  NEW.verification_status := OLD.verification_status;

  NEW.photo_verified := OLD.photo_verified;
  NEW.photo_verification_status := OLD.photo_verification_status;
  NEW.photo_verification_session_id := OLD.photo_verification_session_id;
  NEW.photo_verification_started_at := OLD.photo_verification_started_at;
  NEW.photo_verification_completed_at := OLD.photo_verification_completed_at;
  NEW.photo_verification_attempts := OLD.photo_verification_attempts;

  NEW.photo_review_required := OLD.photo_review_required;
  NEW.photo_review_reason := OLD.photo_review_reason;
  NEW.photo_review_requested_at := OLD.photo_review_requested_at;
  NEW.photo_review_cleared_by := OLD.photo_review_cleared_by;
  NEW.photo_review_cleared_at := OLD.photo_review_cleared_at;

  NEW.ban_reason := OLD.ban_reason;
  NEW.ban_expires_at := OLD.ban_expires_at;
  NEW.ban_user_message := OLD.ban_user_message;

  NEW.policy_restricted := OLD.policy_restricted;
  NEW.policy_restricted_reason := OLD.policy_restricted_reason;
  NEW.policy_restricted_at := OLD.policy_restricted_at;

  NEW.daily_likes_count := OLD.daily_likes_count;
  NEW.daily_likes_reset_date := OLD.daily_likes_reset_date;
  NEW.super_likes_count := OLD.super_likes_count;
  NEW.super_likes_reset_date := OLD.super_likes_reset_date;
  NEW.boost_count := OLD.boost_count;
  NEW.last_boost_at := OLD.last_boost_at;

  NEW.review_aggregate_score := OLD.review_aggregate_score;
  NEW.review_count := OLD.review_count;

  NEW.email_unsubscribed_at := OLD.email_unsubscribed_at;
  NEW.email_bounced := OLD.email_bounced;
  NEW.email_spam_complaint := OLD.email_spam_complaint;

  NEW.onboarding_reminder_24h_sent_at := OLD.onboarding_reminder_24h_sent_at;
  NEW.onboarding_reminder_3d_sent_at := OLD.onboarding_reminder_3d_sent_at;
  NEW.onboarding_reminder_7d_sent_at := OLD.onboarding_reminder_7d_sent_at;

  RETURN NEW;
END;
$function$;

-- 2. enforce_like_limits: set the GUC before every UPDATE
CREATE OR REPLACE FUNCTION public.enforce_like_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  liker_profile RECORD;
  approved_photo_count INTEGER;
BEGIN
  SELECT
    is_premium, is_platinum, profile_complete,
    daily_likes_count, daily_likes_reset_date,
    super_likes_count, super_likes_reset_date
  INTO liker_profile
  FROM profiles
  WHERE id = NEW.liker_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT liker_profile.profile_complete THEN
    RAISE EXCEPTION 'Please complete your profile before liking others' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO approved_photo_count
  FROM photos
  WHERE profile_id = NEW.liker_profile_id
    AND moderation_status = 'approved';

  IF approved_photo_count < 2 THEN
    RAISE EXCEPTION 'At least 2 approved photos are required to like profiles' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.like_type = 'super_like' THEN
    IF NOT liker_profile.is_premium AND NOT liker_profile.is_platinum THEN
      RAISE EXCEPTION 'Premium subscription required for super likes' USING ERRCODE = 'P0001';
    END IF;

    IF liker_profile.super_likes_reset_date IS NULL
       OR liker_profile.super_likes_reset_date < (now() - INTERVAL '7 days') THEN
      PERFORM set_config('app.internal_profile_update', 'on', true);
      UPDATE profiles
      SET super_likes_count = 0, super_likes_reset_date = now()
      WHERE id = NEW.liker_profile_id;
      liker_profile.super_likes_count := 0;
    END IF;

    IF liker_profile.super_likes_count >= 5 THEN
      RAISE EXCEPTION 'Weekly super like limit reached' USING ERRCODE = 'P0001';
    END IF;

    PERFORM set_config('app.internal_profile_update', 'on', true);
    UPDATE profiles
    SET super_likes_count = super_likes_count + 1
    WHERE id = NEW.liker_profile_id;

  ELSE
    IF liker_profile.is_premium OR liker_profile.is_platinum THEN
      RETURN NEW;
    END IF;

    IF liker_profile.daily_likes_reset_date IS NULL
       OR liker_profile.daily_likes_reset_date < CURRENT_DATE THEN
      PERFORM set_config('app.internal_profile_update', 'on', true);
      UPDATE profiles
      SET daily_likes_count = 0, daily_likes_reset_date = CURRENT_DATE
      WHERE id = NEW.liker_profile_id;
      liker_profile.daily_likes_count := 0;
    END IF;

    IF liker_profile.daily_likes_count >= 5 THEN
      RAISE EXCEPTION 'Daily like limit reached' USING ERRCODE = 'P0001';
    END IF;

    PERFORM set_config('app.internal_profile_update', 'on', true);
    UPDATE profiles
    SET daily_likes_count = daily_likes_count + 1
    WHERE id = NEW.liker_profile_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Back-sync counters for users who slipped past the broken enforcement,
--    so they cannot get another free 5 likes today / this week.
WITH standard_today AS (
  SELECT liker_profile_id, COUNT(*) AS c
  FROM likes
  WHERE (like_type IS NULL OR like_type = 'standard')
    AND created_at >= CURRENT_DATE
  GROUP BY liker_profile_id
)
UPDATE profiles p
SET daily_likes_count = st.c,
    daily_likes_reset_date = CURRENT_DATE
FROM standard_today st
WHERE p.id = st.liker_profile_id
  AND NOT p.is_premium
  AND NOT p.is_platinum;

WITH super_last_7d AS (
  SELECT liker_profile_id, COUNT(*) AS c, MIN(created_at) AS oldest
  FROM likes
  WHERE like_type = 'super_like'
    AND created_at >= now() - INTERVAL '7 days'
  GROUP BY liker_profile_id
)
UPDATE profiles p
SET super_likes_count = s.c,
    super_likes_reset_date = s.oldest
FROM super_last_7d s
WHERE p.id = s.liker_profile_id;
