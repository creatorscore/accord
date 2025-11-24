-- Accord Analytics Dashboard Queries
-- Run these in Supabase SQL Editor to get key metrics

-- ========================================
-- 1. USER GROWTH METRICS
-- ========================================

-- Total Users
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d
FROM profiles;

-- Daily Signups (Last 30 Days)
SELECT
  DATE(created_at) as signup_date,
  COUNT(*) as signups
FROM profiles
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY signup_date DESC;

-- ========================================
-- 2. ENGAGEMENT METRICS
-- ========================================

-- Active Users (Last 7/30 Days)
SELECT
  COUNT(CASE WHEN last_active_at >= NOW() - INTERVAL '7 days' THEN 1 END) as active_7d,
  COUNT(CASE WHEN last_active_at >= NOW() - INTERVAL '30 days' THEN 1 END) as active_30d,
  COUNT(*) as total_users,
  ROUND(100.0 * COUNT(CASE WHEN last_active_at >= NOW() - INTERVAL '7 days' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as dau_percentage
FROM profiles;

-- Matches Created (Last 7/30 Days)
SELECT
  COUNT(*) as total_matches,
  COUNT(CASE WHEN matched_at >= NOW() - INTERVAL '7 days' THEN 1 END) as matches_7d,
  COUNT(CASE WHEN matched_at >= NOW() - INTERVAL '30 days' THEN 1 END) as matches_30d
FROM matches
WHERE status = 'active';

-- Messages Sent (Last 7/30 Days)
SELECT
  COUNT(*) as total_messages,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as messages_7d,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as messages_30d
FROM messages;

-- ========================================
-- 3. SUBSCRIPTION/REVENUE METRICS
-- ========================================

-- Active Subscribers by Tier
SELECT
  tier,
  COUNT(*) as subscriber_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM profiles), 2) as conversion_rate
FROM subscriptions
WHERE status = 'active'
  AND (expires_at IS NULL OR expires_at > NOW())
GROUP BY tier
ORDER BY subscriber_count DESC;

-- Premium Users
SELECT
  COUNT(*) as total_premium_users,
  COUNT(CASE WHEN is_platinum THEN 1 END) as platinum_users,
  COUNT(CASE WHEN is_premium THEN 1 END) as premium_users,
  ROUND(100.0 * COUNT(CASE WHEN is_premium OR is_platinum THEN 1 END) / NULLIF(COUNT(*), 0), 2) as premium_percentage
FROM profiles;

-- ========================================
-- 4. VERIFICATION METRICS
-- ========================================

-- Verification Status Breakdown
SELECT
  verification_status,
  COUNT(*) as user_count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM profiles), 2) as percentage
FROM profiles
GROUP BY verification_status
ORDER BY user_count DESC;

-- Verified Users
SELECT
  COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
  COUNT(*) as total_users,
  ROUND(100.0 * COUNT(CASE WHEN is_verified = true THEN 1 END) / NULLIF(COUNT(*), 0), 2) as verification_rate
FROM profiles;

-- ========================================
-- 5. EMAIL LIST HEALTH
-- ========================================

-- Waitlist Stats
SELECT
  COUNT(*) as total_waitlist,
  COUNT(CASE WHEN notified = true THEN 1 END) as notified,
  COUNT(CASE WHEN bounced = true THEN 1 END) as bounced,
  COUNT(CASE WHEN spam_complaint = true THEN 1 END) as spam_complaints,
  COUNT(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 END) as unsubscribed,
  COUNT(CASE WHEN bounced = false AND spam_complaint = false AND unsubscribed_at IS NULL THEN 1 END) as clean_emails
FROM waitlist;

-- User Email Health
SELECT
  COUNT(CASE WHEN email_bounced = false AND email_spam_complaint = false AND email_unsubscribed_at IS NULL THEN 1 END) as clean_emails,
  COUNT(CASE WHEN email_bounced = true THEN 1 END) as bounced,
  COUNT(CASE WHEN email_spam_complaint = true THEN 1 END) as spam_complaints,
  COUNT(CASE WHEN email_unsubscribed_at IS NOT NULL THEN 1 END) as unsubscribed,
  COUNT(*) as total_users
