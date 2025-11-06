# Automatic Push Notification System

## Overview

Your Accord app now has a fully automated push notification system that sends real-time notifications to users' phones when important events occur. The system runs entirely on your Supabase backend and requires no manual intervention.

## How It Works

### 1. **Database Triggers** (Automatic Event Detection)

When specific actions happen in your database, triggers automatically queue notifications:

- **Someone likes you** → Triggers `notify_on_like()` → Queues "X likes you! 💜" notification (Premium/Platinum users only)
- **New match** → Triggers `notify_on_match()` → Queues "It's a Match! 💜" notification to both users
- **New message** → Triggers `notify_on_message()` → Queues "New message from X" notification
- **You're hot!** → Triggers `check_hot_profile_notification()` → When someone gets 5+ likes in an hour, queues "You're on fire! 🔥" notification

### 2. **Notification Queue** (Database Table)

All notifications are stored in the `notification_queue` table with:
- Recipient profile ID
- Notification type (new_like, new_match, new_message, hot_profile)
- Title and body text
- Additional data (matchId, senderId, etc.)
- Status (pending, sent, failed)
- Retry attempts (max 3)

### 3. **Edge Function** (Notification Processor)

The `process-notifications` Edge Function runs every minute via cron job and:
- Fetches up to 50 pending notifications
- Checks if recipient has notifications enabled and a push token
- Sends notifications via Expo Push API
- Updates notification status (sent/failed)
- Retries failed notifications up to 3 times

### 4. **Notification History** (Database Table)

All sent notifications are logged in the `push_notifications` table for:
- User notification history/inbox
- Read/unread tracking
- Analytics

## Notification Types

| Type | Trigger | Title | When Sent |
|------|---------|-------|-----------|
| `new_like` | Someone likes your profile | "X likes you! 💜" | Premium/Platinum users only |
| `new_match` | Mutual like creates match | "It's a Match! 💜" | Always (both users) |
| `new_message` | Message received | "New message from X" | Always |
| `hot_profile` | 5+ likes in 1 hour | "You're on fire! 🔥" | First time hitting threshold |

## User Controls

Users can control notifications through their profile settings:
- `push_enabled` (boolean) - Master on/off switch
- `push_token` (text) - Device token for sending notifications

## Testing

To test the notification system:

1. **Manual Test** - Insert a notification directly:
```sql
SELECT queue_notification(
  'recipient-profile-id'::uuid,
  'new_match',
  'Test Match! 💜',
  'This is a test notification',
  '{"matchId": "test-123"}'::jsonb
);
```

2. **Real Test** - Trigger an actual event:
   - Create a match between two profiles
   - Send a message
   - Like a profile (if you're premium/platinum)

3. **Check Queue**:
```sql
SELECT * FROM notification_queue ORDER BY created_at DESC LIMIT 10;
```

4. **Check History**:
```sql
SELECT * FROM push_notifications ORDER BY created_at DESC LIMIT 10;
```

## Monitoring

### Check Cron Job Status
```sql
SELECT * FROM cron.job WHERE jobname = 'process-notifications-every-minute';
```

### View Recent Cron Runs
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-notifications-every-minute')
ORDER BY start_time DESC LIMIT 10;
```

### Check Failed Notifications
```sql
SELECT * FROM notification_queue
WHERE status = 'failed'
ORDER BY created_at DESC;
```

## Architecture

```
User Action (like/match/message)
    ↓
Database Trigger Fires
    ↓
queue_notification() Function Called
    ↓
Notification Added to notification_queue Table
    ↓
Cron Job (Every Minute)
    ↓
Edge Function: process-notifications
    ↓
Fetch Profile's push_token
    ↓
Send to Expo Push API
    ↓
Update notification_queue status
    ↓
User Receives Push Notification on Phone! 📱
```

## Database Schema

### notification_queue
- `id` - UUID primary key
- `recipient_profile_id` - FK to profiles
- `notification_type` - Type of notification
- `title` - Notification title
- `body` - Notification body
- `data` - JSONB with extra data
- `status` - pending/sent/failed
- `attempts` - Retry count
- `error` - Error message if failed
- `created_at` - When queued
- `processed_at` - When sent

### push_notifications
- `id` - UUID primary key
- `profile_id` - FK to profiles
- `notification_type` - Type of notification
- `title` - Notification title
- `body` - Notification body
- `data` - JSONB with extra data
- `is_read` - Read status
- `read_at` - When marked as read
- `sent_at` - When sent
- `created_at` - When created

## Customization

To add new notification types:

1. Create a new trigger function
2. Call `queue_notification()` with your custom type, title, and body
3. Attach trigger to appropriate table event

Example:
```sql
CREATE OR REPLACE FUNCTION notify_on_profile_view() RETURNS TRIGGER AS $$
BEGIN
  PERFORM queue_notification(
    NEW.viewed_profile_id,
    'profile_view',
    'Someone viewed your profile! 👀',
    'Someone is checking you out!',
    jsonb_build_object('viewerId', NEW.viewer_profile_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Important Notes

- Notifications are only sent to users with `push_enabled = true` and a valid `push_token`
- The system automatically handles retries (max 3 attempts)
- Failed notifications after 3 attempts are marked as 'failed' and logged
- The cron job runs every minute, so there's up to 60 seconds delay
- Like notifications are only sent to Premium/Platinum subscribers
- All notifications are logged for user notification history

## Troubleshooting

**Notifications not being sent?**
1. Check if Edge Function is deployed: `mcp__supabase__list_edge_functions`
2. Check if cron job is running: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;`
3. Check for errors in notification_queue: `SELECT * FROM notification_queue WHERE error IS NOT NULL;`
4. Verify user has push_token and push_enabled = true

**Notifications delayed?**
- The cron job runs every minute, so expect up to 60 seconds delay
- For instant notifications, you could call the Edge Function directly from your app

**Want to disable notifications temporarily?**
```sql
SELECT cron.unschedule('process-notifications-every-minute');
```

**Want to re-enable?**
```sql
SELECT cron.schedule(
  'process-notifications-every-minute',
  '* * * * *',
  'SELECT trigger_notification_processing();'
);
```
