import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function PrivacyPolicy() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>Last Updated: January 15, 2025</Text>

          <Text style={styles.paragraph}>
            At Accord, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
          </Text>

          <Text style={styles.heading}>1. Information We Collect</Text>

          <Text style={styles.subheading}>Personal Information</Text>
          <Text style={styles.paragraph}>
            When you create an account, we collect:
            {'\n'}• Name, age, and date of birth
            {'\n'}• Email address and phone number
            {'\n'}• Gender identity and sexual orientation
            {'\n'}• Location (city, state, and approximate coordinates)
            {'\n'}• Photos you upload
            {'\n'}• Profile information (bio, occupation, education, preferences)
          </Text>

          <Text style={styles.subheading}>Verification Information</Text>
          <Text style={styles.paragraph}>
            For identity verification, we may collect:
            {'\n'}• Government-issued ID photos
            {'\n'}• Selfie photos for verification
            {'\n'}• Verification status from third-party providers
          </Text>

          <Text style={styles.subheading}>Usage Information</Text>
          <Text style={styles.paragraph}>
            We automatically collect:
            {'\n'}• Device information (model, OS version, device ID)
            {'\n'}• Usage data (features used, time spent, interactions)
            {'\n'}• Log data (IP address, crash reports, performance data)
            {'\n'}• Location data (with your permission)
          </Text>

          <Text style={styles.subheading}>Communication Data</Text>
          <Text style={styles.paragraph}>
            We store messages sent through the app to:
            {'\n'}• Deliver messages between users
            {'\n'}• Investigate reports of misconduct
            {'\n'}• Comply with legal obligations
            {'\n\n'}Note: Messages are encrypted in transit and at rest.
          </Text>

          <Text style={styles.heading}>2. How We Use Your Information</Text>

          <Text style={styles.paragraph}>
            We use your information to:
            {'\n\n'}• Provide and improve our services
            {'\n'}• Match you with compatible users
            {'\n'}• Verify your identity and age
            {'\n'}• Process payments and subscriptions
            {'\n'}• Send notifications about matches, messages, and updates
            {'\n'}• Prevent fraud, spam, and abuse
            {'\n'}• Comply with legal requirements
            {'\n'}• Conduct research and analytics (in aggregated, de-identified form)
          </Text>

          <Text style={styles.heading}>3. How We Share Your Information</Text>

          <Text style={styles.subheading}>With Other Users</Text>
          <Text style={styles.paragraph}>
            Your profile information, photos, and preferences are visible to other users for matching purposes. You control what information appears on your profile.
          </Text>

          <Text style={styles.subheading}>Service Providers</Text>
          <Text style={styles.paragraph}>
            We share data with trusted service providers who help us operate the app:
            {'\n'}• Cloud hosting (Supabase)
            {'\n'}• Payment processing (RevenueCat, Apple, Google)
            {'\n'}• Identity verification (Persona/Jumio)
            {'\n'}• Analytics (PostHog)
            {'\n'}• Customer support tools
          </Text>

          <Text style={styles.subheading}>Legal Requirements</Text>
          <Text style={styles.paragraph}>
            We may disclose information when required by law or to:
            {'\n'}• Comply with legal processes
            {'\n'}• Protect users' safety
            {'\n'}• Prevent fraud or security issues
            {'\n'}• Enforce our Terms of Service
          </Text>

          <Text style={styles.paragraph}>
            We do NOT sell your personal information to third parties.
          </Text>

          <Text style={styles.heading}>4. Your Privacy Rights</Text>

          <Text style={styles.subheading}>GDPR Rights (EU Users)</Text>
          <Text style={styles.paragraph}>
            If you're in the EU, you have the right to:
            {'\n'}• Access your personal data
            {'\n'}• Correct inaccurate data
            {'\n'}• Delete your data ("right to be forgotten")
            {'\n'}• Object to data processing
            {'\n'}• Data portability
            {'\n'}• Withdraw consent at any time
          </Text>

          <Text style={styles.subheading}>CCPA Rights (California Users)</Text>
          <Text style={styles.paragraph}>
            California residents have the right to:
            {'\n'}• Know what personal information we collect
            {'\n'}• Know if we sell or share your information
            {'\n'}• Request deletion of your information
            {'\n'}• Opt-out of the sale of your information (we don't sell data)
            {'\n'}• Non-discrimination for exercising your rights
          </Text>

          <Text style={styles.subheading}>All Users</Text>
          <Text style={styles.paragraph}>
            You can always:
            {'\n'}• Update your profile and preferences
            {'\n'}• Control who sees your profile
            {'\n'}• Block or report users
            {'\n'}• Delete your account at any time
          </Text>

          <Text style={styles.heading}>5. Data Security</Text>

          <Text style={styles.paragraph}>
            We implement industry-standard security measures:
            {'\n\n'}• End-to-end encryption for messages
            {'\n'}• Secure data transmission (HTTPS/TLS)
            {'\n'}• Encrypted data storage
            {'\n'}• Regular security audits
            {'\n'}• Access controls and authentication
            {'\n'}• Automatic session timeout
            {'\n\n'}However, no system is 100% secure. Use strong passwords and enable two-factor authentication when available.
          </Text>

          <Text style={styles.heading}>6. Data Retention</Text>

          <Text style={styles.paragraph}>
            We retain your data for as long as your account is active, plus:
            {'\n\n'}• Profile data: Deleted immediately upon account deletion
            {'\n'}• Messages: Retained for 90 days after deletion for safety purposes
            {'\n'}• Verification data: Retained for legal compliance (up to 7 years)
            {'\n'}• Analytics data: Aggregated and anonymized indefinitely
            {'\n'}• Legal/compliance data: As required by law
          </Text>

          <Text style={styles.heading}>7. Children's Privacy</Text>

          <Text style={styles.paragraph}>
            Accord is strictly for users 18 and older. We do not knowingly collect information from anyone under 18. If we discover a user is underage, we immediately delete their account and data.
          </Text>

          <Text style={styles.heading}>8. International Data Transfers</Text>

          <Text style={styles.paragraph}>
            Your data may be transferred to and processed in countries outside your residence, including the United States. We ensure appropriate safeguards are in place through:
            {'\n'}• Standard Contractual Clauses (EU)
            {'\n'}• Data Processing Agreements
            {'\n'}• Encryption and security measures
          </Text>

          <Text style={styles.heading}>9. Third-Party Links</Text>

          <Text style={styles.paragraph}>
            Our app may contain links to external websites or services. We are not responsible for their privacy practices. Please review their privacy policies separately.
          </Text>

          <Text style={styles.heading}>10. Changes to This Policy</Text>

          <Text style={styles.paragraph}>
            We may update this Privacy Policy periodically. We'll notify you of material changes via:
            {'\n'}• In-app notification
            {'\n'}• Email to your registered address
            {'\n'}• Update to "Last Updated" date
            {'\n\n'}Continued use of the app after changes constitutes acceptance of the updated policy.
          </Text>

          <Text style={styles.heading}>11. Contact Us</Text>

          <Text style={styles.paragraph}>
            For privacy questions or to exercise your rights, contact us:
            {'\n\n'}Email: privacy@joinaccord.app
            {'\n'}Mail: Accord Privacy Team, [Your Address]
            {'\n\n'}Response time: Within 30 days of request
          </Text>

          <View style={styles.footer}>
            <MaterialCommunityIcons name="shield-check" size={24} color="#A08AB7" />
            <Text style={styles.footerText}>
              Your privacy is protected. We're committed to keeping your information safe and secure.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 28,
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 32,
    marginBottom: 20,
    gap: 12,
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});
