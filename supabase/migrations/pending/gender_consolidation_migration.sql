-- ============================================================================
-- Gender Consolidation Migration
-- ============================================================================
-- PURPOSE: Migrate legacy gender values to the 3 simplified options:
--   Man, Woman, Non-binary
--
-- MAPPING:
--   Trans Man                → Man
--   Trans Woman              → Woman
--   Genderfluid              → Non-binary
--   Genderqueer              → Non-binary
--   Agender                  → Non-binary
--   Two-Spirit               → Non-binary
--   Questioning              → Non-binary
--   Intersex                 → Non-binary
--   Bigender                 → Non-binary
--   Neutrois                 → Non-binary
--   Demigender               → Non-binary
--   Other                    → Non-binary
--   Prefer not to say        → Non-binary
--
-- WHEN TO RUN: On launch day, BEFORE releasing the new app version.
-- REVERSIBLE: No — back up first if needed.
-- ============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Migrate profiles.gender (TEXT[])
-- ──────────────────────────────────────────────────────────────────────────────
-- Replace legacy values in the array, then deduplicate.

UPDATE profiles
SET gender = (
  SELECT ARRAY(
    SELECT DISTINCT
      CASE val
        WHEN 'Trans Man'          THEN 'Man'
        WHEN 'Trans Woman'        THEN 'Woman'
        WHEN 'Genderfluid'       THEN 'Non-binary'
        WHEN 'Genderqueer'       THEN 'Non-binary'
        WHEN 'Agender'           THEN 'Non-binary'
        WHEN 'Two-Spirit'        THEN 'Non-binary'
        WHEN 'Questioning'       THEN 'Non-binary'
        WHEN 'Intersex'          THEN 'Non-binary'
        WHEN 'Bigender'          THEN 'Non-binary'
        WHEN 'Neutrois'          THEN 'Non-binary'
        WHEN 'Demigender'        THEN 'Non-binary'
        WHEN 'Other'             THEN 'Non-binary'
        WHEN 'Prefer not to say' THEN 'Non-binary'
        ELSE val
      END
    FROM unnest(gender) AS val
  )
)
WHERE gender && ARRAY[
  'Trans Man', 'Trans Woman', 'Genderfluid', 'Genderqueer', 'Agender',
  'Two-Spirit', 'Questioning', 'Intersex', 'Bigender', 'Neutrois',
  'Demigender', 'Other', 'Prefer not to say'
]::TEXT[];

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Migrate preferences.gender_preference (VARCHAR[])
-- ──────────────────────────────────────────────────────────────────────────────
-- Same mapping, same dedup.

UPDATE preferences
SET gender_preference = (
  SELECT ARRAY(
    SELECT DISTINCT
      CASE val
        WHEN 'Trans Man'          THEN 'Man'
        WHEN 'Trans Woman'        THEN 'Woman'
        WHEN 'Genderfluid'       THEN 'Non-binary'
        WHEN 'Genderqueer'       THEN 'Non-binary'
        WHEN 'Agender'           THEN 'Non-binary'
        WHEN 'Two-Spirit'        THEN 'Non-binary'
        WHEN 'Questioning'       THEN 'Non-binary'
        WHEN 'Intersex'          THEN 'Non-binary'
        WHEN 'Bigender'          THEN 'Non-binary'
        WHEN 'Neutrois'          THEN 'Non-binary'
        WHEN 'Demigender'        THEN 'Non-binary'
        WHEN 'Other'             THEN 'Non-binary'
        WHEN 'Prefer not to say' THEN 'Non-binary'
        ELSE val
      END
    FROM unnest(gender_preference) AS val
  )
)
WHERE gender_preference && ARRAY[
  'Trans Man', 'Trans Woman', 'Genderfluid', 'Genderqueer', 'Agender',
  'Two-Spirit', 'Questioning', 'Intersex', 'Bigender', 'Neutrois',
  'Demigender', 'Other', 'Prefer not to say'
]::VARCHAR[];

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Verification queries (run after to confirm)
-- ──────────────────────────────────────────────────────────────────────────────
-- After committing, run these to verify no legacy values remain:
--
--   SELECT unnest(gender) AS val, count(*)
--   FROM profiles WHERE gender IS NOT NULL
--   GROUP BY val ORDER BY count(*) DESC;
--
--   SELECT unnest(gender_preference) AS val, count(*)
--   FROM preferences WHERE gender_preference IS NOT NULL
--     AND array_length(gender_preference, 1) > 0
--   GROUP BY val ORDER BY count(*) DESC;
--
-- Expected results: only Man, Woman, Non-binary in both tables.
-- ──────────────────────────────────────────────────────────────────────────────

COMMIT;
