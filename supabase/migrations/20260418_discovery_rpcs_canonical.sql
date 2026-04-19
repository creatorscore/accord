-- Canonical source for discovery RPCs and cache-invalidation trigger.
-- Previously these existed only in prod (applied via ad-hoc migrations) and had
-- drifted from the repo. Checking in so dev matches prod and future edits have a
-- single source of truth. Idempotent via CREATE OR REPLACE.

-- -----------------------------------------------------------------------------
-- get_nearby_profiles: live cache-miss fallback used by discover.tsx when
-- discovery_feed_cache has no rows for the viewer. Returns candidates within
-- distance, age range, and gender prefs, excluding blocked/passed/liked/banned
-- and incognito/photo-review/inactive/policy-restricted profiles.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_nearby_profiles(
  p_user_lat double precision,
  p_user_lon double precision,
  p_max_distance_miles integer,
  p_user_profile_id uuid,
  p_min_age integer,
  p_max_age integer,
  p_gender_prefs text[],
  p_result_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  display_name character varying,
  age integer,
  gender text[],
  location_city character varying,
  location_state character varying,
  latitude numeric,
  longitude numeric,
  distance_miles integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_swiped_ids UUID[];
  v_blocked_ids UUID[];
  v_lat_delta DOUBLE PRECISION;
  v_lon_delta DOUBLE PRECISION;
  v_lat_min DOUBLE PRECISION;
  v_lat_max DOUBLE PRECISION;
  v_lon_min DOUBLE PRECISION;
  v_lon_max DOUBLE PRECISION;
  v_skip_gender_filter BOOLEAN;
BEGIN
  v_lat_delta := p_max_distance_miles / 69.0;
  v_lon_delta := p_max_distance_miles / (69.0 * GREATEST(cos(radians(p_user_lat)), 0.01));
  v_lat_min := p_user_lat - v_lat_delta;
  v_lat_max := p_user_lat + v_lat_delta;
  v_lon_min := p_user_lon - v_lon_delta;
  v_lon_max := p_user_lon + v_lon_delta;

  v_skip_gender_filter := (
    p_gender_prefs IS NULL
    OR ARRAY_LENGTH(p_gender_prefs, 1) IS NULL
    OR 'Everyone' = ANY(p_gender_prefs)
  );

  SELECT ARRAY_AGG(DISTINCT swiped_id) INTO v_swiped_ids FROM (
    SELECT liked_profile_id AS swiped_id FROM likes WHERE liker_profile_id = p_user_profile_id
    UNION
    SELECT passed_profile_id AS swiped_id FROM passes WHERE passer_profile_id = p_user_profile_id
  ) AS swiped;

  SELECT ARRAY_AGG(DISTINCT blocked_id) INTO v_blocked_ids FROM (
    SELECT blocked_profile_id AS blocked_id FROM blocks WHERE blocker_profile_id = p_user_profile_id
    UNION
    SELECT blocker_profile_id AS blocked_id FROM blocks WHERE blocked_profile_id = p_user_profile_id
  ) AS blocked;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.age,
    p.gender,
    p.location_city,
    p.location_state,
    p.latitude,
    p.longitude,
    ROUND(
      3959 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_user_lat)) *
          cos(radians(p.latitude)) *
          cos(radians(p.longitude) - radians(p_user_lon)) +
          sin(radians(p_user_lat)) *
          sin(radians(p.latitude))
        ))
      )
    )::INTEGER as distance_miles
  FROM profiles p
  WHERE
    p.id != p_user_profile_id
    AND p.profile_complete = true
    AND (p.is_active = true OR p.is_active IS NULL)
    AND (p.policy_restricted = false OR p.policy_restricted IS NULL)
    AND (p.incognito_mode = false OR p.incognito_mode IS NULL)
    AND (p.photo_review_required = false OR p.photo_review_required IS NULL)
    AND p.age >= p_min_age
    AND p.age <= p_max_age
    AND (
      v_skip_gender_filter
      OR p.gender && p_gender_prefs
    )
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND p.latitude BETWEEN v_lat_min AND v_lat_max
    AND p.longitude BETWEEN v_lon_min AND v_lon_max
    AND 3959 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(p_user_lat)) *
        cos(radians(p.latitude)) *
        cos(radians(p.longitude) - radians(p_user_lon)) +
        sin(radians(p_user_lat)) *
        sin(radians(p.latitude))
      ))
    ) <= p_max_distance_miles
    AND NOT EXISTS (
      SELECT 1 FROM bans b
      WHERE b.banned_profile_id = p.id
      AND b.unbanned_at IS NULL
      AND (b.expires_at IS NULL OR b.expires_at > NOW())
    )
    AND (v_swiped_ids IS NULL OR NOT (p.id = ANY(v_swiped_ids)))
    AND (v_blocked_ids IS NULL OR NOT (p.id = ANY(v_blocked_ids)))
  ORDER BY distance_miles ASC
  LIMIT p_result_limit;
END;
$function$;

