import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

interface VegBadgeProps {
  isVeg: boolean;
  size?: number;
}

export const VegBadge: React.FC<VegBadgeProps> = ({ isVeg, size = 16 }) => {
  const color = isVeg ? COLORS.success : COLORS.danger;
  const innerSize = Math.max(size * 0.45, 6);

  return (
    <View
      style={[
        styles.square,
        {
          width: size,
          height: size,
          borderColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.circle,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  square: {
    borderWidth: 1.5,
    borderRadius: 3,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {},
});

