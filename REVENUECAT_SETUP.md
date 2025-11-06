# RevenueCat & Subscription Setup Guide

## 📅 Timeline Overview

**This setup can ONLY be done after you have:**
- ✅ Paid Apple Developer Account ($99/year)
- ✅ App submitted to App Store Connect
- ✅ Google Play Console account ($25 one-time)

**Estimated Time:** 2-3 days (includes Apple review time for products)

---

## Phase 1: Apple Developer Account (Do This First)

### Step 1.1: Enroll in Apple Developer Program
1. Go to https://developer.apple.com/programs/
2. Click "Enroll"
3. Pay $99/year
4. Wait for approval (usually 24-48 hours)

### Step 1.2: Create App in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Fill in app details:
   - **Platform:** iOS
   - **Name:** Accord
   - **Primary Language:** English
   - **Bundle ID:** Create new (e.g., com.yourcompany.accord)
   - **SKU:** accord-ios
   - **User Access:** Full Access

---

## Phase 2: Create Subscription Products (Apple)

### Step 2.1: Create Subscription Group
1. In App Store Connect → Your App → Features → In-App Purchases
2. Click "Manage" next to Subscriptions
3. Click "+" to create new Subscription Group
4. **Group Name:** Accord Premium
5. Click "Create"

### Step 2.2: Create Premium Monthly Subscription
1. Click "+" in your subscription group
2. Fill in details:
   - **Reference Name:** Premium Monthly
   - **Product ID:** `premium_monthly` (MUST match code)
   - **Subscription Duration:** 1 Month
   - **Subscription Prices:** $14.99 USD (add all territories)
   - **Introductory Offer:**
     - Type: Free Trial
     - Duration: 7 Days
     - Eligible customers: New customers only

3. Add Localization:
   - **Display Name:** Accord Premium
   - **Description:** Unlimited swipes, see who liked you, advanced filters, and more!

4. Click "Create"

### Step 2.3: Create Premium Annual Subscription
Same as above but:
- **Reference Name:** Premium Annual
- **Product ID:** `premium_annual`
- **Duration:** 1 Year
- **Price:** $119.99 USD
- **Free Trial:** 7 Days

### Step 2.4: Create Platinum Monthly Subscription
Same as Premium Monthly but:
- **Reference Name:** Platinum Monthly
- **Product ID:** `platinum_monthly`
- **Price:** $24.99 USD

### Step 2.5: Create Platinum Annual Subscription
Same as Premium Annual but:
- **Reference Name:** Platinum Annual
- **Product ID:** `platinum_annual`
- **Price:** $199.99 USD

### Step 2.6: Submit Products for Review
1. Click "Submit for Review" for each product
2. Wait 24-48 hours for Apple approval
3. **IMPORTANT:** Products must be approved before testing

---

## Phase 3: Get Apple API Keys (For RevenueCat)

