import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface QuickFact {
  icon?: string;
  emoji?: string;
  label: string;
  value: string;
  color?: string;
}

interface ProfileQuickFactsProps {
  facts: QuickFact[];
}

export default function ProfileQuickFacts({ facts }: ProfileQuickFactsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {facts.map((fact, index) => (
        <MotiView
          key={index}
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: index * 100 }}
          style={styles.factCard}
        >
          <LinearGradient
            colors={
              fact.color
                ? [fact.color, fact.color]
                : ['#F3E8FF', '#FDF2F8']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {fact.icon && (
              <MaterialCommunityIcons
                name={fact.icon as any}
                size={24}
                color="#A08AB7"
              />
            )}
            {fact.emoji && <Text style={styles.emoji}>{fact.emoji}</Text>}
            <Text style={styles.label}>{fact.label}</Text>
            <Text style={styles.value}>{fact.value}</Text>
          </LinearGradient>
        </MotiView>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    zIndex: 10,
    overflow: 'visible',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  factCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  gradient: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    minWidth: 120,
    alignItems: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
});