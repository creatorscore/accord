import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface IntroMessagesProps {
  visible: boolean;
  matchName: string;
  compatibilityScore?: number;
  distance?: number;
  occupation?: string;
  city?: string;
  onSelectMessage: (message: string) => void;
  onClose: () => void;
}

export default function IntroMessages({
  visible,
  matchName,
  compatibilityScore,
  distance,
  occupation,
  city,
  onSelectMessage,
  onClose,
}: IntroMessagesProps) {
  if (!visible) return null;

  const generateMessages = (): string[] => {
    const messages: string[] = [];

    // Compatibility-focused
    if (compatibilityScore && compatibilityScore >= 80) {
      messages.push(`Hey ${matchName}! We're a ${compatibilityScore}% match - I'd love to learn more about you.`);
    } else if (compatibilityScore) {
      messages.push(`Hi ${matchName}, your profile really resonated with me. Would love to chat!`);
    }

    // Location-based
    if (city) {
      messages.push(`Hey ${matchName}! Fellow ${city} person - what's your favorite spot in the area?`);
    } else if (distance && distance < 10) {
      messages.push(`Hi ${matchName}, I see we're nearby! How long have you been in the area?`);
    }

    // Occupation-based
    if (occupation) {
      messages.push(`Hey ${matchName}, I noticed you're ${occupation.startsWith('a') || occupation.startsWith('an') ? occupation : `a ${occupation}`}. How's that going for you?`);
    }

    // Direct & honest approach
    messages.push(`Hi ${matchName}, I really appreciate your approach to finding a meaningful arrangement. I think we're looking for something similar.`);

    messages.push(`Hey ${matchName}! Your profile caught my eye. I'd love to connect and see if we're aligned on our goals.`);

    // Casual & friendly
    messages.push(`Hi ${matchName}! Your profile stood out to me. Would you like to chat?`);

    // Return max 4 messages
    return messages.slice(0, 4);
  };

  const messages = generateMessages();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.1)', 'rgba(236, 72, 153, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <MaterialCommunityIcons name="auto-fix" size={20} color="#9B87CE" />
            <Text style={styles.headerTitle}>Intro Message Suggestions</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.messagesContainer}
      >
        {messages.map((message, index) => (
          <TouchableOpacity
            key={index}
            style={styles.messageCard}
            onPress={() => onSelectMessage(message)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#F3F4F6', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.messageCardGradient}
            >
              <Text style={styles.messageText} numberOfLines={3}>
                {message}
              </Text>
              <View style={styles.useButton}>
                <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#9B87CE" />
                <Text style={styles.useButtonText}>Use</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <MaterialCommunityIcons name="information-outline" size={16} color="#6B7280" />
        <Text style={styles.footerText}>
          Tap to use a suggestion, or write your own message
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9B87CE',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  messageCard: {
    width: 260,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  messageCardGradient: {
    padding: 16,
    height: 140,
    justifyContent: 'space-between',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    flex: 1,
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  useButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9B87CE',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
