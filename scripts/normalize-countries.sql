-- Normalize country names in profiles table
-- Run this to fix existing data quality issues

-- Step 1: Trim whitespace from all countries
UPDATE profiles
SET location_country = TRIM(location_country)
WHERE location_country IS NOT NULL
  AND location_country != TRIM(location_country);

-- Step 2: Normalize specific variations
UPDATE profiles
SET location_country = 'United Arab Emirates'
WHERE location_country IN ('UAE', 'UAE ', 'U.A.E', 'U.A.E.', 'Emirates');

UPDATE profiles
SET location_country = 'United Kingdom'
WHERE location_country IN ('UK', 'U.K', 'U.K.', 'England', 'Scotland', 'Wales', 'Britain', 'Great Britain');

UPDATE profiles
SET location_country = 'United States'
WHERE location_country IN ('USA', 'U.S.A', 'U.S.A.', 'US', 'U.S', 'U.S.', 'America');

UPDATE profiles
SET location_country = 'Poland'
WHERE location_country IN ('Pologne', 'Polska');

UPDATE profiles
SET location_country = 'Germany'
WHERE location_country IN ('Deutschland', 'Allemagne');

UPDATE profiles
SET location_country = 'Netherlands'
WHERE location_country IN ('Holland', 'The Netherlands');

UPDATE profiles
SET location_country = 'South Korea'
WHERE location_country IN ('Korea', 'Republic of Korea', 'ROK');

-- Step 3: Check for remaining issues
SELECT
  location_country,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT display_name) as users
FROM profiles
WHERE location_country IS NOT NULL
GROUP BY location_country
ORDER BY count DESC;