FROM profiles;

-- ========================================
-- 6. SAFETY & MODERATION
-- ========================================

-- Reports & Blocks (Last 30 Days)
SELECT
  COUNT(CASE WHEN r.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as reports_30d,
  COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as blocks_30d
FROM reports r
FULL OUTER JOIN blocks b ON true;

-- ========================================
-- 7. GEOGRAPHY
-- ========================================

-- Top Cities
SELECT
  location_city,
  location_state,
  COUNT(*) as user_count
FROM profiles
WHERE location_city IS NOT NULL
GROUP BY location_city, location_state
ORDER BY user_count DESC
LIMIT 10;

-- ========================================
-- 8. FUNNEL METRICS
-- ========================================

-- Registration to Active User Funnel
SELECT
  COUNT(*) as total_signups,
  COUNT(CASE WHEN profile_complete = true THEN 1 END) as completed_profile,
  COUNT(CASE WHEN is_verified = true THEN 1 END) as verified,
  COUNT(CASE WHEN last_active_at >= NOW() - INTERVAL '7 days' THEN 1 END) as active_7d,
  ROUND(100.0 * COUNT(CASE WHEN profile_complete = true THEN 1 END) / NULLIF(COUNT(*), 0), 2) as profile_completion_rate,
  ROUND(100.0 * COUNT(CASE WHEN last_active_at >= NOW() - INTERVAL '7 days' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as activation_rate
FROM profiles;

-- Match to Conversation Funnel
WITH match_stats AS (
  SELECT
    m.id as match_id,
    m.matched_at,
    COUNT(msg.id) as message_count
  FROM matches m
  LEFT JOIN messages msg ON msg.match_id = m.id
  WHERE m.matched_at >= NOW() - INTERVAL '30 days'
  GROUP BY m.id, m.matched_at
)
SELECT
  COUNT(*) as total_matches_30d,
  COUNT(CASE WHEN message_count > 0 THEN 1 END) as matches_with_messages,
  COUNT(CASE WHEN message_count >= 5 THEN 1 END) as matches_with_conversation,
  ROUND(100.0 * COUNT(CASE WHEN message_count > 0 THEN 1 END) / NULLIF(COUNT(*), 0), 2) as message_rate,
  ROUND(100.0 * COUNT(CASE WHEN message_count >= 5 THEN 1 END) / NULLIF(COUNT(*), 0), 2) as conversation_rate
FROM match_stats;

-- ========================================
-- 9. RETENTION (Users Who Return)
-- ========================================

-- 7-Day Retention (Users who signed up 7+ days ago and were active in last 7 days)
WITH cohort AS (
  SELECT
    id,
    created_at,
    last_active_at,
    CASE
      WHEN last_active_at >= NOW() - INTERVAL '7 days' THEN true
      ELSE false
    END as is_active_7d
  FROM profiles
  WHERE created_at <= NOW() - INTERVAL '7 days'
    AND created_at >= NOW() - INTERVAL '14 days'
)
SELECT
  COUNT(*) as cohort_size,
  COUNT(CASE WHEN is_active_7d THEN 1 END) as retained_users,
  ROUND(100.0 * COUNT(CASE WHEN is_active_7d THEN 1 END) / NULLIF(COUNT(*), 0), 2) as retention_rate_7d
FROM cohort;

-- ========================================
-- 10. REVENUE POTENTIAL
-- ========================================

-- Estimated MRR (Monthly Recurring Revenue)
-- Assumes: Premium = $15/mo, Platinum = $30/mo
SELECT
  SUM(CASE
    WHEN tier = 'platinum' THEN 30
    WHEN tier = 'premium' THEN 15
    ELSE 0
  END) as estimated_mrr_usd
FROM subscriptions
WHERE status = 'active'
  AND (expires_at IS NULL OR expires_at > NOW());
