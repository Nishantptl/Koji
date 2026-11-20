import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface CategoryBarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  const handlePress = (category: string) => {
    if (category !== selectedCategory) {
      try {
        Haptics.selectionAsync();
      } catch {
        // Fallback
      }
      onSelectCategory(category);
    }
  };

  return (
    <View style={styles.outerWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {categories.map((category) => {
          const isActive = category === selectedCategory;
          return (
            <TouchableOpacity
              key={category}
              activeOpacity={0.75}
              onPress={() => handlePress(category)}
              style={[
                styles.pill,
                isActive ? styles.activePill : styles.inactivePill,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  isActive ? styles.activePillText : styles.inactivePillText,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    height: 52,
    justifyContent: 'center',
    marginVertical: 2,
  },
  scrollView: {
    flexGrow: 0,
    height: 48,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 4,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePill: {
    backgroundColor: COLORS.organic,      // #3F422E background
    borderColor: COLORS.organic,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  inactivePill: {
    backgroundColor: '#FFFDF7',
    borderColor: COLORS.borderLight,       // Natural border
  },
  pillText: {
    fontSize: 13,
    letterSpacing: 0.2,
    lineHeight: 17,
  },
  activePillText: {
    color: COLORS.ivory,                  // #F5E6C5 text
    ...FONTS.bold,
  },
  inactivePillText: {
    color: COLORS.organic,
    ...FONTS.medium,
  },
});
