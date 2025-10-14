# Legal Pages - Action Items

## ✅ Completed

- Created `PRIVACY_POLICY.md`
- Created `TERMS_OF_SERVICE.md`

## ⚠️ Required Updates

Before publishing these legal documents, you **must** update the following placeholders:

### Privacy Policy

1. **Line 126:** Replace `[Your Address]` with your actual business address
2. **Email addresses:** Ensure these are set up and monitored:
   - `privacy@accord.app`
   - `dpo@accord.app` (Data Protection Officer)

### Terms of Service

1. **Line 250:** Replace `[Your State]` with your state (e.g., "California")
2. **Line 259:** Replace `[Your City, State]` with your location for arbitration
3. **Line 299:** Replace `[Your Address]` with your actual business address
4. **Email address:** Ensure `legal@accord.app` is set up and monitored

## 📝 Next Steps

### 1. Host Legal Pages

You need to host these pages on a public URL for app store requirements:

**Option A: Vercel (Recommended)**
```bash
# Create a simple Next.js or static site
npx create-next-app accord-legal
cd accord-legal
# Copy PRIVACY_POLICY.md and TERMS_OF_SERVICE.md to pages/
# Convert markdown to HTML or use a markdown renderer
npm install react-markdown
# Deploy to Vercel
vercel deploy --prod
```

**Option B: Netlify**
```bash
# Create a simple static site
mkdir accord-legal
cd accord-legal
# Create index.html with links to privacy and terms
# Create privacy.html and terms.html from the markdown files
# Deploy to Netlify
netlify deploy --prod
```

**Option C: GitHub Pages**
- Create a GitHub repo: `accord-legal`
- Add `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md`
- Enable GitHub Pages in settings
- Use Jekyll or another static site generator

### 2. Add Links to App

Once hosted, add links to these pages in:

**In the App:**
- Sign-up screen: "By signing up, you agree to our [Terms of Service](URL) and [Privacy Policy](URL)"
- Settings screen: Add "Legal" section with links to Privacy Policy and Terms
- Delete account screen: Link to Privacy Policy's data deletion section

**File:** `app/(auth)/sign-up.tsx`
```tsx
<Text className="text-gray-600 text-sm text-center mt-4">
  By signing up, you agree to our{' '}
  <Text
    className="text-primary-600 underline"
    onPress={() => Linking.openURL('https://accord.app/terms')}
  >
    Terms of Service
  </Text>
  {' '}and{' '}
  <Text
    className="text-primary-600 underline"
    onPress={() => Linking.openURL('https://accord.app/privacy')}
  >
    Privacy Policy
  </Text>
  .
</Text>
```

**File:** `app/settings/index.tsx`
```tsx
// Add to settings menu
<TouchableOpacity
  className="py-4 border-b border-gray-200"
  onPress={() => Linking.openURL('https://accord.app/privacy')}
>
  <Text className="text-gray-800 text-base">Privacy Policy</Text>
</TouchableOpacity>

<TouchableOpacity
  className="py-4 border-b border-gray-200"
  onPress={() => Linking.openURL('https://accord.app/terms')}
>
  <Text className="text-gray-800 text-base">Terms of Service</Text>
</TouchableOpacity>
```

### 3. App Store Submission

When submitting to the App Store and Google Play:

**Apple App Store Connect:**
- Privacy Policy URL: `https://accord.app/privacy`
- Terms of Service URL: `https://accord.app/terms`
- Support URL: `https://accord.app/support`

**Google Play Console:**
- Privacy Policy URL: `https://accord.app/privacy`
- Link in app description
- Data Safety section (references Privacy Policy)

### 4. Get Legal Review (Recommended)

While these documents provide a solid foundation, consider having them reviewed by:

- **Privacy lawyer:** Ensure GDPR/CCPA compliance
- **Tech lawyer:** Review liability limitations and arbitration clauses
- **Cost:** $500-$2,000 for review and customization

Especially important if you plan to:
- Operate in the EU (GDPR requirements)
- Handle sensitive data (which you do - LGBTQ+ community)
- Offer paid subscriptions

### 5. Regular Updates

You should review and update these documents:

- **Annually:** General review and updates
- **When features change:** New data collection, third-party services
- **When laws change:** New privacy regulations
- **Before major launches:** Expansion to new markets

## 📋 Checklist Before Going Live

- [ ] Replace all placeholder text (`[Your Address]`, `[Your State]`, etc.)
- [ ] Set up email addresses:
  - [ ] privacy@accord.app (forwarding or dedicated inbox)
  - [ ] legal@accord.app
  - [ ] dpo@accord.app (if targeting EU users)
  - [ ] safety@accord.app
- [ ] Host legal pages on public URL (Vercel, Netlify, or GitHub Pages)
- [ ] Add links to legal pages in app (sign-up, settings, delete account)
- [ ] Test all links work correctly
- [ ] Consider legal review by attorney
- [ ] Add URLs to App Store Connect and Google Play Console
- [ ] Create "last updated" reminder (review annually)

## 💡 Pro Tips

1. **Version Control:** Keep old versions of legal docs (required by some regulations)
2. **Notification:** When you update Terms/Privacy, notify users via email or push notification
3. **Consent:** For material changes, require users to accept updated terms before continuing
4. **Transparency:** Be clear about what data you collect and why
5. **User Rights:** Make it easy for users to exercise their rights (delete data, export data, etc.)

---

**Important:** This is legal documentation that affects your liability and user rights. While these templates are comprehensive, they are not a substitute for professional legal advice. Consult with an attorney familiar with app law, privacy regulations, and your specific jurisdiction.
