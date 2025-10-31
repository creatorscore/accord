import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface StarRatingProps {
  rating: number; // 1-5 or decimal for display
  maxStars?: number;
  size?: number;
  color?: string;
  emptyColor?: string;
  editable?: boolean;
  onRatingChange?: (rating: number) => void;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 24,
  color = '#F59E0B',
  emptyColor = '#D1D5DB',
  editable = false,
  onRatingChange,
}: StarRatingProps) {
  const handleStarPress = (index: number) => {
    if (editable && onRatingChange) {
      onRatingChange(index + 1);
    }
  };

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const filled = rating >= starValue;
    const halfFilled = !filled && rating > index && rating < starValue;

    const iconName = filled
      ? 'star'
      : halfFilled
      ? 'star-half-full'
      : 'star-outline';

    const StarComponent = editable ? TouchableOpacity : View;

    return (
      <StarComponent
        key={index}
        onPress={() => handleStarPress(index)}
        disabled={!editable}
        style={styles.starContainer}
      >
        <MaterialCommunityIcons
          name={iconName}
          size={size}
          color={filled || halfFilled ? color : emptyColor}
        />
      </StarComponent>
    );
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starContainer: {
    marginHorizontal: 2,
  },
});
