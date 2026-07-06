-- check_mutual_like: confirm a mutual like and return the other side's like id
-- (used by every "I like someone" path to decide whether to create a match).
--
-- A received like means the other person deliberately chose you. When you like
-- them back, that is mutual consent and MUST create a match — regardless of the
-- distance between you. The previous version had a reciprocal-distance gate that
-- returned NULL for out-of-range pairs, silently swallowing matches for users
-- who liked someone who had liked them (support reports: "can't like/match
-- people who liked me"). Distance stays a hard filter on the DISCOVERY feed
-- (who you're shown); it must not veto a match you both explicitly opted into.
--
-- Applied to prod via Supabase MCP 2026-07-05; checked in for parity.
CREATE OR REPLACE FUNCTION public.check_mutual_like(p_target_profile_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_profile_id UUID;
  v_like_id UUID;
BEGIN
  SELECT id INTO v_current_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_current_profile_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_like_id
  FROM likes
  WHERE liker_profile_id = p_target_profile_id
    AND liked_profile_id = v_current_profile_id
  LIMIT 1;

  RETURN v_like_id;
END;
$function$;
