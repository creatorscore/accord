# Accord Development Checklist

**Target Launch**: November 10, 2025 (5 weeks)
**Goal**: $40K MRR by Month 3

---

## 📅 Week 1: Foundation (Days 1-7)

### Days 1-2: Project Setup
- [ ] Initialize Expo project with TypeScript
  ```bash
  npx create-expo-app . --template expo-template-blank-typescript
  ```
- [ ] Configure Expo Router (file-based navigation)
- [ ] Install dependencies:
  - [ ] @supabase/supabase-js
  - [ ] zustand
  - [ ] react-native-paper
  - [ ] nativewind
  - [ ] expo-image-picker
  - [ ] expo-image-manipulator
  - [ ] react-native-reanimated
- [ ] Set up project structure (app/, components/, lib/, etc.)
- [ ] Create Supabase project at supabase.com
- [ ] Run database migrations (001_initial_schema.sql)
- [ ] Configure environment variables (.env)
- [ ] Set up Zustand stores (auth, profile, matching)
- [ ] Initialize Git repository
- [ ] Push to GitHub (create private repo)

### Days 3-5: Authentication
- [ ] Install Supabase Auth dependencies
- [ ] Create auth context provider (AuthContext.tsx)
- [ ] Build welcome screens (3 swipeable slides)
  - [ ] Welcome slide 1: "Find Your Perfect Match"
  - [ ] Welcome slide 2: "Verified, Discreet, and Safe"
  - [ ] Welcome slide 3: "Advanced Compatibility"
- [ ] Build sign-up screen
  - [ ] Email/password form
  - [ ] Validation (email format, password strength)
  - [ ] Error handling
- [ ] Build sign-in screen
  - [ ] Email/password form
  - [ ] "Forgot password?" link
  - [ ] Error messages
- [ ] Implement Google Sign-In (expo-auth-session)
- [ ] Implement Apple Sign-In (iOS required)
- [ ] Phone verification flow (SMS code)
- [ ] Forgot password flow
- [ ] Protected route wrapper (redirect if not authenticated)
- [ ] Test auth flows on iOS and Android

### Days 6-7: Profile Setup (Onboarding)
- [ ] Create onboarding navigation (5 steps)
- [ ] Build progress indicator component
- [ ] **Step 1: Basic Info**
  - [ ] Display name input
  - [ ] Age input (18+ validation)
  - [ ] Gender identity picker
  - [ ] Sexual orientation picker
  - [ ] Location input (city, state)
  - [ ] Occupation input (optional)
- [ ] **Step 2: Photos**
  - [ ] Photo upload UI (3-6 photos)
  - [ ] expo-image-picker integration
  - [ ] Image compression (expo-image-manipulator)
  - [ ] Upload to Supabase Storage
  - [ ] Photo reordering (drag handles)
  - [ ] Delete photo functionality
  - [ ] Photo blur toggle (privacy)
- [ ] **Step 3: About You**
  - [ ] Bio text area (150-500 chars, counter)
  - [ ] Interest tags selection (hobbies)
  - [ ] Education level picker
  - [ ] Height input (optional)
- [ ] **Step 4: Marriage Preferences**
  - [ ] Primary reason picker
  - [ ] Relationship type picker
  - [ ] Children preferences
  - [ ] Timeline picker
  - [ ] Financial arrangement picker
  - [ ] Housing preference picker
- [ ] **Step 5: Matching Preferences**
  - [ ] Age range slider (22-50)
  - [ ] Max distance slider (10-100 miles)
  - [ ] Willing to relocate toggle
  - [ ] Gender preference checkboxes
  - [ ] Dealbreakers selection
- [ ] Profile preview screen
- [ ] Save profile to Supabase
- [ ] Test full onboarding flow

---

## 📅 Week 2: Core Features (Days 8-14)

### Days 8-10: Matching Algorithm & Discovery
- [ ] Create Supabase Edge Function: `matching/calculate`
- [ ] Implement compatibility calculation:
  - [ ] Location score (25% weight)
  - [ ] Goals score (20% weight)
  - [ ] Lifestyle score (20% weight)
  - [ ] Financial score (15% weight)
  - [ ] Timeline score (10% weight)
  - [ ] Values score (10% weight)
