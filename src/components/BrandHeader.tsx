import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface BrandHeaderProps {
  subtitle?: string;
  rightElement?: React.ReactNode;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  subtitle = 'Asian Crafted Fusion',
  rightElement,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.leftGroup}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.circularBadge}
          resizeMode="cover"
        />
        <View style={styles.titleGroup}>
          <Text style={styles.brandTitle}>KŌJI</Text>
          <Text style={styles.brandSubtitle}>{subtitle}</Text>
        </View>
      </View>

      {rightElement ? <View style={styles.rightGroup}>{rightElement}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 6,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  circularBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.organic,
    backgroundColor: COLORS.white,
  },
  titleGroup: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 22,
    color: COLORS.organic,
    ...FONTS.heavy,
    letterSpacing: 0.8,
    lineHeight: 24,
  },
  brandSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    ...FONTS.medium,
    letterSpacing: 0.4,
    marginTop: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
});
