export const COLORS = {
  // Brand Core Palette (White & Dark Forest Green Brand Identity)
  forestGreen: '#0D381E',    // Deep Forest Green (Primary / Brand)
  cream: '#F8F9F5',          // Crisp Off-White / Cream (Canvas / Background)
  sage: '#EDF2EC',           // Sage Surface (Card Bodies & Containers)
  amber: '#D78B30',          // Warm Amber (Active Highlights, Badges, Counters)
  laurel: '#8C9E91',         // Laurel Muted (Borders, Secondary Text)

  // Primary System Aliases (Compatible with entire application)
  organic: '#0D381E',        // Deep Forest Green (Headers, Primary Text, Dark Surfaces)
  ivory: '#F8F9F5',          // Crisp Off-White Canvas
  apricot: '#D78B30',        // Warm Amber Accents
  natural: '#8C9E91',        // Laurel Muted Borders & Labels

  // Semantic & Auxiliary Colors
  canvas: '#F8F9F5',
  cardBg: '#EDF2EC',         // Sage Surface for Cards
  surfaceLight: '#FFFFFF',   // Crisp White for Inputs & Prominent Popups
  surfaceMuted: '#E4EDE3',   // Subtle Sage Tint
  surfaceDark: '#0D381E',    // Forest Green Dark Card Surfaces
  surfaceDarkHover: '#082614',
  textPrimary: '#0D381E',
  textSecondary: '#4A5E50',  // High-contrast Laurel Forest
  textMuted: '#8C9E91',
  textLight: '#F8F9F5',
  border: '#8C9E91',
  borderLight: '#D3DFD5',
  accent: '#D78B30',
  accentLight: '#FBEEDB',
  veg: '#2E7D32',
  vegBg: '#E8F5E9',
  nonVeg: '#C62828',
  nonVegBg: '#FFEBEE',
  danger: '#D32F2F',
  dangerBg: '#FFEBEE',
  white: '#FFFFFF',
  overlay: 'rgba(13, 56, 30, 0.65)',
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

