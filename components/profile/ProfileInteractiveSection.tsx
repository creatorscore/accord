import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface InteractiveSectionProps {
  title: string;
  items: Array<{
    icon?: string;
    emoji?: string;
    label: string;
    value: string;
    detail?: string;
  }>;
  expandable?: boolean;
}

export default function ProfileInteractiveSection({
  title,
  items,
  expandable = true,
}: InteractiveSectionProps) {
  const [expanded, setExpanded] = useState(!expandable);
  const displayItems = expanded ? items : items.slice(0, 3);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 500 }}
      style={styles.container}
    >
      <TouchableOpacity
        onPress={() => expandable && setExpanded(!expanded)}
        disabled={!expandable}
        activeOpacity={0.8}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {expandable && items.length > 3 && (
            <MotiView
              animate={{ rotate: expanded ? '180deg' : '0deg' }}
              transition={{ type: 'spring' }}
            >
              <MaterialCommunityIcons
                name="chevron-down"
                size={24}
                color="#9B87CE"
              />
            </MotiView>
          )}
        </View>
      </TouchableOpacity>

      <AnimatePresence>
        {displayItems.map((item, index) => (
          <MotiView
            key={`${item.label}-${index}`}
            from={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'timing', duration: 300, delay: index * 50 }}
          >
            <TouchableOpacity
              style={styles.item}
              activeOpacity={0.7}
            >
              <View style={styles.itemLeft}>
                {item.icon && (
                  <View style={styles.iconContainer}>
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={20}
                      color="#9B87CE"
                    />
                  </View>
                )}
                {item.emoji && (
                  <Text style={styles.emoji}>{item.emoji}</Text>
                )}
                <View style={styles.textContainer}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemValue}>{item.value}</Text>
                  {item.detail && (
                    <Text style={styles.itemDetail}>{item.detail}</Text>
                  )}
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#D1D5DB"
              />
            </TouchableOpacity>
          </MotiView>
        ))}
      </AnimatePresence>

      {expandable && !expanded && items.length > 3 && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          <TouchableOpacity
            onPress={() => setExpanded(true)}
            activeOpacity={0.7}
            style={styles.moreButton}
          >
            <Text style={styles.moreText}>
              +{items.length - 3} more
            </Text>
          </TouchableOpacity>
        </MotiView>
      )}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  textContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  itemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  itemDetail: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  moreButton: {
    paddingVertical: 8,
  },
  moreText: {
    fontSize: 14,
    color: '#9B87CE',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});