- [ ] Create Supabase Edge Function: `matching/discover`
- [ ] Implement discovery query:
  - [ ] Filter by preferences (age, gender, distance)
  - [ ] Exclude already swiped
  - [ ] Exclude blocked users
  - [ ] Enforce dealbreakers
- [ ] Calculate compatibility scores for batch
- [ ] Sort by compatibility (high to low)
- [ ] Return top 20-50 profiles
- [ ] Test matching algorithm with sample data

### Days 11-12: Swipe Interface
- [ ] Create SwipeCard component
  - [ ] Profile photo display
  - [ ] Name, age, distance
  - [ ] Compatibility score badge
  - [ ] 3 key highlights
  - [ ] Verification badge (if verified)
- [ ] Implement gesture handlers (react-native-gesture-handler)
  - [ ] Swipe left (pass)
  - [ ] Swipe right (like)
  - [ ] Swipe up (super like - premium)
- [ ] Add animations (react-native-reanimated)
  - [ ] Card exit animation
  - [ ] Reveal next card
  - [ ] Smooth transitions
- [ ] Build card stack UI
- [ ] Handle swipe actions:
  - [ ] Insert into `likes` table (swipe right)
  - [ ] Insert into `passes` table (swipe left)
  - [ ] Check for mutual match
- [ ] Build full profile view screen
  - [ ] Photo gallery (swipeable)
  - [ ] About section
  - [ ] Marriage goals & expectations
  - [ ] Lifestyle preferences
  - [ ] Compatibility breakdown (expandable)
- [ ] Add "empty state" (no more profiles)
- [ ] Test swipe interface on iOS and Android

### Days 13-14: Matching & Notifications
- [ ] Create Supabase Edge Function: `matching/like`
- [ ] Implement match detection logic:
  - [ ] Check if mutual like exists
  - [ ] Create `matches` record
  - [ ] Calculate final compatibility score
- [ ] Set up Expo Push Notifications
- [ ] Request notification permissions (on first launch)
- [ ] Store push token in profiles table
- [ ] Send push notification on new match
- [ ] Build match list screen
  - [ ] Display all matches
  - [ ] Profile photo, name, age
  - [ ] Last message preview
  - [ ] Unread indicator
- [ ] Build match animation/reveal
  - [ ] "It's a match!" modal
  - [ ] Confetti animation
  - [ ] Compatibility score highlight
  - [ ] "Start Chat" CTA
- [ ] Set up Supabase Realtime for matches
- [ ] Test match flow end-to-end
- [ ] Test push notifications on device

---

## 📅 Week 3: Messaging & Premium (Days 15-21)

### Days 15-16: Messaging System
- [ ] Build message list screen
  - [ ] Query matches with last message
  - [ ] Display profile photo, name
  - [ ] Message preview
  - [ ] Timestamp
  - [ ] Unread count badge
- [ ] Build chat screen UI
  - [ ] Message bubbles (sent/received)
  - [ ] Timestamp display
  - [ ] E2E encryption indicator
  - [ ] Chat input field
  - [ ] Send button
- [ ] Implement E2E encryption
  - [ ] Generate key pair on first message
  - [ ] Store public key in profile
  - [ ] Store private key in SecureStore
  - [ ] Encrypt messages before sending
  - [ ] Decrypt messages on receive
- [ ] Set up Supabase Realtime for messages
- [ ] Create Supabase Edge Function: `messaging/send`
- [ ] Implement message sending
- [ ] Implement message receiving
- [ ] Add typing indicator
- [ ] Add photo messages
  - [ ] Image picker
  - [ ] Upload to Supabase Storage
  - [ ] Display in chat
- [ ] Add voice messages (premium feature)
  - [ ] expo-file-system for recording
  - [ ] Upload audio to Supabase Storage
  - [ ] Audio player in chat
- [ ] Add read receipts (premium feature)
- [ ] Test messaging on iOS and Android

### Days 17-18: Payments & Subscriptions
- [ ] Create RevenueCat account
- [ ] Configure products in App Store Connect:
  - [ ] Premium subscription ($14.99/mo)
  - [ ] Platinum subscription ($24.99/mo)
  - [ ] Verification badge ($29.99)
  - [ ] Profile boost ($9.99)
  - [ ] Super Like bundle ($19.99)
