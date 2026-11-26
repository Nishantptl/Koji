import React, { useState } from 'react';
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
  Smartphone,
  Printer,
  Check,
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
  onConfirm: (refundMethod: 'Cash' | 'UPI', shouldPrintKot: boolean) => void;
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
  const [shouldPrintKot, setShouldPrintKot] = useState<boolean>(true);

  if (!visible || !order) return null;

  const cleanToken = order.token ? order.token.replace(/^#+/, '') : '';

  const handleSelectRefund = (method: 'Cash' | 'UPI') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onConfirm(method, shouldPrintKot);
  };

  const togglePrintKot = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setShouldPrintKot((prev) => !prev);
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

              {/* Action Buttons: 1-Tap Cash vs UPI */}
              <Text style={styles.selectLabel}>CHOOSE REFUND METHOD</Text>

              <View style={styles.buttonStack}>
                {/* Option 1: Refund via Cash */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleSelectRefund('Cash')}
                  style={styles.cashRefundBtn}
                >
                  <View style={styles.btnIconCircleCash}>
                    <Banknote size={20} color={COLORS.forest} strokeWidth={2.2} />
                  </View>
                  <View style={styles.btnTextCol}>
                    <Text style={styles.btnPrimaryTextCash}>Refund via Cash</Text>
                    <Text style={styles.btnSubTextCash}>
                      Deduct ₹{refundAmount.toLocaleString('en-IN')} from till cash
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: Refund via UPI */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleSelectRefund('UPI')}
                  style={styles.upiRefundBtn}
                >
                  <View style={styles.btnIconCircleUpi}>
                    <Smartphone size={20} color="#0D47A1" strokeWidth={2.2} />
                  </View>
                  <View style={styles.btnTextCol}>
                    <Text style={styles.btnPrimaryTextUpi}>Refund via UPI</Text>
                    <Text style={styles.btnSubTextUpi}>
                      Reverse ₹{refundAmount.toLocaleString('en-IN')} via UPI
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Checkbox: Print Cancelled KOT Alert */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={togglePrintKot}
                style={styles.printToggleRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    shouldPrintKot && styles.checkboxActive,
                  ]}
                >
                  {shouldPrintKot && (
                    <Check size={12} color={COLORS.white} strokeWidth={3} />
                  )}
                </View>
                <Printer size={15} color={COLORS.forest} strokeWidth={2.2} />
                <Text style={styles.printToggleText}>
                  Print cancelled alert to kitchen (RawBT KOT)
                </Text>
              </TouchableOpacity>

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
  selectLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  buttonStack: {
    gap: 10,
    marginBottom: 14,
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
  upiRefundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1.5,
    borderColor: '#1976D2',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  btnIconCircleUpi: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D6E4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryTextUpi: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0D47A1',
  },
  btnSubTextUpi: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.slate,
    marginTop: 1,
  },
  printToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.slate,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxActive: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  printToggleText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.forest,
    flex: 1,
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
