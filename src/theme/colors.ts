export const COLORS = {
  // Core Brand & Surfaces
  forest: '#0D381E',      // Primary brand, CTAs, active tabs/pills, primary headings, completed pill text
  canvas: '#F8F9F5',      // Main screen background & inset summary containers
  sage: '#EDF2EC',        // Secondary card surfaces, Today's Shift KPI container, subtle chips
  white: '#FFFFFF',       // Elevated ticket cards, dish cards, modals, unselected pills
  slate: '#8C9E91',       // Secondary/muted text, timestamps, descriptions
  border: '#D5DFD8',      // Standard 1px borders and dividers

  // Status & Semantic Tints
  amber: '#D78B30',       // Token badges, In Kitchen KPI, pending Payment / Mark Done text & borders
  amberTint: '#FDF6EC',   // Soft background for token badges, pending buttons, and prep notes

  success: '#16A34A',     // Completed/paid pill borders, WhatsApp actions, and FSSAI Veg indicator
  successTint: '#E8F8EE', // Soft mint background for completed/paid pills (Edit Order, Paid, Done, Notified)

  danger: '#DC2626',      // Cancel buttons, Reset Cart icon, Clear Shift trash icon, and FSSAI Non-Veg indicator
  dangerTint: '#FDECEC',  // Soft coral background for Clear Shift and Cancel item pills

  // Modal / Surface Backdrop
  overlay: 'rgba(13, 56, 30, 0.65)',
} as const;

export type ColorToken = keyof typeof COLORS;
export type ColorValue = typeof COLORS[ColorToken];