-- -----------------------------------------------------------------------------
-- refresh_discovery_feed: populates discovery_feed_cache for a single profile.
-- Called by pg_cron + trigger-driven invalidation. Filters must match
-- get_nearby_profiles so cached and live-RPC paths stay consistent.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_discovery_feed(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_lat NUMERIC;
  v_lon NUMERIC;
  v_max_distance INTEGER;
  v_age_min INTEGER;
  v_age_max INTEGER;
  v_gender_prefs TEXT[];
  v_skip_gender_filter BOOLEAN;
  v_count INTEGER;
BEGIN
  SELECT p.latitude, p.longitude,
    COALESCE(pr.max_distance_miles, 50),
    COALESCE(pr.age_min, 18),
    COALESCE(pr.age_max, 99),
    COALESCE(pr.gender_preference::TEXT[], ARRAY[]::TEXT[])
  INTO v_lat, v_lon, v_max_distance, v_age_min, v_age_max, v_gender_prefs
  FROM profiles p
  LEFT JOIN preferences pr ON pr.profile_id = p.id
  WHERE p.id = p_profile_id;

  IF v_lat IS NULL OR v_lon IS NULL THEN
    RETURN 0;
  END IF;

  v_skip_gender_filter := (
    array_length(v_gender_prefs, 1) IS NULL
    OR 'Everyone' = ANY(v_gender_prefs)
  );

  DELETE FROM discovery_feed_cache WHERE profile_id = p_profile_id;

  INSERT INTO discovery_feed_cache (profile_id, candidate_id, distance_miles, liked_you, computed_at)
  SELECT
    p_profile_id,
    p.id,
    3959 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(v_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(v_lon))
        + sin(radians(v_lat)) * sin(radians(p.latitude))
      ))
    ) as dist,
    EXISTS(SELECT 1 FROM likes l WHERE l.liker_profile_id = p.id AND l.liked_profile_id = p_profile_id) as liked_you,
    now()
  FROM profiles p
  WHERE p.id != p_profile_id
    AND p.is_active = true
    AND p.profile_complete = true
    AND (p.incognito_mode = false OR p.incognito_mode IS NULL)
    AND (p.photo_review_required = false OR p.photo_review_required IS NULL)
    AND (p.ban_reason IS NULL OR (p.ban_expires_at IS NOT NULL AND p.ban_expires_at <= now()))
    AND (p.policy_restricted IS NULL OR p.policy_restricted = false)
    AND p.age >= v_age_min AND p.age <= v_age_max
    AND (v_skip_gender_filter OR p.gender && v_gender_prefs)
    AND NOT EXISTS(SELECT 1 FROM likes l WHERE l.liker_profile_id = p_profile_id AND l.liked_profile_id = p.id)
    AND NOT EXISTS(SELECT 1 FROM passes pa WHERE pa.passer_profile_id = p_profile_id AND pa.passed_profile_id = p.id)
    AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_profile_id = p_profile_id AND b.blocked_profile_id = p.id) OR (b.blocker_profile_id = p.id AND b.blocked_profile_id = p_profile_id))
    AND NOT EXISTS(SELECT 1 FROM bans ba WHERE ba.banned_profile_id = p.id AND (ba.expires_at IS NULL OR ba.expires_at > now()))
    AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    AND 3959 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(v_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(v_lon))
        + sin(radians(v_lat)) * sin(radians(p.latitude))
      ))
    ) <= v_max_distance
  ORDER BY
    EXISTS(SELECT 1 FROM likes l WHERE l.liker_profile_id = p.id AND l.liked_profile_id = p_profile_id) DESC,
    dist ASC
  LIMIT 100;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- -----------------------------------------------------------------------------
-- invalidate_discovery_cache_on_pref_change: DELETEs cached rows when a viewer
-- changes any filter-relevant preference. Watches the 7 hard-filter columns
-- plus discovery_filters (JSONB blob holding premium filter selections).
-- Trigger is attached AFTER UPDATE on preferences.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invalidate_discovery_cache_on_pref_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.gender_preference IS DISTINCT FROM OLD.gender_preference)
     OR (NEW.age_min IS DISTINCT FROM OLD.age_min)
     OR (NEW.age_max IS DISTINCT FROM OLD.age_max)
     OR (NEW.max_distance_miles IS DISTINCT FROM OLD.max_distance_miles)
     OR (NEW.search_globally IS DISTINCT FROM OLD.search_globally)
     OR (NEW.willing_to_relocate IS DISTINCT FROM OLD.willing_to_relocate)
     OR (NEW.preferred_cities IS DISTINCT FROM OLD.preferred_cities)
     OR (NEW.discovery_filters IS DISTINCT FROM OLD.discovery_filters) THEN
    DELETE FROM discovery_feed_cache WHERE profile_id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger binding (idempotent via DROP ... IF EXISTS before CREATE).
DROP TRIGGER IF EXISTS trg_invalidate_discovery_cache ON public.preferences;
CREATE TRIGGER trg_invalidate_discovery_cache
  AFTER UPDATE ON public.preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_discovery_cache_on_pref_change();
