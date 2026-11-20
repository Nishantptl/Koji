import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Plus, Minus, Utensils, Ban } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MenuItem } from '../types';
import { VegBadge } from './VegBadge';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onIncrement: (item: MenuItem) => void;
  onDecrement: (item: MenuItem) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  quantity,
  onIncrement,
  onDecrement,
}) => {
  const isInCart = quantity > 0;
  const isAvailable = item.isAvailable ?? true;
  const [imageError, setImageError] = useState(false);

  const handleMinus = (e: any) => {
    e.stopPropagation?.();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }
    onDecrement(item);
  };

  const handlePlus = (e: any) => {
    e.stopPropagation?.();
    if (!isAvailable) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }
    onIncrement(item);
  };

  return (
    // Card is a View container - tapping card body does NOT trigger item addition
    <View
      style={[
        styles.card,
        isInCart && styles.cardActive,
        !isAvailable && styles.cardDisabled,
      ]}
    >
      <View style={styles.contentRow}>
        {/* Left Column: Dish photo thumbnail (square with rounded corners, ~76x76) */}
        <View style={styles.thumbnailWrapper}>
          {item.imageUrl && !imageError ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.thumbnailFallback}>
              <Utensils size={24} color={COLORS.natural} />
            </View>
          )}
          {!isAvailable && (
            <View style={styles.soldOutOverlay}>
              <Text style={styles.soldOutOverlayText}>SOLD OUT</Text>
            </View>
          )}
        </View>

        {/* Right Column: flex: 1, stacked vertically */}
        <View style={styles.rightCol}>
          {/* Row 1: Dish Name + Veg/Non-Veg Dot Indicator */}
          <View style={styles.titleRow}>
            <View style={styles.titleWithVeg}>
              <VegBadge isVeg={item.isVeg} size={14} />
              <Text
                style={[styles.name, !isAvailable && styles.textDisabled]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.name}
              </Text>
            </View>
            {!isAvailable && (
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutBadgeText}>Sold Out</Text>
              </View>
            )}
          </View>

          {/* Row 2: Dish Description (#9F886F, trimmed/clean) */}
          {item.description ? (
            <Text
              style={styles.description}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.description}
            </Text>
          ) : null}

          {/* Row 3: Bottom Action Row (justifyContent: 'space-between', alignItems: 'center') */}
          <View style={styles.bottomRow}>
            {/* Price on the left in bold #3F422E */}
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>₹{item.price}</Text>
            </View>

            {/* + ADD or [- / count / +] counter pill on the right */}
            <View style={styles.actionContainer}>
              {!isAvailable ? (
                <View style={styles.soldOutButton}>
                  <Ban size={11} color={COLORS.textMuted} />
                  <Text style={styles.soldOutButtonText}>UNAVAIL</Text>
                </View>
              ) : isInCart ? (
                <View style={styles.stepperPill}>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.stepperButton}
                    onPress={handleMinus}
                    activeOpacity={0.7}
                  >
                    <Minus size={14} color={COLORS.ivory} strokeWidth={2.6} />
                  </TouchableOpacity>

                  <Text style={styles.stepperQty}>{quantity}</Text>

                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.stepperButton}
                    onPress={handlePlus}
                    activeOpacity={0.7}
                  >
                    <Plus size={14} color={COLORS.ivory} strokeWidth={2.6} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handlePlus}
                  style={styles.addButton}
                >
                  <Plus size={14} color={COLORS.organic} strokeWidth={2.6} />
                  <Text style={styles.addButtonText}>ADD</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: {
    borderColor: COLORS.apricot,
    backgroundColor: '#FFFDF5',
    shadowOpacity: 0.1,
    elevation: 3,
  },
  cardDisabled: {
    opacity: 0.65,
    backgroundColor: '#F7F4EC',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailWrapper: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceMuted,
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    position: 'relative',
  },
  thumbnail: {
    width: 76,
    height: 76,
  },
  thumbnailFallback: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceMuted,
  },
  soldOutOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(63, 66, 46, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutOverlayText: {
    color: COLORS.ivory,
    fontSize: 9,
    ...FONTS.heavy,
    letterSpacing: 0.5,
  },
  rightCol: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 76,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleWithVeg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 4,
  },
  name: {
    fontSize: 14,
    color: COLORS.organic,
    ...FONTS.bold,
    lineHeight: 18,
    flex: 1,
  },
  textDisabled: {
    color: COLORS.textSecondary,
  },
  soldOutBadge: {
    backgroundColor: '#EEDCBA',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  soldOutBadgeText: {
    fontSize: 9,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  description: {
    fontSize: 11,
    color: COLORS.natural,               // #9F886F trimmed/clean
    ...FONTS.regular,
    lineHeight: 15,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  priceContainer: {
    justifyContent: 'center',
  },
  priceText: {
    fontSize: 16,
    color: COLORS.organic,               // bold #3F422E
    ...FONTS.heavy,
  },
  actionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.organic,
    backgroundColor: COLORS.ivory,
  },
  addButtonText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.heavy,
    letterSpacing: 0.5,
  },
  soldOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surfaceMuted,
  },
  soldOutButtonText: {
    fontSize: 10,
    color: COLORS.textMuted,
    ...FONTS.heavy,
    letterSpacing: 0.3,
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.organic,
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 7,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  stepperButton: {
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    fontSize: 13,
    color: COLORS.ivory,
    ...FONTS.heavy,
    minWidth: 16,
    textAlign: 'center',
  },
});