- [ ] Configure products in Google Play Console (same as above)
- [ ] Install RevenueCat SDK (react-native-purchases)
- [ ] Create SubscriptionContext.tsx
- [ ] Build paywall screens
  - [ ] Premium paywall (features list, price)
  - [ ] Platinum paywall (all features list)
  - [ ] Animated feature showcase
- [ ] Implement purchase flow
  - [ ] Trigger native payment sheet
  - [ ] Handle purchase success
  - [ ] Handle purchase failure
  - [ ] Show confirmation
- [ ] Implement restore purchases
- [ ] Feature gating:
  - [ ] Check subscription status before premium features
  - [ ] "Upgrade to Premium" modal for free users
  - [ ] Unlock features for paid users
- [ ] Create Supabase Edge Function: `webhooks/revenuecat`
- [ ] Sync subscription status to Supabase
- [ ] Build subscription management screen
  - [ ] Display current plan
  - [ ] Expiration date
  - [ ] Cancel subscription option
- [ ] Test IAP in sandbox (iOS)
- [ ] Test IAP in test mode (Android)
- [ ] Test free trial (7 days)

### Days 19-21: Verification & Safety
- [ ] Sign up for Persona or Jumio
- [ ] Create verification template
- [ ] Build verification flow screens
  - [ ] Intro screen (why verify)
  - [ ] ID photo upload screen
  - [ ] Video selfie screen
  - [ ] Processing screen
  - [ ] Success/rejection screen
- [ ] Integrate Persona/Jumio SDK
- [ ] Implement ID upload
- [ ] Implement video selfie capture
- [ ] Create Supabase Edge Function: `verification/initiate`
- [ ] Create Supabase Edge Function: `webhooks/verification`
- [ ] Handle verification status updates
- [ ] Display verified badge on profiles
- [ ] Send notification when verified
- [ ] Build block functionality
  - [ ] Block button on profile
  - [ ] Confirmation modal
  - [ ] Insert into `blocks` table
  - [ ] Remove from matches/discovery
- [ ] Build report functionality
  - [ ] Report modal (reason + description)
  - [ ] Insert into `reports` table
  - [ ] Admin review flag (future)
- [ ] Build Safety Center screens
  - [ ] Safe meeting tips
  - [ ] Relationship contracts info
  - [ ] Legal resources links
  - [ ] How to report
- [ ] Build privacy settings screen
  - [ ] Photo blur toggle
  - [ ] Incognito mode toggle
  - [ ] Hide last active toggle
  - [ ] Show distance toggle
- [ ] Test verification flow
- [ ] Test block/report functionality

---

## 📅 Week 4: Polish & Testing (Days 22-28)

### Days 22-24: Testing & Bug Fixes
- [ ] **End-to-end testing:**
  - [ ] Full onboarding flow
  - [ ] Swipe → match → message flow
  - [ ] Payment flow (sandbox)
  - [ ] Verification flow
  - [ ] Block/report flow
- [ ] **iOS testing:**
  - [ ] iPhone 12 (iOS 16)
  - [ ] iPhone 13 (iOS 17)
  - [ ] iPhone 14 Pro (iOS 18)
  - [ ] iPhone 15 (iOS 18)
- [ ] **Android testing:**
  - [ ] Samsung Galaxy S21
  - [ ] Google Pixel 6
  - [ ] OnePlus 9 Pro
- [ ] Test push notifications on devices
- [ ] Test deep linking (notification → screen)
- [ ] Test offline handling
  - [ ] Show "no connection" message
  - [ ] Queue messages for sending
  - [ ] Retry failed uploads
- [ ] Fix critical bugs (Priority 1)
- [ ] Optimize performance:
  - [ ] Lazy load images
  - [ ] Memoize expensive calculations
  - [ ] Optimize re-renders
  - [ ] Profile photo caching
- [ ] Memory leak detection
- [ ] Test app on slow network (3G simulation)

### Days 25-26: Final Polish
- [ ] **UI polish:**
  - [ ] Consistent spacing (use theme values)
  - [ ] Color palette consistency
  - [ ] Font sizes (accessibility)
  - [ ] Button states (pressed, disabled)
  - [ ] Input field focus states
- [ ] **Animations:**
  - [ ] Smooth screen transitions
  - [ ] Card swipe animations
  - [ ] Modal enter/exit
  - [ ] Loading spinners
  - [ ] Skeleton loaders
