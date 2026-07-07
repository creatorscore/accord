-- Second half of the "received likes are always matchable" decision.
--
-- check_mutual_like (see 20260705_check_mutual_like_drop_distance_gate.sql) was
-- only the client-side gate: it decides whether the app ATTEMPTS a match insert.
-- The matches table itself had a BEFORE trigger, enforce_match_distance, that
-- RAISE'd 'MATCH_DISTANCE_EXCEEDED' whenever the two profiles were farther apart
-- than LEAST(cap1, cap2) miles and neither had premium global search — a second
-- copy of the same distance gate. So even after the RPC fix, liking back someone
-- who liked you from outside your radius still failed at INSERT time (support:
-- Tess / thessalychance@yahoo.com couldn't match Eden, 1505mi vs 500mi cap).
--
-- validate_mutual_likes_before_match already guarantees BOTH users liked each
-- other before any match row can exist, so this distance check was always
-- vetoing a genuine mutual like. Neuter it (keep the function + trigger wired so
-- it can be re-enabled trivially). Distance stays a hard filter on DISCOVERY.
--
-- Applied to prod via Supabase MCP 2026-07-07; checked in for parity.
CREATE OR REPLACE FUNCTION public.enforce_match_distance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Intentionally a no-op: a match only ever exists for a mutual like, and a
  -- mutual like is always allowed to match regardless of distance.
  RETURN NEW;
END;
$function$;
