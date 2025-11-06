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

export default function TermsOfService() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>Last Updated: January 15, 2025</Text>

          <Text style={styles.paragraph}>
            Welcome to Accord! These Terms of Service ("Terms") govern your use of the Accord mobile application and services. By creating an account, you agree to these Terms.
          </Text>

          <Text style={styles.heading}>1. Eligibility</Text>

          <Text style={styles.paragraph}>
            To use Accord, you must:
            {'\n\n'}• Be at least 18 years old
            {'\n'}• Be legally able to enter into a binding contract
            {'\n'}• Not be prohibited from using the service under US laws
            {'\n'}• Comply with these Terms and all applicable laws
            {'\n\n'}We reserve the right to verify your age and identity. Misrepresenting your age will result in immediate account termination.
          </Text>

          <Text style={styles.heading}>2. Account Registration</Text>

          <Text style={styles.paragraph}>
            You agree to:
            {'\n\n'}• Provide accurate, current, and complete information
            {'\n'}• Maintain and update your information
            {'\n'}• Keep your password secure and confidential
            {'\n'}• Notify us immediately of any unauthorized access
            {'\n'}• Not create multiple accounts
            {'\n'}• Not use another person's account
            {'\n\n'}You are responsible for all activities under your account.
          </Text>

          <Text style={styles.heading}>3. Acceptable Use</Text>

          <Text style={styles.subheading}>You May:</Text>
          <Text style={styles.paragraph}>
            • Create an authentic profile representing yourself
            {'\n'}• Connect with other users for lawful purposes
            {'\n'}• Use the app to find compatible partners for lavender marriages
            {'\n'}• Report violations of these Terms
          </Text>

          <Text style={styles.subheading}>You May NOT:</Text>
          <Text style={styles.paragraph}>
            • Harass, threaten, or intimidate other users
            {'\n'}• Post hateful, violent, or discriminatory content
            {'\n'}• Impersonate others or create fake profiles
            {'\n'}• Solicit money or engage in commercial activity
            {'\n'}• Post spam, advertising, or promotional content
            {'\n'}• Share sexually explicit or pornographic content
            {'\n'}• Share others' private information without consent
            {'\n'}• Use the service for illegal activities
            {'\n'}• Attempt to hack, scrape, or reverse-engineer the app
            {'\n'}• Use bots, scripts, or automated tools
            {'\n'}• Violate intellectual property rights
          </Text>

          <Text style={styles.heading}>4. Content</Text>

          <Text style={styles.subheading}>Your Content</Text>
          <Text style={styles.paragraph}>
            You retain ownership of content you post (photos, messages, profile information). However, you grant Accord a worldwide, non-exclusive, royalty-free license to use, display, and distribute your content to:
            {'\n\n'}• Operate and provide the service
            {'\n'}• Show your profile to other users
            {'\n'}• Improve our matching algorithms
            {'\n'}• Promote the service (with your consent)
          </Text>

          <Text style={styles.subheading}>Content Guidelines</Text>
          <Text style={styles.paragraph}>
            All content must:
            {'\n\n'}• Be your own or properly licensed
            {'\n'}• Show you clearly in profile photos
            {'\n'}• Be appropriate for a dating platform
            {'\n'}• Not violate others' rights or privacy
            {'\n'}• Comply with our Community Guidelines
            {'\n\n'}We reserve the right to remove any content that violates these Terms.
          </Text>

          <Text style={styles.heading}>5. Verification</Text>

          <Text style={styles.paragraph}>
            We offer optional identity verification through third-party providers. By submitting verification:
            {'\n\n'}• You authorize us to share information with verification providers
            {'\n'}• You consent to processing of your government ID and selfie
            {'\n'}• Verification does not guarantee user authenticity
            {'\n'}• We are not liable for verification errors
          </Text>

          <Text style={styles.heading}>6. Subscriptions and Payments</Text>

          <Text style={styles.subheading}>Premium Features</Text>
          <Text style={styles.paragraph}>
            Accord offers paid subscriptions (Premium and Platinum) with enhanced features. By purchasing a subscription:
            {'\n\n'}• You authorize recurring charges to your payment method
            {'\n'}• Subscriptions auto-renew unless cancelled
            {'\n'}• Prices are as displayed at time of purchase
            {'\n'}• All sales are final (limited exceptions apply)
          </Text>

          <Text style={styles.subheading}>Cancellation</Text>
          <Text style={styles.paragraph}>
            You can cancel your subscription anytime through:
            {'\n'}• iOS: App Store settings
            {'\n'}• Android: Google Play settings
            {'\n\n'}Cancellation takes effect at the end of the current billing period. No refunds for partial periods.
          </Text>

          <Text style={styles.subheading}>Refunds</Text>
          <Text style={styles.paragraph}>
            Refunds are handled by Apple/Google according to their policies. Contact us for refund requests within 14 days of purchase.
          </Text>

          <Text style={styles.heading}>7. Privacy and Data</Text>

          <Text style={styles.paragraph}>
            Your use of Accord is also governed by our Privacy Policy. Key points:
            {'\n\n'}• We collect and use data as described in our Privacy Policy
            {'\n'}• Messages are encrypted but not completely private
            {'\n'}• We may review reported content for safety purposes
            {'\n'}• We comply with GDPR, CCPA, and other privacy laws
            {'\n\n'}See our full Privacy Policy for details.
          </Text>

          <Text style={styles.heading}>8. Disclaimers</Text>

          <Text style={styles.paragraph}>
            Accord is provided "AS IS" without warranties of any kind. We do not:
            {'\n\n'}• Guarantee you'll find a match
            {'\n'}• Verify all user identities or backgrounds
            {'\n'}• Screen users for criminal history (unless opted into premium checks)
            {'\n'}• Guarantee service availability or uptime
            {'\n'}• Promise error-free or uninterrupted service
            {'\n\n'}USE AT YOUR OWN RISK. We are not responsible for users' actions or the outcome of any relationships formed through the app.
          </Text>

          <Text style={styles.heading}>9. Limitation of Liability</Text>

          <Text style={styles.paragraph}>
            To the maximum extent permitted by law:
            {'\n\n'}• Accord is not liable for indirect, incidental, or consequential damages
            {'\n'}• Our total liability shall not exceed the amount you paid us in the last 12 months (or $100, whichever is greater)
            {'\n'}• We are not liable for user conduct, offline interactions, or third-party actions
            {'\n'}• Some jurisdictions don't allow these limitations, so they may not apply to you
          </Text>

          <Text style={styles.heading}>10. Indemnification</Text>

          <Text style={styles.paragraph}>
            You agree to indemnify and hold Accord harmless from any claims, losses, or damages arising from:
            {'\n\n'}• Your violation of these Terms
            {'\n'}• Your content or conduct
            {'\n'}• Your interactions with other users
            {'\n'}• Your violation of others' rights
          </Text>

          <Text style={styles.heading}>11. Termination</Text>

          <Text style={styles.subheading}>By You</Text>
          <Text style={styles.paragraph}>
            You can delete your account anytime through Settings. Upon deletion:
            {'\n'}• Your profile is immediately removed
            {'\n'}• Your data is deleted per our Privacy Policy
            {'\n'}• Messages may be retained for 90 days for safety
          </Text>

          <Text style={styles.subheading}>By Us</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate your account if you:
            {'\n'}• Violate these Terms
            {'\n'}• Engage in illegal activity
            {'\n'}• Harass or harm other users
            {'\n'}• Are reported multiple times
            {'\n'}• Appear to be underage
            {'\n\n'}Termination does not entitle you to a refund.
          </Text>

          <Text style={styles.heading}>12. Dispute Resolution</Text>

          <Text style={styles.subheading}>Arbitration</Text>
          <Text style={styles.paragraph}>
            Any disputes will be resolved through binding arbitration rather than in court, except:
            {'\n'}• You may bring claims in small claims court
            {'\n'}• Either party may seek injunctive relief
            {'\n\n'}Class action lawsuits are waived.
          </Text>

          <Text style={styles.subheading}>Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of [Your State/Country], without regard to conflict of law principles.
          </Text>

          <Text style={styles.heading}>13. Changes to Terms</Text>

          <Text style={styles.paragraph}>
            We may modify these Terms at any time. We'll notify you of material changes via:
            {'\n'}• In-app notification
            {'\n'}• Email to your registered address
            {'\n\n'}Continued use after changes constitutes acceptance. If you don't agree, delete your account.
          </Text>

          <Text style={styles.heading}>14. General</Text>

          <Text style={styles.paragraph}>
            • <Text style={styles.bold}>Entire Agreement:</Text> These Terms, Privacy Policy, and Community Guidelines constitute the entire agreement.
            {'\n\n'}• <Text style={styles.bold}>Severability:</Text> If any provision is invalid, the rest remains in effect.
            {'\n\n'}• <Text style={styles.bold}>No Waiver:</Text> Our failure to enforce a provision doesn't waive our right to enforce it later.
            {'\n\n'}• <Text style={styles.bold}>Assignment:</Text> You cannot transfer your rights; we may transfer ours.
          </Text>

          <Text style={styles.heading}>15. Contact Us</Text>

          <Text style={styles.paragraph}>
            Questions about these Terms?
            {'\n\n'}Email: legal@joinaccord.app
            {'\n'}Mail: Accord Legal Team, [Your Address]
          </Text>

          <View style={styles.footer}>
            <MaterialCommunityIcons name="file-document" size={24} color="#9B87CE" />
            <Text style={styles.footerText}>
              By using Accord, you agree to these Terms of Service. Please read them carefully.
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
  bold: {
    fontWeight: '700',
    color: '#111827',
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