- [ ] **Loading states:**
  - [ ] Profile loading
  - [ ] Discovery loading
  - [ ] Messages loading
  - [ ] Photo upload progress
- [ ] **Empty states:**
  - [ ] No matches yet
  - [ ] No messages yet
  - [ ] No profiles in discovery
  - [ ] Search results empty
- [ ] **Error screens:**
  - [ ] Network error
  - [ ] Server error (500)
  - [ ] Not found (404)
  - [ ] Permission denied
- [ ] **Accessibility:**
  - [ ] Screen reader support
  - [ ] Alt text for images
  - [ ] Color contrast (WCAG AA)
  - [ ] Touch target sizes (44x44pt min)
  - [ ] Focus order
- [ ] **Dark mode support:**
  - [ ] React Native Paper theme
  - [ ] Test all screens in dark mode
  - [ ] Adjust colors for readability
- [ ] Final design review (check against Figma/mockups)

### Days 27-28: App Store Preparation
- [ ] **iOS screenshots** (5 required sizes):
  - [ ] 6.7" (iPhone 15 Pro Max)
  - [ ] 6.5" (iPhone 11 Pro Max)
  - [ ] 5.5" (iPhone 8 Plus)
  - [ ] iPad Pro 12.9"
  - [ ] iPad Pro 11"
- [ ] **Android screenshots** (at least 2-8):
  - [ ] Phone (1080x1920)
  - [ ] 7" tablet (1200x1920)
  - [ ] 10" tablet (1600x2560)
- [ ] **App preview video** (30 seconds, optional but recommended)
  - [ ] Record screen demo
  - [ ] Add captions/text overlays
  - [ ] Export in required formats
- [ ] **App Store metadata:**
  - [ ] App name: "Accord - Lavender Marriage"
  - [ ] Subtitle: "Safe, Verified Connections"
  - [ ] Keywords: lavender marriage, lgbtq dating, queer marriage, verified dating
  - [ ] Description (4000 chars max)
  - [ ] Promotional text (170 chars)
  - [ ] Support URL
  - [ ] Marketing URL
- [ ] **Legal pages:**
  - [ ] Privacy policy (host on Vercel/Netlify)
  - [ ] Terms of service
  - [ ] EULA (optional)
- [ ] **App icons:**
  - [ ] iOS (1024x1024)
  - [ ] Android (512x512)
  - [ ] Adaptive icon (Android)
- [ ] **Splash screen / Launch screen**
- [ ] **Build production apps:**
  ```bash
  eas build --platform ios --profile production
  eas build --platform android --profile production
  ```
- [ ] **Submit to App Store Connect:**
  - [ ] Upload build
  - [ ] Fill out app information
  - [ ] Select pricing ($0 - free with IAP)
  - [ ] Age rating (17+ due to dating content)
  - [ ] App Privacy details (data collection)
  - [ ] Submit for review
- [ ] **Submit to Google Play Console:**
  - [ ] Upload AAB file
  - [ ] Fill out store listing
  - [ ] Content rating questionnaire
  - [ ] Pricing ($0 - free with IAP)
  - [ ] Data Safety section
  - [ ] Submit for review
- [ ] Set up TestFlight beta (iOS, 10 testers)
- [ ] Set up Internal Testing (Android, 10 testers)

---

## 📅 Week 5: Launch (Days 29-35)

### Days 29-30: Beta Testing
- [ ] Invite 10 beta testers (iOS TestFlight)
- [ ] Invite 10 beta testers (Android Internal Testing)
- [ ] Create feedback form (Google Forms/Typeform)
- [ ] Collect feedback:
  - [ ] Bugs/crashes
  - [ ] UI/UX issues
  - [ ] Feature requests
  - [ ] Performance issues
- [ ] Triage feedback (P0/P1/P2)
- [ ] Fix critical bugs (P0)
- [ ] Fix high-priority bugs (P1)
- [ ] Update builds if necessary
- [ ] Re-test critical flows

### Days 31-35: Launch Week 🚀

**Pre-Launch:**
- [ ] Monitor App Store review status (check daily)
- [ ] Monitor Google Play review status
- [ ] Prepare launch assets:
  - [ ] TikTok videos (3-5 ready to post)
  - [ ] Instagram posts/stories
  - [ ] Reddit posts
  - [ ] Press release (finalize)
  - [ ] Email to beta testers
