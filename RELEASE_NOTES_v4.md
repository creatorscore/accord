# Accord - Release Notes (Version 4)

## 🚀 Android Build 4 - Internal Testing Release

**Release Date**: October 27, 2025
**Version Code**: 4
**Version Name**: 1.0.0

---

## 🎯 What's New

### ✨ Enhanced Matching Algorithm (OkCupid-Inspired)
We've completely overhauled the compatibility matching system to use ALL profile fields for deep, meaningful matches:

#### **New Matching Features:**
- **🎬 Media Interests Matching** - Shared movies, music, books, and TV shows now heavily influence compatibility (35 points!)
- **🏳️‍🌈 Sexual Orientation Compatibility** - Smart matching for lesbian, gay, bi, queer, pansexual, asexual, and straight orientations
- **🎭 Pronouns Respect** - Compatibility scoring includes pronoun preferences (he/him, she/her, they/them, etc.)
- **🚭 Lifestyle Preferences** - Smoking, drinking, and pet compatibility now factored into matching
- **📝 Bio Keyword Analysis** - Shared themes and values detected in profile bios
- **👶 Enhanced Children Arrangements** - Better matching for biological, adoption, foster, surrogacy preferences

#### **Algorithm Improvements:**
- **New Weight Distribution:**
  - Location & Distance: 20% (was 25%)
  - Marriage Goals: 25% (was 30%)
  - Lifestyle & Values: 20% (unchanged)
  - **Personality & Interests: 20% (was 15%)** - INCREASED!
  - Demographics: 10% (unchanged)
  - **Orientation & Identity: 5% (NEW!)**

- **More Meaningful Scores:**
  - 90-100%: Exceptional Match 🌟 (very rare, <5%)
  - 80-89%: Excellent Match 💜 (highly compatible, <15%)
  - 70-79%: Great Match (strong compatibility, ~25%)
  - 60-69%: Good Match (decent compatibility, ~30%)

### 🎨 Profile Display Enhancements
- ✅ **ALL onboarding fields now visible** on profile pages
- ✅ Fixed interests display (movies, music, books, TV shows properly shown)
- ✅ Added sexual orientation to profile cards
- ✅ Enhanced media interests display with color-coded badges
- ✅ Improved profile photo carousel

### 🔧 Bug Fixes & Stability
- ✅ **Fixed critical app crash** - Removed forced RTL layout change that caused crashes
- ✅ Fixed subscription loading issues with RevenueCat Google API key
- ✅ Improved error handling throughout the app
- ✅ Better i18n initialization with graceful fallbacks

### 🛡️ Error Tracking & Analytics
- ✅ Integrated Sentry for crash reporting
- ✅ Added PostHog analytics for usage insights
- ✅ Enhanced error boundary to catch and display errors gracefully

---

## 📊 Technical Details

**Matching Algorithm Coverage:**
- Now uses **100% of onboarding fields** (was ~60%)
- Includes 35+ data points for compatibility calculation
- Smart compatibility matrices for orientations, politics, lifestyle

**Profile Fields:**
- Basic: age, gender, pronouns, sexual_orientation, ethnicity, location
- Personality: zodiac, MBTI, love language, height
- Interests: hobbies[], interests{movies, music, books, tv_shows}
- Values: religion, political_views, languages_spoken[]
- Preferences: marriage goals, financial, housing, lifestyle (smoking, drinking, pets)

---

## 🐛 Known Issues
- RTL language support requires manual app restart (users must restart app after changing to Arabic/Hebrew/Farsi/Urdu)
- Development client QR code opens in browser (use production build for testing)

---

## 📥 Download Build

**Android App Bundle (AAB):**
https://expo.dev/artifacts/eas/gBXCqV85SGJzREMJNDcQLW.aab

**Build Logs:**
https://expo.dev/accounts/vfranz/projects/accord/builds/7e7e64d5-7740-4465-afea-73a7aa8b59b6

---

## 🧪 Testing Instructions

### Internal Testing Checklist:
1. **Sign Up Flow**
   - ✅ Complete all onboarding steps
   - ✅ Add profile photos
   - ✅ Fill out personality, interests, prompts

2. **Profile Display**
   - ✅ Verify ALL fields appear on your profile
   - ✅ Check media interests display correctly
   - ✅ Verify sexual orientation shows

3. **Matching**
   - ✅ Swipe through potential matches
   - ✅ Check compatibility scores (should range 40-95%)
   - ✅ Verify distance preferences work

4. **Distance Preferences**
   - ✅ Adjust max distance slider (10-500 miles)
   - ✅ Test "willing to relocate" toggle
   - ✅ Test "search globally" option
   - ✅ Add preferred cities

5. **Subscriptions**
   - ✅ View premium/platinum plans
   - ✅ Test Google Play subscription flow
   - ✅ Verify features unlock

6. **Stability**
   - ✅ App doesn't crash on launch
   - ✅ App doesn't crash when changing language
   - ✅ Profile editing works smoothly

---

## 🔄 Upgrade Path

**From Version 3 → Version 4:**
- No data migration required
- Users will see improved compatibility scores
- All existing profiles will work with new algorithm

---

## 📝 Release Checklist for Google Play

- ✅ Version code incremented to 4
- ✅ AAB file generated and signed
- ✅ Release notes prepared
- ⏳ Upload to Google Play Internal Testing track
- ⏳ Test with internal testers
- ⏳ Promote to Beta when stable

---

## 👥 For Internal Testers

**What to Test:**
1. Sign up and complete onboarding
2. Add lots of interests (movies, music, books, TV shows)
3. Swipe and check if matches make sense
4. Try changing distance preferences
5. Report any crashes or bugs

**How to Report Issues:**
- App crashes: Check Sentry dashboard (errors auto-reported)
- UI issues: Screenshot + description
- Matching quality: Which profiles should match but didn't?

---

## 🚀 Next Steps

**Planned for Version 5:**
- Voice intro playback in profiles
- Prompt-based compatibility scoring
- Enhanced media interest recommendations
- Machine learning layer for matching improvements
- A/B testing for algorithm weight distributions

---

**Questions?** Contact the development team or report issues via Sentry.