### Step 3.1: App Store Connect API Key
1. Go to App Store Connect → Users and Access → Keys
2. Click "+" to generate new key
3. **Name:** RevenueCat Integration
4. **Access:** App Manager
5. Click "Generate"
6. **Download the .p8 file** (you can only do this once!)
7. Note the following (you'll need these):
   - **Key ID:** (e.g., ABC123DEF4)
   - **Issuer ID:** (e.g., 12345678-1234-1234-1234-123456789012)

### Step 3.2: Shared Secret (For Subscription Validation)
1. Go to App Store Connect → Your App → General → App Information
2. Scroll to "App-Specific Shared Secret"
3. Click "Generate" if not already created
4. Copy the shared secret (long string of characters)

---

## Phase 4: Google Play Console Setup

### Step 4.1: Create Google Play Developer Account
1. Go to https://play.google.com/console
2. Pay $25 one-time fee
3. Complete account setup

### Step 4.2: Create App in Play Console
1. Click "Create app"
2. Fill in details:
   - **App name:** Accord
   - **Default language:** English
   - **App or game:** App
   - **Free or paid:** Free
3. Complete declarations

### Step 4.3: Create Subscription Products
1. Go to Monetize → Products → Subscriptions
2. Click "Create subscription"
3. Create 4 products matching iOS:

**Premium Monthly:**
- **Product ID:** `premium_monthly`
- **Name:** Accord Premium
- **Description:** Unlimited swipes, see who liked you, and more
- **Billing period:** 1 month
- **Price:** $14.99 USD
- **Free trial:** 7 days
- **Grace period:** 3 days

**Premium Annual:**
- **Product ID:** `premium_annual`
- **Billing period:** 1 year
- **Price:** $119.99 USD

**Platinum Monthly:**
- **Product ID:** `platinum_monthly`
- **Price:** $24.99 USD

**Platinum Annual:**
- **Product ID:** `platinum_annual`
- **Price:** $199.99 USD

### Step 4.4: Enable Google Play Billing API
1. Go to Google Cloud Console
2. Enable Google Play Android Developer API
3. Create Service Account
4. Download JSON key file

---

## Phase 5: RevenueCat Setup

### Step 5.1: Create RevenueCat Account
1. Go to https://www.revenuecat.com
2. Sign up for free account
3. Create new project: "Accord"

### Step 5.2: Configure iOS (Apple)
1. In RevenueCat Dashboard → Project Settings → Apple App Store
2. Upload your .p8 key file
3. Enter:
   - **Key ID:** (from Step 3.1)
   - **Issuer ID:** (from Step 3.1)
   - **Bundle ID:** com.yourcompany.accord
4. Enter Shared Secret (from Step 3.2)
5. Click "Save"

### Step 5.3: Configure Android (Google Play)
1. In RevenueCat Dashboard → Project Settings → Google Play Store
2. Upload service account JSON file
3. Enter package name (e.g., com.yourcompany.accord)
4. Click "Save"

### Step 5.4: Create Entitlements
1. Go to Entitlements tab
2. Create two entitlements:

**Entitlement 1:**
- **Identifier:** `premium`
- **Description:** Premium features

**Entitlement 2:**
- **Identifier:** `platinum`
- **Description:** Platinum features

### Step 5.5: Create Products in RevenueCat
1. Go to Products tab
2. Click "New" for each product:

**Product 1:**
- **Identifier:** `premium_monthly`
- **App Store Product ID:** premium_monthly
- **Google Play Product ID:** premium_monthly
- **Type:** Subscription
- **Attach to Entitlement:** premium

Repeat for:
- `premium_annual` → premium entitlement
- `platinum_monthly` → platinum entitlement
- `platinum_annual` → platinum entitlement

### Step 5.6: Create Offering
1. Go to Offerings tab
2. Create offering:
   - **Identifier:** `default`
   - **Description:** Default offering
3. Add packages:
   - Monthly: `premium_monthly`
   - Annual: `premium_annual`
4. Make it the current offering

### Step 5.7: Get API Keys
1. Go to API Keys tab
2. Copy:
   - **iOS API Key** (starts with `appl_`)
   - **Android API Key** (starts with `goog_`)

---

## Phase 6: Configure Your App

### Step 6.1: Add API Keys to Environment
Create/update `.env.production`:

```bash
# RevenueCat API Keys
EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=appl_xxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=goog_xxxxxxxxxxxxxxxxxxxx
```

### Step 6.2: Update Bundle Identifier
Update `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.accord"
    },
    "android": {
      "package": "com.yourcompany.accord"
    }
  }
}
```

### Step 6.3: Build Production Version
```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

---

## Phase 7: Testing

### Test on iOS (TestFlight)
1. Upload build to TestFlight
2. Add test users
3. Enable sandbox testing in Settings → App Store
4. Test:
   - [ ] View paywall
   - [ ] Purchase premium monthly
   - [ ] Verify features unlock
   - [ ] Cancel subscription
   - [ ] Restore purchase
   - [ ] Test free trial

### Test on Android (Internal Testing)
1. Upload build to Play Console Internal Testing
2. Add test users
3. Create test license for Google Play
4. Same tests as iOS

---

## Phase 8: Production Deployment

### Pre-Launch Checklist:
- [ ] All 4 products approved by Apple
- [ ] All 4 products active on Google Play
- [ ] RevenueCat shows "Connected" for both stores
- [ ] API keys added to production environment
- [ ] Tested on real devices (not simulator)
- [ ] Verified subscription sync to database
- [ ] Legal pages updated (Terms, Privacy)

### Go Live:
1. Submit app to App Store
2. Submit app to Google Play
3. Monitor RevenueCat dashboard for transactions
4. Check Supabase database for subscription updates

---

## Current Status (Development Mode)

✅ **What Works Now:**
- Paywall UI displays correctly
- Free users see swipe limits
- Premium features gate properly
- Database-based premium status for testing

⏳ **What Needs Setup (Above Steps):**
- RevenueCat account
- Apple/Google products
- Real payment processing
- Production API keys

---

## Support & Documentation

- **RevenueCat Docs:** https://docs.revenuecat.com
- **Apple Documentation:** https://developer.apple.com/documentation/storekit
- **Google Play Billing:** https://developer.android.com/google/play/billing
- **Test Cards:** Use sandbox accounts, no real charges during development

---

## Estimated Costs

- Apple Developer: $99/year
- Google Play Developer: $25 one-time
- RevenueCat: Free for first $10k MRR
- **Total Initial:** $124

---

## Questions?

Before starting, make sure you have:
1. Legal business entity (for App Store)
2. Tax information ready
3. Bank account for payouts
4. Content ratings completed
5. Privacy policy URL
6. Terms of service URL
