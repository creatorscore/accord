import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

interface SafetyTip {
  id: string;
  icon: string;
  title: string;
  description: string;
  expandedContent?: string;
}

const SAFETY_TIPS: SafetyTip[] = [
  {
    id: 'meet-safely',
    icon: 'shield-account',
    title: 'Meet Safely',
    description: 'Always meet in public places for the first few dates',
    expandedContent:
      'When meeting someone for the first time:\n\n• Choose a public location like a café, restaurant, or park\n• Tell a friend or family member where you\'re going\n• Share your location with someone you trust\n• Arrange your own transportation\n• Stay sober and alert\n• Trust your instincts - if something feels wrong, leave',
  },
  {
    id: 'protect-info',
    icon: 'lock',
    title: 'Protect Your Information',
    description: 'Keep personal details private until you build trust',
    expandedContent:
      'Protect yourself online:\n\n• Don\'t share your home address, workplace, or financial information\n• Be cautious about sharing your phone number\n• Avoid sharing identifying details too early\n• Use Accord\'s in-app messaging until you\'re comfortable\n• Never send money to someone you haven\'t met\n• Be wary of anyone asking for financial help',
  },
  {
    id: 'verify-identity',
    icon: 'check-decagram',
    title: 'Verify Identity',
    description: 'Use video calls before meeting in person',
    expandedContent:
      'Verify you\'re talking to a real person:\n\n• Request a video call before meeting\n• Look for verified profiles (blue checkmark)\n• Be cautious of profiles with only one photo\n• Watch for inconsistencies in their story\n• Do a reverse image search if you\'re suspicious\n• Report fake or suspicious profiles immediately',
  },
  {
    id: 'lgbtq-safety',
    icon: 'flag-variant',
    title: 'LGBTQ+ Safety',
    description: 'Specific safety considerations for our community',
    expandedContent:
      'Staying safe as an LGBTQ+ person:\n\n• Be selective about who knows your arrangement\n• Consider privacy settings carefully\n• Be aware of local laws and attitudes\n• Have an exit strategy if you feel unsafe\n• Connect with LGBTQ+ resources in your area\n• Trust your community - we\'re here to support each other',
  },
  {
    id: 'legal-protection',
    icon: 'gavel',
    title: 'Legal Protection',
    description: 'Consider formal agreements for lavender marriages',
    expandedContent:
      'Protect yourself legally:\n\n• Consult an LGBTQ+-friendly family lawyer\n• Consider a prenuptial agreement\n• Document your arrangement in writing\n• Understand immigration implications if applicable\n• Know your rights regarding property and finances\n• Keep agreements confidential and secure',
  },
  {
    id: 'mental-health',
    icon: 'brain',
    title: 'Mental Health',
    description: 'Take care of your emotional wellbeing',
    expandedContent:
      'Prioritize your mental health:\n\n• Set clear boundaries and expectations\n• Communicate openly and honestly\n• Seek therapy or counseling if needed\n• Connect with LGBTQ+ support groups\n• Remember you deserve respect and kindness\n• Take breaks from the app when needed',
  },
  {
    id: 'report-block',
    icon: 'alert-octagon',
    title: 'Report & Block',
    description: 'Use our safety tools to protect yourself',
    expandedContent:
      'Keep yourself safe on Accord:\n\n• Block users who make you uncomfortable\n• Report harassment, threats, or suspicious behavior\n• We review all reports within 24 hours\n• Your reports are anonymous\n• Serious violations result in account termination\n• Contact us directly for urgent safety concerns',
  },
];

const CRISIS_RESOURCES = [
  {
    id: 'trevor',
    name: 'The Trevor Project',
    description: '24/7 crisis support for LGBTQ+ youth',
    phone: '1-866-488-7386',
    website: 'https://www.thetrevorproject.org',
  },
  {
    id: 'trans-lifeline',
    name: 'Trans Lifeline',
    description: 'Support for transgender people',
    phone: '877-565-8860',
    website: 'https://translifeline.org',
  },
  {
    id: 'glbt-hotline',
    name: 'LGBT National Hotline',
    description: 'Peer support and local resources',
    phone: '1-888-843-4564',
    website: 'https://www.glbthotline.org',
  },
  {
    id: 'rainn',
    name: 'RAINN',
    description: 'Sexual assault support',
    phone: '1-800-656-4673',
    website: 'https://www.rainn.org',
  },
];

