import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import {
  X,
  Smartphone,
  Banknote,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
  QrCode as QrIcon,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import { Order, PaymentMethod, UpiConfig } from '../types';
import { TokenBadge } from './TokenBadge';
import { getUpiConfig } from '../services/storage';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface PaymentModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onPaymentCompleted: (orderId: string, method: PaymentMethod, amount?: number) => void;
  initialViewMode?: 'select' | 'upi_qr';
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  order,
  onClose,
  onPaymentCompleted,
  initialViewMode,
}) => {
  const [activeMode, setActiveMode] = useState<'select' | 'upi_qr' | null>(null);
  const [upiConfig, setUpiConfig] = useState<UpiConfig>({ upiId: '', merchantName: 'Kōji' });

  // Always open the 2-option Record Payment modal ('select') first
  const defaultMode = initialViewMode || 'select';
  const viewMode = activeMode || defaultMode;

  useEffect(() => {
    let isMounted = true;
    getUpiConfig()
      .then((cfg) => {
        if (isMounted) {
          setUpiConfig(cfg);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUpiConfig({ upiId: '', merchantName: 'Kōji' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleModalClose = () => {
    setActiveMode(null);
    onClose();
  };

  if (!order || !visible) return null;

  const balanceDue = typeof order.balanceDue === 'number'
    ? order.balanceDue
    : (order.paymentStatus === 'Completed' ? 0 : order.totalAmount);
  const amountPaid = typeof order.amountPaid === 'number'
    ? order.amountPaid
    : (order.paymentStatus === 'Completed' ? order.totalAmount : 0);
  const isPartial = order.paymentStatus === 'Partial' || (amountPaid > 0 && balanceDue > 0);
  const amountToCollect = balanceDue > 0 ? balanceDue : order.totalAmount;

  // Immediate Cash payment
  const handleSelectCash = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setActiveMode(null);
    onPaymentCompleted(order.id, 'Cash', amountToCollect);
    onClose();
  };

  // Switch to Dynamic UPI QR view
  const handleSelectUpiOption = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActiveMode('upi_qr');
  };

  // Confirm UPI payment received
  const handleConfirmUpi = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setActiveMode(null);
    onPaymentCompleted(order.id, 'UPI', amountToCollect);
    onClose();
  };

  const merchantName = upiConfig.merchantName.trim() || 'Kōji';
  const upiId = upiConfig.upiId.trim();
  const cleanToken = order.token.startsWith('#') ? order.token : `#${order.token}`;

  // Standard NPCI UPI URI
  const upiUri = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amountToCollect.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Token ${cleanToken}`)}`
    : '';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleModalClose}
    >
      <TouchableWithoutFeedback onPress={handleModalClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              {/* ========================================================= */}
              {/* VIEW 1: METHOD SELECTION (UPI vs CASH)                    */}
              {/* ========================================================= */}
              {viewMode === 'select' && (
                <View>
                  {/* Header */}
                  <View style={styles.header}>
                    <View style={styles.headerLeft}>
                      <TokenBadge token={order.token} variant="apricot" size="md" />
                      <View>
                        <Text style={styles.headerTitle}>
                          {isPartial ? 'Collect Balance Due' : 'Record Payment'}
                        </Text>
                        <Text style={styles.headerSubtitle}>
                          {order.customerName ? `Customer: ${order.customerName}` : 'Select collection method'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={handleModalClose}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.closeBtn}
                      accessibilityLabel="Close payment selector"
                    >
                      <X size={18} color={COLORS.forest} />
                    </TouchableOpacity>
                  </View>

                  {/* Amount Due Callout */}
                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>
                      {isPartial ? 'OUTSTANDING BALANCE DUE' : 'AMOUNT TO COLLECT'}
                    </Text>
                    <Text style={styles.amountValue}>₹{amountToCollect.toLocaleString('en-IN')}</Text>
                    {isPartial && (
                      <Text style={styles.breakdownText}>
                        Total Ticket: ₹{order.totalAmount}  •  Collected: ₹{amountPaid}
                      </Text>
                    )}
                  </View>

                  {/* Direct 2-Button Selection Prompt */}
                  <View style={styles.optionsContainer}>
                    {/* 1. Paid via UPI (Opens Dynamic QR Modal) */}
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={handleSelectUpiOption}
                      style={[styles.payOptionBtn, styles.upiOptionBtn]}
                    >
                      <View style={styles.iconCircleUpi}>
                        <Smartphone size={22} color={COLORS.forest} strokeWidth={2.4} />
                      </View>
                      <View style={styles.payOptionContent}>
                        <Text style={styles.payOptionTitle}>📱 UPI</Text>
                        <Text style={styles.payOptionSubtitle}>
                          Dynamic QR code with ₹{amountToCollect.toLocaleString('en-IN')} auto-filled
                        </Text>
                      </View>
                      <QrIcon size={18} color={COLORS.forest} strokeWidth={2.2} />
                    </TouchableOpacity>

                    {/* 2. Paid via Cash */}
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={handleSelectCash}
                      style={[styles.payOptionBtn, styles.cashOptionBtn]}
                    >
                      <View style={styles.iconCircleCash}>
                        <Banknote size={22} color={COLORS.amber} strokeWidth={2.4} />
                      </View>
                      <View style={styles.payOptionContent}>
                        <Text style={styles.payOptionTitle}>💵 Cash</Text>
                        <Text style={styles.payOptionSubtitle}>
                          Received ₹{amountToCollect.toLocaleString('en-IN')} physical cash notes at counter
                        </Text>
                      </View>
                      <CheckCircle2 size={18} color={COLORS.amber} strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ========================================================= */}
              {/* VIEW 2: DYNAMIC UPI QR PAYMENT MODAL                       */}
              {/* ========================================================= */}
              {viewMode === 'upi_qr' && (
                <View>
                  {/* Top Bar with Back and Close */}
                  <View style={styles.header}>
                    <View style={styles.headerLeft}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setActiveMode('select')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.backBtn}
                        accessibilityLabel="Back to payment choices"
                      >
                        <ArrowLeft size={18} color={COLORS.forest} />
                      </TouchableOpacity>
                      <TokenBadge token={order.token} variant="apricot" size="sm" />
                      <View>
                        <Text style={styles.headerTitle}>Dynamic UPI QR</Text>
                        <Text style={styles.headerSubtitle}>{merchantName}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={handleModalClose}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.closeBtn}
                      accessibilityLabel="Close payment selector"
                    >
                      <X size={18} color={COLORS.forest} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.qrScrollContent}>
                    {/* Amount Banner */}
                    <View style={styles.qrAmountBox}>
                      <Text style={styles.qrAmountLabel}>EXACT PAYABLE AMOUNT</Text>
                      <Text style={styles.qrAmountValue}>₹{amountToCollect.toLocaleString('en-IN')}</Text>
                      <Text style={styles.qrAmountSub}>
                        {merchantName} • Token {cleanToken}
                      </Text>
                    </View>

                    {/* Scannable QR Code or Warning if UPI ID not configured */}
                    {upiId ? (
                      <View style={styles.qrContainerWrapper}>
                        <View style={styles.qrContainer}>
                          <QRCode
                            value={upiUri}
                            size={180}
                            color={COLORS.forest}
                            backgroundColor={COLORS.white}
                          />
                        </View>
                        <Text style={styles.qrInstructionText}>
                          Scan with GPay, PhonePe, Paytm, or any UPI app.
                        </Text>
                        <Text style={styles.qrInstructionSub}>
                          Amount ₹{amountToCollect.toLocaleString('en-IN')} will auto-populate on customer&apos;s phone.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.noUpiWarningBox}>
                        <AlertTriangle size={28} color={COLORS.amber} />
                        <Text style={styles.noUpiWarningTitle}>No UPI ID Configured</Text>
                        <Text style={styles.noUpiWarningText}>
                          Please configure your Merchant UPI ID (VPA) in the Admin tab under &ldquo;UPI &amp; QR Payment Setup&rdquo; to generate dynamic QR codes.
                        </Text>
                      </View>
                    )}

                    {/* Confirm Button */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleConfirmUpi}
                      style={styles.confirmUpiBtn}
                    >
                      <CheckCircle2 size={18} color={COLORS.white} strokeWidth={2.2} />
                      <Text style={styles.confirmUpiBtnText}>
                        {upiId ? '✓ Confirm UPI Received' : '✓ Confirm UPI Received Manually'}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
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
    backgroundColor: 'rgba(13, 56, 30, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: COLORS.white,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.forest,
    padding: SPACING.lg,
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: COLORS.slate,
    ...FONTS.medium,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountBox: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: COLORS.amber,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  amountLabel: {
    fontSize: 10,
    color: COLORS.amber,
    ...FONTS.bold,
    letterSpacing: 0.8,
  },
  amountValue: {
    fontSize: 28,
    color: COLORS.forest,
    ...FONTS.heavy,
    marginVertical: 2,
  },
  breakdownText: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.medium,
    marginTop: 2,
  },
  optionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  payOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  upiOptionBtn: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
  },
  cashOptionBtn: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.amber,
  },
  iconCircleUpi: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.successTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleCash: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.amberTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payOptionContent: {
    flex: 1,
  },
  payOptionTitle: {
    fontSize: 14.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  payOptionSubtitle: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.regular,
    marginTop: 2,
  },
  qrScrollContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  qrAmountBox: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 12,
  },
  qrAmountLabel: {
    fontSize: 9.5,
    color: COLORS.amber,
    ...FONTS.bold,
    letterSpacing: 0.8,
  },
  qrAmountValue: {
    fontSize: 26,
    color: COLORS.forest,
    ...FONTS.heavy,
    marginVertical: 1,
  },
  qrAmountSub: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.medium,
  },
  qrContainerWrapper: {
    alignItems: 'center',
    marginVertical: 4,
  },
  qrContainer: {
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.forest,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 10,
  },
  qrInstructionText: {
    fontSize: 12,
    color: COLORS.forest,
    ...FONTS.bold,
    textAlign: 'center',
    marginTop: 2,
  },
  qrInstructionSub: {
    fontSize: 10.5,
    color: COLORS.slate,
    ...FONTS.regular,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 12,
  },
  noUpiWarningBox: {
    backgroundColor: COLORS.amberTint,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: COLORS.amber,
    padding: 14,
    alignItems: 'center',
    marginVertical: 12,
    gap: 6,
  },
  noUpiWarningTitle: {
    fontSize: 14,
    color: COLORS.amber,
    ...FONTS.bold,
  },
  noUpiWarningText: {
    fontSize: 11.5,
    color: COLORS.slate,
    ...FONTS.regular,
    textAlign: 'center',
    lineHeight: 16,
  },
  confirmUpiBtn: {
    backgroundColor: COLORS.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    marginTop: 14,
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  confirmUpiBtnText: {
    fontSize: 14,
    color: COLORS.white,
    ...FONTS.bold,
  },
});
