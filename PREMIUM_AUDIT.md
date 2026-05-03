# Premium Feature Audit — February 2026

## Overview

**Audit Date:** 2026-02-16
**Total Users:** 10,039 (3,818 active complete)
**Paying Subscribers:** 78 active + 31 trial = 109 total
**Users with is_premium = true:** 105

---

## CRITICAL: Active Exploitation Found

| Issue | Users Exploiting | Severity |
|---|---|---|
| Daily like limit bypass (5/day) | **260 free users** (never subscribed) exceeding limit. Worst: 141 likes/day | **CRITICAL** |
| Incognito mode after sub expiry | **9 expired subscribers** still hidden from discovery | **HIGH** |
| Super likes without premium | **57 users** sent super likes while free (56 expired, 1 never subscribed) | **HIGH** |

---

## Root Cause: ALL Premium Gates Are Client-Side Only

Every premium feature check is a JavaScript `if (isPremium)` in the React Native app. There is **zero server-side enforcement**. Any user with a custom API client, modified app bundle, or cleared AsyncStorage can bypass every gate.

### The Daily Like Limit Problem

The 5 likes/day limit for free users is stored in **AsyncStorage on the device** — not the database. The `profiles.daily_likes_count` and `profiles.daily_likes_reset_date` columns exist in the schema but are **never written to or checked**. Clearing app cache, reinstalling, or switching devices resets the counter to 0.

### The Subscription Expiry Problem

When a subscription expires, `is_premium` is set to `false` but premium **side-effects are never cleaned up**:
- `incognito_mode` stays `true` (user invisible for free)
- `search_globally` stays `true`
- `discovery_filters` JSONB retains premium filter values

---

## Feature-by-Feature Breakdown

### Features with NO server-side enforcement

| Feature | Premium Tier | Client Gate | Server Gate | Exploitable? |
|---|---|---|---|---|
| **Unlimited likes (5/day limit)** | Premium | AsyncStorage counter | NONE | YES — clear cache or direct API |
| **Super likes** | Premium | `if (!isPremium)` alert | NONE — no `like_type` check in RLS | YES — direct API insert |
| **Rewind (undo swipe)** | Premium | `if (!isPremium)` alert | NONE — DELETE allowed on own records | YES — direct API delete |
| **Profile boost** | Platinum | `if (!isPlatinum)` alert | **NO RLS ON TABLE** | YES — direct API insert |
| **Incognito mode** | Premium | `if (!isPremium)` paywall | NONE — UPDATE allowed on own profile | YES — direct API update |
| **Voice messages** | Premium | `if (!isPremium)` paywall | NONE — no `content_type` check in RLS | YES — direct API insert |
| **Message delete** | Premium | `if (!isPremium)` paywall | NONE — DELETE allowed on own messages | YES — direct API delete |
| **Message reactions** | Premium | `if (!isPremium)` alert | NONE — INSERT allowed | YES — direct API insert |
| **See who liked you** | Premium | Blurred UI overlay | NONE — `likes` SELECT returns all data | YES — direct API query |
| **Read receipts** | Premium | Display hidden for free | N/A — `read_at` written for all users | Display-only gate |
| **Typing indicator** | Premium | `if (!isPremium)` skip | N/A — Realtime broadcast only | Requires custom client |
| **Advanced filters** | Premium | UI disabled + query skips | NONE — client-side query building | Moderate — requires API knowledge |
| **Global search** | Premium | Settings strips value on save | NONE — can update `preferences` directly | YES — direct API update |

### Features with partial server enforcement

| Feature | Notes |
|---|---|
| **Like notifications** | Server checks `is_premium` to personalize notification content (name vs anonymous) |
| **Subscription expiry** | `expire-subscriptions` edge function + DB trigger clear `is_premium` flag |

---

## Fixes Required

### P0 — Daily Like Limit (server-side enforcement)

**Status:** FIXED (2026-02-10)
**Impact:** 260+ free users bypassing the core monetization gate

- [x] Create DB function `enforce_daily_like_limit()` that enforces 5 likes/day for non-premium users
- [x] Create BEFORE INSERT trigger on `likes` table that calls the function
- [x] Use `profiles.daily_likes_count` and `profiles.daily_likes_reset_date` columns (already exist, unused)
- [x] Add pg_cron job to reset daily counts at midnight UTC
- [x] Add client-side error handling to show paywall on `P0001` trigger error

### P1 — Revoke Premium Features on Subscription Expiry

**Status:** FIXED (2026-02-10)
**Impact:** 9+ users retaining premium features after cancellation

- [x] Create `revoke_premium_features_on_expiry()` trigger on profiles — auto-revokes incognito, search_globally when `is_premium` changes to false
- [x] Run one-time cleanup for existing expired subscribers (verified 0 remaining)

### P2 — RLS Policies for Premium Features

**Status:** FIXED (2026-02-10)
**Impact:** All premium features bypassable via direct API

- [x] **Super likes**: BEFORE INSERT OR UPDATE trigger on `likes` blocks `like_type = 'super_like'` for non-premium users
- [x] **Boosts**: RLS enabled on `boosts` table + premium-only INSERT policy
- [x] **Incognito mode**: BEFORE UPDATE trigger on `profiles` validates `incognito_mode = true` requires premium
- [x] **Voice messages**: BEFORE INSERT trigger on `messages` blocks `content_type = 'voice'` for non-premium users
- [x] Client-side error handling added for all: paywall shown on server rejection

### P3 — See Who Liked You (server-side)

**Status:** FIXED (2026-02-16)
**Impact:** Any free user can query the `likes` table to see who liked them

- [x] Dropped overly permissive "Users can view likes involving them" and "Free users check specific likes for matching" SELECT policies
- [x] Only 3 policies remain: "Users view likes they sent" (SELECT), "Premium users view received likes" (SELECT), "Users can create own likes" (INSERT)
- [x] Added DELETE and UPDATE policies for rewind and super-like upgrade
- [x] Created `check_mutual_like(UUID)` SECURITY DEFINER RPC — matching flow works for all users without exposing who liked them
- [x] Created `count_unmatched_received_likes()` SECURITY DEFINER RPC — returns count only, no profile IDs
- [x] Updated `discover.tsx`, `profile/[id].tsx`, `matches.tsx`, `NotificationContext.tsx`, `likes.tsx` to use RPCs
- [x] Free users see "X people like you" count but cannot see profiles; premium users get full details

### P4 — Existing Exploiter Cleanup

**Status:** FIXED (2026-02-10)

- [x] Set `incognito_mode = false` for all 9 expired subscribers still using it (verified 0 remaining)
- [x] Set `search_globally = false` for expired subscribers still using it (verified 0 remaining)
- [x] Auto-revoke trigger prevents future occurrences

---

## Architecture Recommendation

Long-term, premium enforcement should follow this pattern:

1. **Database triggers** for INSERT/UPDATE operations (likes, boosts, messages)
2. **RLS WITH CHECK clauses** for direct API access control
3. **Client-side checks** for UI/UX (disable buttons, show paywalls) — but these are just the friendly layer, not the enforcement layer

The client should NEVER be trusted as the only enforcement point for paid features.
