# Firebase Analytics Setup for Google Ads Conversion Tracking

This guide will help you complete the Firebase Analytics setup for tracking subscription purchases in Google Ads.

## Current Status

✅ **Android Configuration**: Already set up
⚠️ **iOS Configuration**: Needs GoogleService-Info.plist
✅ **Firebase Analytics SDK**: Installed
✅ **Purchase Tracking**: Implemented in code

## Required Steps

### Step 1: Download iOS Configuration File

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **accord-24f3f**
3. Click on the **Settings gear icon** → **Project settings**
4. Scroll down to "Your apps" section
5. Click on the **iOS app** (bundle ID: `com.privyreviews.accord`)
   - If iOS app doesn't exist, click "Add app" and create one with bundle ID: `com.privyreviews.accord`
6. Download the **GoogleService-Info.plist** file
7. Place it in the project root: `/Users/vfranz/accord/GoogleService-Info.plist`

### Step 2: Verify Configuration Files

After downloading, verify you have both files in the root directory:

```bash
ls -la | grep -E 'google-services.json|GoogleService-Info.plist'
```

You should see:
- ✅ `google-services.json` (already present)
- ⚠️ `GoogleService-Info.plist` (needs to be downloaded)

### Step 3: Link Firebase to Google Ads

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **accord-24f3f**
3. Click **Integrations** in the left sidebar
4. Find **Google Ads** and click **Link**
5. Select your Google Ads account
6. Choose conversion events to track:
   - ✅ `purchase` (in-app purchases)
   - ✅ `subscription_purchase` (custom event)
7. Click **Link accounts**

### Step 4: Set Up Google Ads Conversions

1. Go to [Google Ads](https://ads.google.com)
2. Click **Tools & Settings** → **Conversions**
3. Click the **+** button to create a new conversion action
4. Select **App** → **Imported from Firebase Analytics**
5. Choose conversion events:
   - **purchase**: Track all subscription purchases
   - **subscription_purchase**: Track with additional subscription metadata
6. Set conversion values:
   - Use dynamic values from Firebase (recommended)
   - Or set a fixed value per conversion
7. Click **Save and continue**

### Step 5: Test Purchase Tracking (After Next Build)

After rebuilding the app with the new configuration:

1. Make a test subscription purchase
2. Wait 2-3 hours for data to process
3. Check Firebase Console → **Analytics** → **Events** → Look for:
   - `purchase` event
   - `subscription_purchase` event
4. Check Google Ads → **Conversions** → Look for Firebase conversions

## Firebase Events Being Tracked

| Event Name | When Triggered | Data Sent |
|------------|----------------|-----------|
| `purchase` | Subscription purchase completed | Price, currency, product ID, tier |
| `subscription_purchase` | Custom event for subscription tracking | Product ID, tier, platform, transaction ID |
| `app_open` | App is opened (optional - not yet implemented) | - |
| `screen_view` | User views a screen (optional - not yet implemented) | Screen name |

## How Purchase Tracking Works

When a user completes a subscription purchase:

1. **RevenueCat** processes the purchase → returns `CustomerInfo`
2. **Firebase Analytics** logs two events:
   - `purchase` event (standard e-commerce event)
   - `subscription_purchase` event (custom event with extra metadata)
3. **Google Ads** receives the conversion data from Firebase
4. **Conversion is attributed** to the ad campaign that brought the user

Code location: `lib/revenue-cat.ts` lines 115-140

## Privacy & Compliance

Firebase Analytics respects user privacy:

- ✅ No personally identifiable information (PII) is sent
- ✅ User IDs are anonymized
- ✅ Complies with Apple's App Tracking Transparency
- ✅ GDPR compliant (data retention: 14 months by default)

Accord's `NSUserTrackingUsageDescription` in Info.plist:
> "We use this to understand which features work best and improve your match quality. Your personal information always stays private."

## Troubleshooting

### "No conversions showing in Google Ads"

1. Wait 24-48 hours for data to sync
2. Verify Firebase → Google Ads linking is active
3. Check Firebase Console → Events → Make sure `purchase` events are appearing
4. Verify Google Ads conversion action is set to "Active"

### "iOS builds failing with missing GoogleService-Info.plist"

1. Download the plist file from Firebase Console
2. Place it in the project root (same directory as `google-services.json`)
3. Do NOT add it to `.gitignore` - it's safe to commit (contains public config)

### "Purchase events not appearing in Firebase"

1. Check app logs for: `✅ Purchase event tracked to Firebase Analytics`
2. If you see errors, verify Firebase SDK is initialized correctly
3. Make sure `@react-native-firebase/app` and `@react-native-firebase/analytics` plugins are in `app.json`

## Next Build Requirements

After adding `GoogleService-Info.plist`, you MUST rebuild the app:

```bash
# For both platforms (recommended)
eas build --platform all --profile production

# Or separately
eas build --platform ios --profile production
eas build --platform android --profile production
```

**Note**: Development builds (`expo start`) will NOT work until Firebase config files are in place.

## Support Resources

- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
- [Google Ads Conversion Tracking](https://support.google.com/google-ads/answer/6331304)
- [Firebase + Google Ads Integration](https://firebase.google.com/docs/analytics/google-ads)

---

**Last Updated**: December 24, 2025
**Firebase Project**: accord-24f3f
**Firebase Project Number**: 571181499525
