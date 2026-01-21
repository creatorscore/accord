# Match Expiration Push Notifications - Setup Guide

This guide will help you complete the setup for push notifications that warn users about expiring matches.

## What Was Built

1. **Database Migration** - Adds tracking fields to know which notifications have been sent
2. **Edge Function** - Checks for expiring matches and queues push notifications
3. **Notification Schedule** - Sends warnings at 5 days, 3 days, and 1 day before expiration

## Setup Steps

### 1. Apply Database Migration

**File**: `supabase/migrations/20260107050000_add_expiration_notifications.sql`

**Option A: Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/kdkjlrpfruyyufqwkjio/sql/new
2. Copy the contents of the migration file
3. Paste and run

**Option B: Supabase CLI**
```bash
# From project root
supabase db push
```

The migration adds these columns to the `matches` table:
- `notified_5_days` (boolean) - Tracks 5-day warning sent
- `notified_3_days` (boolean) - Tracks 3-day warning sent
- `notified_1_day` (boolean) - Tracks 1-day warning sent

### 2. Deploy Edge Function

**File**: `supabase/functions/check-expiring-matches/index.ts`

```bash
# Deploy the function
supabase functions deploy check-expiring-matches

# Verify deployment
supabase functions list
```

### 3. Set Up Cron Schedule

The function needs to run every 4 hours to check for expiring matches.

**Option A: Supabase Dashboard**
1. Go to Database → Cron Jobs
2. Create new cron job:
   - **Name**: `check-expiring-matches`
   - **Schedule**: `0 */4 * * *` (every 4 hours)
   - **Command**:
   ```sql
   SELECT
     net.http_post(
       url:='https://kdkjlrpfruyyufqwkjio.supabase.co/functions/v1/check-expiring-matches',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
       body:='{}'::jsonb
     ) as request_id;
   ```

**Option B: SQL Direct**
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job (runs every 4 hours)
SELECT cron.schedule(
  'check-expiring-matches',
  '0 */4 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://kdkjlrpfruyyufqwkjio.supabase.co/functions/v1/check-expiring-matches',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### 4. Verify Setup

**Test the Edge Function manually:**
```bash
# Test locally
supabase functions serve check-expiring-matches

# Or test deployed version
curl -X POST https://kdkjlrpfruyyufqwkjio.supabase.co/functions/v1/check-expiring-matches \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Check cron jobs:**
```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Check cron job history
SELECT * FROM cron.job_run_details
WHERE jobname = 'check-expiring-matches'
ORDER BY start_time DESC
LIMIT 10;
```

## How It Works

### Notification Timeline

For a match created on **Day 0** that expires on **Day 7**:

- **Day 2** (5 days left): First notification - "Your match expires in 5 days"
- **Day 4** (3 days left): Second notification - "Your match expires in 3 days"
- **Day 6** (1 day left): Final warning - "Match expires in 24 hours!"

### Notification Flow

1. **Cron Job Runs** (every 4 hours)
   - Edge function `check-expiring-matches` executes

2. **Find Expiring Matches**
   - Query matches where:
     - `status = 'active'`
     - `first_message_sent_at IS NULL` (no message yet)
     - `expires_at` is within notification window
     - Notification not already sent for this window

3. **Queue Notifications**
   - Add to `notification_queue` table
   - Both users in match get notified
   - Mark notification as sent in `matches` table

4. **Send Push Notifications**
   - Existing `process-notifications` function handles delivery
   - Runs every minute
   - Sends via Expo Push Notification service

### Notification Messages

**5 Days Remaining:**
```
Title: ⏰ Match expires in 5 days
Body: Your match with [Name] expires in 5 days. Don't miss out - send a message!
```

**3 Days Remaining:**
```
Title: ⏰ Match expires in 3 days
Body: Your match with [Name] expires in 3 days. Don't miss out - send a message!
```

**1 Day Remaining:**
```
Title: ⏰ Match expires in 24 hours!
Body: Your match with [Name] expires tomorrow! Send a message now to keep the connection.
```

## Monitoring

### Check Notification Queue
```sql
-- See pending notifications
SELECT * FROM notification_queue
WHERE notification_type = 'match_expiring'
AND status = 'pending'
ORDER BY created_at DESC;

-- See sent notifications
SELECT * FROM notification_queue
WHERE notification_type = 'match_expiring'
AND status = 'sent'
ORDER BY processed_at DESC
LIMIT 100;
```

### Check Match Notification Status
```sql
-- See which matches have been notified
SELECT
  id,
  expires_at,
  notified_5_days,
  notified_3_days,
  notified_1_day,
  first_message_sent_at
FROM matches
WHERE expires_at IS NOT NULL
ORDER BY expires_at ASC
LIMIT 50;
```

### Edge Function Logs
```bash
# View function logs
supabase functions logs check-expiring-matches

# Or in Supabase Dashboard:
# Edge Functions → check-expiring-matches → Logs
```

## Troubleshooting

### Notifications Not Sending

1. **Check cron job is running:**
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobname = 'check-expiring-matches'
   ORDER BY start_time DESC;
   ```

2. **Check edge function logs:**
   ```bash
   supabase functions logs check-expiring-matches --tail
   ```

3. **Verify notification queue:**
   ```sql
   SELECT * FROM notification_queue
   WHERE notification_type = 'match_expiring'
   AND status = 'failed';
   ```

### Test with Real Data

Create a test match that expires soon:
```sql
-- Update an existing match to expire in 2 days
UPDATE matches
SET
  expires_at = NOW() + INTERVAL '2 days',
  first_message_sent_at = NULL,
  notified_5_days = false,
  notified_3_days = false,
  notified_1_day = false
WHERE id = 'YOUR_MATCH_ID';

-- Then manually trigger the edge function
-- Notification should be queued within 4 hours (or immediately if you trigger manually)
```

## Next Steps

After setup is complete, the notifications will automatically:
- Run every 4 hours checking for expiring matches
- Send personalized push notifications to both users
- Track which notifications have been sent to avoid duplicates
- Integrate with existing notification queue system

No additional app changes needed - push notifications will automatically appear on users' devices!
