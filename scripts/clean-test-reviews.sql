-- Clean up any test/fake review data
-- Run this to check and remove test reviews

-- 1. Check current review data
SELECT
  p.id,
  p.display_name,
  p.review_aggregate_score,
  p.review_count,
  COUNT(r.id) as actual_review_count
FROM profiles p
LEFT JOIN reviews r ON r.reviewee_id = p.id AND r.is_visible = true
WHERE p.review_aggregate_score IS NOT NULL OR p.review_count > 0
GROUP BY p.id, p.display_name, p.review_aggregate_score, p.review_count;

-- 2. Delete all test reviews (if any exist)
DELETE FROM reviews;

-- 3. Delete all review prompts
DELETE FROM review_prompts;

-- 4. Reset all profile review counts and scores to NULL/0
UPDATE profiles
SET
  review_aggregate_score = NULL,
  review_count = 0
WHERE review_count > 0 OR review_aggregate_score IS NOT NULL;

-- 5. Verify cleanup
SELECT
  p.id,
  p.display_name,
  p.review_aggregate_score,
  p.review_count
FROM profiles p
WHERE p.review_aggregate_score IS NOT NULL OR p.review_count > 0;

-- Expected: No rows returned
