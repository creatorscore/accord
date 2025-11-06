import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StarRating from './StarRating';
import { useTranslation } from 'react-i18next';

interface ReviewCategorySliderProps {
  categoryKey: string;
  categoryName: string;
  description: string;
  icon: string;
  value: number;
  onValueChange: (value: number) => void;
}

export default function ReviewCategorySlider({
  categoryKey,
  categoryName,
  description,
  icon,
  value,
  onValueChange,
}: ReviewCategorySliderProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Category Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={icon as any} size={20} color="#9B87CE" />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.categoryName}>{categoryName}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      {/* Star Rating - Editable */}
      <View style={styles.starsRow}>
        <StarRating
          rating={value}
          size={36}
          color="#9B87CE"
          editable
          onRatingChange={onValueChange}
        />
        <Text style={styles.ratingValue}>{value}</Text>
      </View>

      {/* Quick Tap Buttons */}
      <View style={styles.quickButtons}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <TouchableOpacity
            key={rating}
            style={[
              styles.quickButton,
              value === rating && styles.quickButtonActive,
            ]}
            onPress={() => onValueChange(rating)}
          >
            <Text
              style={[
                styles.quickButtonText,
                value === rating && styles.quickButtonTextActive,
              ]}
            >
              {rating}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#9B87CE',
    marginLeft: 16,
    minWidth: 30,
  },
  quickButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quickButtonActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#9B87CE',
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  quickButtonTextActive: {
    color: '#9B87CE',
  },
});
