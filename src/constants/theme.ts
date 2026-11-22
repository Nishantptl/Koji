import { COLORS as THEME_COLORS } from '../theme/colors';

export const COLORS = {
  ...THEME_COLORS,

  // Brand Core Palette (White & Dark Forest Green Brand Identity)
  forestGreen: THEME_COLORS.forest,
  cream: THEME_COLORS.canvas,
  laurel: THEME_COLORS.slate,

  // Primary System Aliases (Compatible with entire application)
  organic: THEME_COLORS.forest,
  ivory: THEME_COLORS.canvas,
  apricot: THEME_COLORS.amber,
  natural: THEME_COLORS.slate,

  // Semantic & Auxiliary Colors
  cardBg: THEME_COLORS.sage,
  surfaceLight: THEME_COLORS.white,
  surfaceMuted: THEME_COLORS.sage,
  surfaceDark: THEME_COLORS.forest,
  surfaceDarkHover: THEME_COLORS.forest,
  textPrimary: THEME_COLORS.forest,
  textSecondary: THEME_COLORS.slate,
  textMuted: THEME_COLORS.slate,
  textLight: THEME_COLORS.canvas,
  borderLight: THEME_COLORS.border,
  accent: THEME_COLORS.amber,
  accentLight: THEME_COLORS.amberTint,
  veg: THEME_COLORS.success,
  vegBg: THEME_COLORS.successTint,
  nonVeg: THEME_COLORS.danger,
  nonVegBg: THEME_COLORS.dangerTint,
  dangerBg: THEME_COLORS.dangerTint,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FONTS = {
  regular: {
    fontWeight: '400' as const,
  },
  medium: {
    fontWeight: '500' as const,
  },
  semibold: {
    fontWeight: '600' as const,
  },
  bold: {
    fontWeight: '700' as const,
  },
  heavy: {
    fontWeight: '800' as const,
  },
};