export default function SafetyCenter() {
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  const handleCallHotline = (phone: string, name: string) => {
    Alert.alert(
      `Call ${name}?`,
      `This will open your phone app to call ${phone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${phone}`);
          },
        },
      ]
    );
  };

  const handleOpenWebsite = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#9B87CE', '#B8A9DD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="shield-check" size={40} color="#fff" />
          <Text style={styles.headerTitle}>Safety Center</Text>
          <Text style={styles.headerSubtitle}>Your safety is our priority</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Safety Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Tips</Text>
          {SAFETY_TIPS.map((tip) => (
            <TouchableOpacity
              key={tip.id}
              style={styles.tipCard}
              onPress={() =>
                setExpandedTip(expandedTip === tip.id ? null : tip.id)
              }
              activeOpacity={0.7}
            >
              <View style={styles.tipHeader}>
                <View style={styles.tipIconContainer}>
                  <MaterialCommunityIcons
                    name={tip.icon as any}
                    size={24}
                    color="#9B87CE"
                  />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.tipDescription}>{tip.description}</Text>
                </View>
                <MaterialCommunityIcons
                  name={
                    expandedTip === tip.id ? 'chevron-up' : 'chevron-down'
                  }
                  size={24}
                  color="#9CA3AF"
                />
              </View>

              {expandedTip === tip.id && tip.expandedContent && (
                <View style={styles.expandedContent}>
                  <Text style={styles.expandedText}>{tip.expandedContent}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Crisis Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Crisis Resources</Text>
          <Text style={styles.sectionDescription}>
            If you're in crisis or need immediate support, these organizations
            are here to help 24/7.
          </Text>

          {CRISIS_RESOURCES.map((resource) => (
            <View key={resource.id} style={styles.resourceCard}>
              <View style={styles.resourceHeader}>
                <MaterialCommunityIcons
                  name="phone"
                  size={20}
                  color="#EF4444"
                />
                <Text style={styles.resourceName}>{resource.name}</Text>
              </View>
              <Text style={styles.resourceDescription}>
                {resource.description}
              </Text>

              <View style={styles.resourceActions}>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() =>
                    handleCallHotline(resource.phone, resource.name)
                  }
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.callButtonGradient}
                  >
                    <MaterialCommunityIcons name="phone" size={16} color="#fff" />
                    <Text style={styles.callButtonText}>{resource.phone}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.websiteButton}
                  onPress={() => handleOpenWebsite(resource.website)}
                >
                  <MaterialCommunityIcons
                    name="open-in-new"
                    size={16}
                    color="#9B87CE"
                  />
                  <Text style={styles.websiteButtonText}>Visit Website</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/settings/blocked-users')}
          >
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name="cancel" size={24} color="#9B87CE" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Blocked Users</Text>
              <Text style={styles.actionDescription}>
                Manage users you've blocked
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/settings/privacy')}
          >
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name="lock" size={24} color="#9B87CE" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Privacy Settings</Text>
              <Text style={styles.actionDescription}>
                Control who can see your profile
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() =>
              Linking.openURL('mailto:hello@joinaccord.app?subject=Safety Concern')
            }
          >
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons
                name="email"
                size={24}
                color="#9B87CE"
              />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Contact Support</Text>
              <Text style={styles.actionDescription}>
                Report safety concerns directly
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="heart" size={20} color="#B8A9DD" />
          <Text style={styles.footerText}>
            Your safety and wellbeing matter to us.{'\n'}
            Stay safe out there!
          </Text>
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
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  tipCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  expandedText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  resourceCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  resourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  resourceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  resourceDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  resourceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  callButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
  },
  callButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    flexShrink: 1,
  },
  websiteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#9B87CE',
    backgroundColor: '#fff',
    gap: 6,
  },
  websiteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9B87CE',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
});
