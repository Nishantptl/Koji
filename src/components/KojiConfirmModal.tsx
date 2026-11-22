import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../theme/colors';

export interface KojiConfirmModalProps {
  visible: boolean;
  variant?: 'danger' | 'amber' | 'forest'; // Default 'danger' for destructive actions
  badgeLabel: string;                      // e.g., "Clear Shift", "Cancel Item", "Reset Cart", "Delete Dish", "Payment Pending"
  title: string;                           // Bold main headline
  message: string;                         // Clear description of the action
  highlightText?: string;                  // Optional inset box text (e.g., "Token #04 • California Avocado (₹320)")
  heroLabel?: string;                      // Optional hero box label (e.g., "DUE BALANCE")
  heroAmount?: string;                     // Optional hero box amount (e.g., "₹250")
  primaryLabel: string;                    // Primary button text (e.g., "Yes, Clear Shift", "Cancel Item")
  onPrimaryPress: () => void;
  secondaryLabel?: string;                 // Optional 2nd button (used for "Mark Done (Keep Unpaid)" if shared)
  onSecondaryPress?: () => void;
  cancelLabel?: string;                    // Default "Keep / Cancel"
  onClose: () => void;
}

export const KojiConfirmModal: React.FC<KojiConfirmModalProps> = ({
  visible,
  variant = 'danger',
  badgeLabel,
  title,
  message,
  highlightText,
  heroLabel,
  heroAmount,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
  cancelLabel = 'Keep / Cancel',
  onClose,
}) => {
  if (!visible) return null;

  // Determine badge styling and icon based on variant
  const getBadgeConfig = () => {
    switch (variant) {
      case 'amber':
        return {
          bg: COLORS.amberTint,
          border: COLORS.amber,
          text: COLORS.amber,
          icon: <AlertCircle size={14} color={COLORS.amber} strokeWidth={2.5} />,
        };
      case 'forest':
        return {
          bg: COLORS.successTint,
          border: COLORS.forest,
          text: COLORS.forest,
          icon: <CheckCircle2 size={14} color={COLORS.forest} strokeWidth={2.5} />,
        };
      case 'danger':
      default:
        return {
          bg: COLORS.dangerTint,
          border: COLORS.danger,
          text: COLORS.danger,
          icon: <AlertTriangle size={14} color={COLORS.danger} strokeWidth={2.5} />,
        };
    }
  };

  const badgeConfig = getBadgeConfig();
  const isDestructive = variant === 'danger';

  const handlePrimary = () => {
    try {
      if (isDestructive) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}
    onPrimaryPress();
  };

  const handleSecondary = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onSecondaryPress?.();
  };

  const handleClose = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              {/* Top Row: Tinted Pill Badge + Circular Close Button */}
              <View style={styles.topRow}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: badgeConfig.bg,
                      borderColor: badgeConfig.border,
                    },
                  ]}
                >
                  {badgeConfig.icon}
                  <Text style={[styles.badgeText, { color: badgeConfig.text }]}>
                    {badgeLabel}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={COLORS.slate} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              {/* Body: Title & Description */}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              {/* Optional Highlight Inset Box */}
              {!!highlightText && (
                <View style={styles.highlightBox}>
                  <Text style={styles.highlightText}>{highlightText}</Text>
                </View>
              )}

              {/* Optional Hero Due Box */}
              {!!heroAmount && (
                <View style={styles.heroDueBox}>
                  <Text style={styles.dueLabel}>{heroLabel || 'DUE BALANCE'}</Text>
                  <Text style={styles.dueAmount}>{heroAmount}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonGroup}>
                {/* Primary Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handlePrimary}
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: isDestructive
                        ? COLORS.danger
                        : COLORS.forest,
                    },
                  ]}
                >
                  <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                </TouchableOpacity>

                {/* Optional Secondary Button */}
                {!!secondaryLabel && !!onSecondaryPress && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSecondary}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {secondaryLabel}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Optional Footer Cancel Button */}
                {!!cancelLabel && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleClose}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 56, 30, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.forest,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.slate,
    marginBottom: 16,
  },
  highlightBox: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },
  highlightText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.forest,
    textAlign: 'center',
  },
  heroDueBox: {
    backgroundColor: COLORS.canvas,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dueLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.amber,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dueAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.forest,
    letterSpacing: -0.5,
  },
  buttonGroup: {
    width: '100%',
  },
  primaryButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.amberTint,
    borderWidth: 1,
    borderColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: COLORS.amber,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 12,
  },
  cancelButtonText: {
    color: COLORS.slate,
    fontSize: 14,
    fontWeight: '600',
  },
});
