import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

interface TokenBadgeProps {
  token: string;
  variant?: 'apricot' | 'organic' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  token,
  variant = 'apricot',
  size = 'md',
  style,
  textStyle,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'organic':
        return {
          bg: COLORS.organic,
          text: COLORS.ivory,
          border: COLORS.organic,
        };
      case 'subtle':
        return {
          bg: COLORS.surfaceMuted,
          text: COLORS.organic,
          border: COLORS.borderLight,
        };
      case 'apricot':
      default:
        return {
          bg: '#FDF1E2',
          text: COLORS.apricot,
          border: COLORS.apricot,
        };
    }
  };

  const colors = getColors();

  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: 8,
          paddingVertical: 3,
          fontSize: 12,
          borderRadius: 6,
        };
      case 'lg':
        return {
          paddingHorizontal: 14,
          paddingVertical: 7,
          fontSize: 18,
          borderRadius: 10,
        };
      case 'md':
      default:
        return {
          paddingHorizontal: 10,
          paddingVertical: 5,
          fontSize: 14,
          borderRadius: 8,
        };
    }
  };

  const dim = getDimensions();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: dim.paddingHorizontal,
          paddingVertical: dim.paddingVertical,
          borderRadius: dim.borderRadius,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: dim.fontSize,
          },
          textStyle,
        ]}
      >
        {token}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1.2,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...FONTS.heavy,
    letterSpacing: 0.5,
  },
});

