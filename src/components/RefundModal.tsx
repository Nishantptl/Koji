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
  RotateCcw,
  Banknote,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Order } from '../types';
import { COLORS } from '../theme/colors';

export interface RefundModalProps {
  visible: boolean;
  order: Order | null;
  refundAmount: number;
  reason?: string;
  isFullOrderCancellation?: boolean;
  onConfirm: (refundMethod: 'Cash') => void;
  onClose: () => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({
  visible,
  order,
  refundAmount,
  reason,
  isFullOrderCancellation = false,
  onConfirm,
  onClose,
}) => {
  if (!visible || !order) return null;

  const cleanToken = order.token ? order.token.replace(/^#+/, '') : '';

  const handleConfirmCashRefund = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onConfirm('Cash');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              {/* Header Badge & Title */}
              <View style={styles.header}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.badge,
                      isFullOrderCancellation ? styles.badgeDanger : styles.badgeAmber,
                    ]}
                  >
                    <RotateCcw
                      size={13}
                      color={isFullOrderCancellation ? COLORS.danger : COLORS.amber}
                      strokeWidth={2.4}
                    />
                    <Text
                      style={[
                        styles.badgeText,
                        isFullOrderCancellation ? styles.badgeTextDanger : styles.badgeTextAmber,
                      ]}
                    >
                      {isFullOrderCancellation ? 'Order Cancellation' : 'Dish Refund'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={onClose}
                    style={styles.closeBtn}
                    accessibilityLabel="Close refund modal"
                  >
                    <X size={16} color={COLORS.slate} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.title}>
                  {isFullOrderCancellation ? 'Cancel Order & Issue Refund' : 'Issue Customer Refund'}
                </Text>

                <Text style={styles.subtitle}>
                  Token #{cleanToken}
                  {reason ? ` • ${reason}` : ' • Item Cancelled'}
                </Text>
              </View>

              {/* Hero Callout Box: Refund Amount */}
              <View style={styles.heroBox}>
                <Text style={styles.heroLabel}>REFUND DUE TO CUSTOMER</Text>
                <Text style={styles.heroAmount}>
                  ₹{refundAmount.toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Action Button: 1-Tap Cash Refund */}
              <View style={styles.buttonStack}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleConfirmCashRefund}
                  style={styles.cashRefundBtn}
                >
                  <View style={styles.btnIconCircleCash}>
                    <Banknote size={20} color={COLORS.forest} strokeWidth={2.2} />
                  </View>
                  <View style={styles.btnTextCol}>
                    <Text style={styles.btnPrimaryTextCash}>
                      Refund ₹{refundAmount.toLocaleString('en-IN')} via Cash
                    </Text>
                    <Text style={styles.btnSubTextCash}>
                      Deduct ₹{refundAmount.toLocaleString('en-IN')} from till cash
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Cancel / Dismiss CTA */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onClose}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissBtnText}>Cancel (Keep Order Unchanged)</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(10, 25, 16, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  header: {
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeDanger: {
    backgroundColor: COLORS.dangerTint,
    borderColor: COLORS.danger,
  },
  badgeAmber: {
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badgeTextDanger: {
    color: COLORS.danger,
  },
  badgeTextAmber: {
    color: COLORS.amber,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.forest,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.slate,
  },
  heroBox: {
    backgroundColor: '#FFF8F6',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#FFD4CC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.danger,
    letterSpacing: 1,
    marginBottom: 2,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.danger,
    letterSpacing: -0.5,
  },
  buttonStack: {
    marginBottom: 16,
  },
  cashRefundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF5EF',
    borderWidth: 1.5,
    borderColor: COLORS.forest,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  btnIconCircleCash: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D6E8D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTextCol: {
    flex: 1,
  },
  btnPrimaryTextCash: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.forest,
  },
  btnSubTextCash: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.slate,
    marginTop: 1,
  },

  dismissBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slate,
  },
});
