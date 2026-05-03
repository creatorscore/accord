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
import { useTranslation } from 'react-i18next';

interface SafetyTip {
  id: string;
  icon: string;
  i18nKey: string;
}

const SAFETY_TIPS: SafetyTip[] = [
  { id: 'meet-safely', icon: 'shield-account', i18nKey: 'meetSafely' },
  { id: 'protect-info', icon: 'lock', i18nKey: 'protectInfo' },
  { id: 'verify-identity', icon: 'check-decagram', i18nKey: 'verifyIdentity' },
  { id: 'lgbtq-safety', icon: 'flag-variant', i18nKey: 'lgbtqSafety' },
  { id: 'legal-protection', icon: 'gavel', i18nKey: 'legalProtection' },
  { id: 'mental-health', icon: 'brain', i18nKey: 'mentalHealth' },
  { id: 'report-block', icon: 'alert-octagon', i18nKey: 'reportBlock' },
];

interface CrisisResource {
  id: string;
  i18nKey: string;
  phone: string;
  website: string;
}

const CRISIS_RESOURCES: CrisisResource[] = [
  { id: 'trevor', i18nKey: 'trevor', phone: '1-866-488-7386', website: 'https://www.thetrevorproject.org' },
  { id: 'trans-lifeline', i18nKey: 'transLifeline', phone: '877-565-8860', website: 'https://translifeline.org' },
  { id: 'glbt-hotline', i18nKey: 'glbtHotline', phone: '1-888-843-4564', website: 'https://www.glbthotline.org' },
  { id: 'rainn', i18nKey: 'rainn', phone: '1-800-656-4673', website: 'https://www.rainn.org' },
];

export default function SafetyCenter() {
  const { t } = useTranslation();
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  const handleCallHotline = (phone: string, name: string | undefined) => {
    Alert.alert(
      t('safetyCenter.alerts.callTitle', { name }),
      t('safetyCenter.alerts.callMessage', { phone }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('safetyCenter.alerts.call'),
          onPress: () => {
            Linking.openURL(`tel:${phone}`).catch(() => {});
          },
        },
      ]
    );
  };

  const handleOpenWebsite = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header - now scrolls with content */}
        <LinearGradient
          colors={['#A08AB7', '#CDC2E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <MaterialCommunityIcons name="shield-check" size={40} color="#fff" />
            <Text style={styles.headerTitle}>{t('safetyCenter.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('safetyCenter.subtitle')}</Text>
          </View>
        </LinearGradient>

        {/* Safety Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('safetyCenter.safetyTipsTitle')}</Text>
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
                    color="#A08AB7"
                  />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>{t(`safetyCenter.tips.${tip.i18nKey}.title`)}</Text>
                  <Text style={styles.tipDescription}>{t(`safetyCenter.tips.${tip.i18nKey}.description`)}</Text>
                </View>
                <MaterialCommunityIcons
                  name={
                    expandedTip === tip.id ? 'chevron-up' : 'chevron-down'
                  }
                  size={24}
                  color="#9CA3AF"
                />
              </View>

              {expandedTip === tip.id && (
                <View style={styles.expandedContent}>
                  <Text style={styles.expandedText}>{t(`safetyCenter.tips.${tip.i18nKey}.expanded`)}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Crisis Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('safetyCenter.crisisResourcesTitle')}</Text>
          <Text style={styles.sectionDescription}>
            {t('safetyCenter.crisisResourcesDescription')}
          </Text>

          {CRISIS_RESOURCES.map((resource) => (
            <View key={resource.id} style={styles.resourceCard}>
              <View style={styles.resourceHeader}>
                <MaterialCommunityIcons
                  name="phone"
                  size={20}
                  color="#EF4444"
                />
                <Text style={styles.resourceName}>{t(`safetyCenter.resources.${resource.i18nKey}.name`)}</Text>
              </View>
              <Text style={styles.resourceDescription}>
                {t(`safetyCenter.resources.${resource.i18nKey}.description`)}
              </Text>

              <View style={styles.resourceActions}>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() =>
                    handleCallHotline(resource.phone, t(`safetyCenter.resources.${resource.i18nKey}.name`))
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
                    color="#A08AB7"
                  />
                  <Text style={styles.websiteButtonText}>{t('safetyCenter.visitWebsite')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('safetyCenter.quickActionsTitle')}</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/settings/blocked-users')}
          >
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name="cancel" size={24} color="#A08AB7" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{t('safetyCenter.actions.blockedUsers')}</Text>
              <Text style={styles.actionDescription}>
                {t('safetyCenter.actions.blockedUsersDesc')}
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
              <MaterialCommunityIcons name="lock" size={24} color="#A08AB7" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{t('safetyCenter.actions.privacySettings')}</Text>
              <Text style={styles.actionDescription}>
                {t('safetyCenter.actions.privacySettingsDesc')}
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
            onPress={async () => {
              try {
                const mailtoUrl = 'mailto:hello@joinaccord.app?subject=Safety Concern';
                const canOpen = await Linking.canOpenURL(mailtoUrl);
                if (canOpen) {
                  await Linking.openURL(mailtoUrl);
                } else {
                  Alert.alert(
                    t('safetyCenter.actions.contactSupport'),
                    t('safetyCenter.alerts.emailUs'),
                    [{ text: t('common.ok') }]
                  );
                }
              } catch (error) {
                Alert.alert(
                  t('safetyCenter.actions.contactSupport'),
                  t('safetyCenter.alerts.emailUs'),
                  [{ text: t('common.ok') }]
                );
              }
            }}
          >
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons
                name="email"
                size={24}
                color="#A08AB7"
              />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{t('safetyCenter.actions.contactSupport')}</Text>
              <Text style={styles.actionDescription}>
                {t('safetyCenter.actions.contactSupportDesc')}
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
          <MaterialCommunityIcons name="heart" size={20} color="#CDC2E5" />
          <Text style={styles.footerText}>
            {t('safetyCenter.footerText')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#A08AB7', // Match header for smooth bounce effect
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
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
  },
  section: {
    padding: 20,
    backgroundColor: '#F9FAFB',
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
    borderColor: '#A08AB7',
    backgroundColor: '#fff',
    gap: 6,
  },
  websiteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A08AB7',
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
    backgroundColor: '#F9FAFB',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
});