- [ ] Set up analytics dashboards:
  - [ ] PostHog dashboard
  - [ ] Supabase dashboard
  - [ ] RevenueCat dashboard
- [ ] Set up monitoring:
  - [ ] Sentry alerts
  - [ ] Supabase alerts
  - [ ] Revenue alerts

**Launch Day (Once Approved):**
- [ ] 🎉 **APPS GO LIVE!**
- [ ] Announce on social media:
  - [ ] TikTok launch video
  - [ ] Instagram feed post
  - [ ] Instagram Stories (series)
  - [ ] Twitter/X thread
  - [ ] LinkedIn post
- [ ] Launch on Product Hunt:
  - [ ] Submit app
  - [ ] Respond to comments
  - [ ] Offer "Product Hunt exclusive" discount
- [ ] Reddit strategy:
  - [ ] AMA on r/lgbt
  - [ ] Posts in target subreddits
  - [ ] Provide value, not spam
- [ ] PR outreach:
  - [ ] Send press release to outlets
  - [ ] Follow up with journalists
- [ ] Email beta testers (thank you + launch announcement)
- [ ] Monitor metrics:
  - [ ] Downloads
  - [ ] Signups
  - [ ] Matches
  - [ ] Conversions
  - [ ] Crashes (Sentry)

**Days 32-35: Post-Launch**
- [ ] TikTok content (2-3 posts per day):
  - [ ] User testimonials
  - [ ] Feature demos
  - [ ] Behind-the-scenes
  - [ ] Duet with @jerzotto GEN WE
- [ ] Respond to app store reviews (daily)
  - [ ] Thank positive reviews
  - [ ] Address negative reviews
  - [ ] Fix reported bugs
- [ ] Monitor and fix critical issues:
  - [ ] Crashes (P0 - fix within 24h)
  - [ ] Payment issues (P0)
  - [ ] Login issues (P0)
  - [ ] Performance issues (P1)
- [ ] Daily metrics tracking:
  - [ ] Downloads: ___
  - [ ] Signups: ___
  - [ ] Matches: ___
  - [ ] Paid conversions: ___
  - [ ] MRR: $___
- [ ] Paid ads (if budget allows):
  - [ ] Instagram ads ($1K)
  - [ ] TikTok ads ($1K)
  - [ ] Reddit ads ($500)
- [ ] Influencer outreach:
  - [ ] 20 LGBTQ+ micro-influencers
  - [ ] Offer free lifetime premium
  - [ ] Request launch week post

---

## 📊 Success Metrics Checklist

### Week 1 Targets
- [ ] 1,000 signups
- [ ] 500 completed profiles
- [ ] 200 matches
- [ ] 50 conversations started

### Month 1 Targets (Week 2-5)
- [ ] 5,000 total users
- [ ] 10% paid conversion (500 paid users)
- [ ] $7K MRR
- [ ] 4.5+ star rating (App Store & Play Store)
- [ ] 100+ app reviews

### Month 2 Targets
- [ ] 10,000 total users
- [ ] 13% paid conversion (1,300 paid users)
- [ ] $18K MRR
- [ ] 70% retention (1-month)
- [ ] Product Hunt Top 10 (if launched there)

### Month 3 Targets 🎯
- [ ] 15,000+ total users
- [ ] 18% paid conversion (2,700 paid users)
- [ ] **$40K MRR** ✅
- [ ] 40% retention (3-month)
- [ ] Featured by LGBTQ+ media (at least 1 outlet)

---

## 🛠️ Technical Debt / Future Improvements

*(Track items to address post-launch)*

- [ ] Add unit tests (Jest)
- [ ] Add E2E tests (Detox)
- [ ] Improve matching algorithm (A/B test weights)
- [ ] Add AI matching tips
- [ ] Video profile feature
- [ ] Events & community feature
- [ ] Web app version (Next.js)
- [ ] Background check full integration
- [ ] Legal resources library
- [ ] Success stories feature
- [ ] Referral program
- [ ] Internationalization (i18n)

---

## 📝 Notes & Learnings

*(Use this section to track insights during development)*

**What went well:**
-

**What to improve:**
-

**Blockers:**
-

**Key decisions:**
-

---

**Last Updated**: October 6, 2025
**Status**: Pre-Development
**Next Review**: [Date after Week 1]
