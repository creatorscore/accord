# Accord

**The first verified, discreet platform for LGBTQ+ individuals seeking lavender marriages.**

---

## Overview

Accord is a native mobile dating application (iOS + Android) for individuals seeking lavender marriages - platonic marriages between:
- LGBTQ+ individuals (e.g., gay men + lesbian women)
- **Straight women + gay men** (escaping hetero dating dynamics)

The app provides advanced compatibility matching, end-to-end encrypted messaging, rigorous verification, and comprehensive privacy controls.

### Why Accord?

With anti-LGBTQ+ sentiment rising 112%, **women increasingly rejecting cis-hetero relationships** (4B movement), and Gen Z/Millennials embracing platonic partnerships, there's massive demand for safe lavender marriage platforms. Accord addresses this with:

- **Advanced Matching**: Compatibility based on goals, finances, lifestyle, location
- **Privacy-First**: E2E encryption, photo blur, incognito mode
- **Safety & Verification**: Identity + video verification, block/report, content moderation
- **Purpose-Built**: Not a generic dating app - designed specifically for lavender marriages

### Target Market
- **Primary**: LGBTQ+ individuals AND straight women aged 22-40 seeking platonic marriages
- **Market Size**: 65M+ in US (50M LGBTQ+, 15M straight women)
- **Revenue Goal**: $40K MRR by Month 3

---

## Project Status

**Status**: Pre-Development
**Target Launch**: November 10, 2025 (5 weeks)
**Platform**: iOS & Android (React Native/Expo)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Mobile Framework | React Native (Expo SDK 54+) |
| Language | TypeScript 5.9+ |
| Navigation | Expo Router (file-based) |
| UI Library | React Native Paper + NativeWind |
| State Management | Zustand + React Context |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Payments | RevenueCat (Apple IAP, Google IAP) |
| Verification | Persona or Jumio |
| Analytics | PostHog |
| Error Tracking | Sentry |
| Build & Deploy | EAS Build |

---

## Project Structure

```
accord/
├── CLAUDE.md                 # AI assistant context & technical docs
├── accord-prd.md             # Complete product requirements
├── README.md                 # This file
├── app/                      # Expo Router screens
│   ├── (auth)/              # Authentication flow
│   ├── (tabs)/              # Main app tabs
│   ├── (onboarding)/        # Profile setup
│   └── index.tsx            # Entry point
├── components/              # Reusable UI components
├── lib/                     # Utilities & services
├── contexts/                # React Context providers
├── stores/                  # Zustand stores
├── types/                   # TypeScript definitions
├── hooks/                   # Custom React hooks
├── assets/                  # Images, fonts, icons
└── supabase/                # Backend (migrations, functions)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Emulator
- Supabase account
- RevenueCat account (for payments)
- Persona/Jumio account (for verification)

### Setup Instructions

**1. Clone the repository**
```bash
cd /Users/vfranz/accord
```

**2. Install dependencies**
```bash
npm install
# or
yarn install
```

**3. Set up Supabase**
- Create a new project at [supabase.com](https://supabase.com)
- Run migrations: `supabase db push`
- Copy your Supabase URL and anon key

**4. Set up environment variables**
Create a `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

PERSONA_API_KEY=your-persona-key
PERSONA_TEMPLATE_ID=your-template-id

POSTHOG_API_KEY=your-posthog-key

REVENUECAT_APPLE_API_KEY=your-ios-key
REVENUECAT_GOOGLE_API_KEY=your-android-key

SENTRY_DSN=your-sentry-dsn
```

**5. Start the development server**
```bash
npm run start
```

**6. Run on device/simulator**
```bash
# iOS (Mac only)
npm run ios

# Android
npm run android

# Web (for testing)
npm run web
```

---

## Development Workflow

### Running Locally
```bash
# Start Expo dev server
npm run start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Type checking
npm run type-check

# Linting
npm run lint
```

### Database Migrations
```bash
# Create new migration
supabase migration new <migration_name>

# Run migrations locally
supabase db push

# Run migrations on remote
supabase db push --remote
```

### Building for Production
```bash
# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Key Features (MVP)

### Core Features
- ✅ Authentication (email, Google, Apple Sign-In)
- ✅ Profile creation & photo upload
- ✅ Marriage preferences & goals
- ✅ Swipe matching interface
- ✅ Advanced compatibility algorithm
- ✅ End-to-end encrypted messaging
- ✅ Identity & video verification
- ✅ Premium subscriptions (RevenueCat)
- ✅ Block, report, safety features
- ✅ Push notifications

### Premium Features
- Unlimited swipes
- See who liked you
- Advanced filters
- Send intro messages
- Read receipts
- Voice messages
- Profile boosts

### Platinum Features
- All Premium features
- Background check assistance
- Legal resource library
- Priority support
- Exclusive events

---

## Documentation

- **CLAUDE.md**: Complete technical architecture, database schema, API design
- **accord-prd.md**: Product requirements, user flows, monetization, launch strategy
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Expo Docs**: [docs.expo.dev](https://docs.expo.dev)
- **RevenueCat Docs**: [docs.revenuecat.com](https://docs.revenuecat.com)

---

## Contributing

This is currently a private project. For questions or suggestions, contact the founder.

---

## License

Copyright © 2025 Accord. All rights reserved.

---

## Contact

**Email**: support@accordapp.com
**Twitter**: @accordapp
**TikTok**: @accordapp
**Instagram**: @accordapp

---

## Revenue Target

**Goal**: $40K MRR by Month 3 (2,700 paid users)

- **Month 1**: 5,000 users → ~$7K MRR
- **Month 2**: 10,000 users → ~$18K MRR
- **Month 3**: 15,000 users → ~$40K MRR

---

**Let's build a safe, verified platform for lavender marriages - for LGBTQ+ individuals and straight women seeking platonic life partners. 🌈**
