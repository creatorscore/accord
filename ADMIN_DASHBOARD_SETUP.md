# Accord Admin Dashboard Setup Guide

## Overview
The admin dashboard allows you to review and manage user reports, view reported profiles, and take moderation actions.

## ✅ Completed Setup Steps

The following have already been set up for you:

1. ✅ Added `is_admin` column to profiles table
2. ✅ Created RLS policies for admin access to reports and blocks
3. ✅ Created admin dashboard HTML file

## 🔧 Setup Instructions

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your **accord** project
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** (e.g., `https://xcaktvlosjsaxcntxbyf.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### Step 2: Update the Admin Dashboard

1. Open `/Users/vfranz/accord/admin-dashboard.html` in a text editor
2. Find these lines (around line 624):
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
3. Replace with your actual credentials:
   ```javascript
   const SUPABASE_URL = 'https://xcaktvlosjsaxcntxbyf.supabase.co';
   const SUPABASE_ANON_KEY = 'your-actual-anon-key-here';
   ```

### Step 3: Make Yourself an Admin

You need to set your profile as admin in the database:

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this query (replace with your email):
   ```sql
   UPDATE profiles
   SET is_admin = true
   WHERE user_id IN (
     SELECT id FROM auth.users WHERE email = 'your-email@example.com'
   );
   ```
3. You should see: `UPDATE 1` (meaning 1 row was updated)

### Step 4: Access the Dashboard

**Option A: Open Locally**
1. Simply double-click `admin-dashboard.html` to open in your browser
2. Sign in with your Accord account credentials
3. You should now see the admin dashboard!

**Option B: Host Online (Recommended for production)**
1. Upload `admin-dashboard.html` to a hosting service:
   - Vercel: `vercel --prod admin-dashboard.html`
   - Netlify: Drag and drop the file
   - GitHub Pages: Push to repo and enable Pages
2. Access via the hosted URL

## 📊 Dashboard Features

### Statistics Cards
- **Pending Reports**: New reports waiting for review
- **Under Review**: Reports you're actively investigating
- **Resolved**: Reports that have been handled
- **Dismissed**: Reports that were determined to be invalid

### Tabs
- **Pending**: All new reports that need attention
- **Under Review**: Reports you've marked for investigation
- **Resolved**: Successfully handled reports
- **Dismissed**: Reports that were invalid or not actionable

### Report Actions
- **View Profile**: See full details of the reported user
- **Mark Reviewing**: Move report to "Under Review" status
- **Resolve**: Mark report as handled (use after taking action)
- **Dismiss**: Dismiss invalid or spam reports

## 🔒 Security Notes

1. **Admin Access**: Only users with `is_admin = true` can access the dashboard
2. **RLS Policies**: Supabase Row Level Security ensures admins can only access reports/blocks
3. **Authentication**: Uses Supabase Auth - same as your mobile app
4. **HTTPS**: Always access via HTTPS in production

## 🚀 Typical Workflow

1. **Review Pending Reports**: Check the "Pending" tab daily
2. **Investigate**: Click "View Profile" to see reported user details
3. **Mark as Reviewing**: Move to "Under Review" while investigating
4. **Take Action**:
   - If legitimate: Handle the issue (ban user, delete content, etc.) then mark "Resolved"
   - If invalid: Click "Dismiss"

## 🛠️ Additional Admin Actions

### Viewing Blocked Users
Add this query in Supabase SQL Editor to see all blocks:
```sql
SELECT
  b.created_at,
  blocker.display_name as blocker_name,
  blocked.display_name as blocked_name,
  b.reason
FROM blocks b
JOIN profiles blocker ON b.blocker_profile_id = blocker.id
JOIN profiles blocked ON b.blocked_profile_id = blocked.id
ORDER BY b.created_at DESC;
```

### Manually Banning a User
```sql
UPDATE profiles
SET is_active = false
WHERE id = 'profile-id-here';
```

### Viewing All Reports for a Specific User
```sql
SELECT
  r.*,
  reporter.display_name as reporter_name,
  reported.display_name as reported_name
FROM reports r
JOIN profiles reporter ON r.reporter_profile_id = reporter.id
JOIN profiles reported ON r.reported_profile_id = reported.id
WHERE r.reported_profile_id = 'profile-id-here'
ORDER BY r.created_at DESC;
```

## 📝 Database Schema Reference

### Reports Table
```sql
- id: UUID (primary key)
- reporter_profile_id: UUID (who reported)
- reported_profile_id: UUID (who was reported)
- reason: TEXT (why they reported)
- status: VARCHAR ('pending', 'reviewing', 'resolved', 'dismissed')
- created_at: TIMESTAMP
- resolved_at: TIMESTAMP
```

### Blocks Table
```sql
- id: UUID (primary key)
- blocker_profile_id: UUID (who blocked)
- blocked_profile_id: UUID (who was blocked)
- reason: TEXT
- created_at: TIMESTAMP
```

## 🆘 Troubleshooting

### "You do not have admin privileges"
- Make sure you ran the UPDATE query in Step 3
- Verify with: `SELECT * FROM profiles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'your-email@example.com');`
- Check that `is_admin` column shows `true`

### "No reports showing"
- Check that reports exist: `SELECT COUNT(*) FROM reports;`
- Verify RLS policies are active
- Check browser console for errors (F12)

### Can't update report status
- Ensure RLS policies were created (Step 2 from earlier migration)
- Check that you're logged in as admin
- Verify network connection

## 🔄 Future Enhancements

You can easily extend this dashboard to:
- Ban users directly from the dashboard
- View user message history
- Send warnings to users
- Export reports to CSV
- Add admin notes to reports
- Set up email notifications for new reports

## 📧 Support

If you need help, you can:
1. Check Supabase logs for errors
2. Use browser DevTools (F12) to see console errors
3. Verify RLS policies in Supabase Dashboard → Authentication → Policies
