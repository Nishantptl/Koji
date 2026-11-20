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
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  order,
  onClose,
  onPaymentCompleted,
}) => {
  const [viewMode, setViewMode] = useState<'select' | 'upi_qr'>('select');
  const [upiConfig, setUpiConfig] = useState<UpiConfig>({ upiId: '', merchantName: 'Kōji' });

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
    setViewMode('select');
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
    setViewMode('select');
    onPaymentCompleted(order.id, 'Cash', amountToCollect);
    onClose();
  };

  // Switch to Dynamic UPI QR view
  const handleSelectUpiOption = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setViewMode('upi_qr');
  };

  // Confirm UPI payment received
  const handleConfirmUpi = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setViewMode('select');
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
                      <X size={18} color={COLORS.forestGreen} />
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
                        <Smartphone size={22} color={COLORS.forestGreen} strokeWidth={2.4} />
                      </View>
                      <View style={styles.payOptionContent}>
                        <Text style={styles.payOptionTitle}>📱 UPI</Text>
                        <Text style={styles.payOptionSubtitle}>
                          Dynamic QR code with ₹{amountToCollect.toLocaleString('en-IN')} auto-filled
                        </Text>
                      </View>
                      <QrIcon size={18} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </TouchableOpacity>

                    {/* 2. Paid via Cash */}
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={handleSelectCash}
                      style={[styles.payOptionBtn, styles.cashOptionBtn]}
                    >
                      <View style={styles.iconCircleCash}>
                        <Banknote size={22} color={COLORS.apricot} strokeWidth={2.4} />
                      </View>
                      <View style={styles.payOptionContent}>
                        <Text style={styles.payOptionTitle}>💵 Cash</Text>
                        <Text style={styles.payOptionSubtitle}>
                          Received ₹{amountToCollect.toLocaleString('en-IN')} physical cash notes at counter
                        </Text>
                      </View>
                      <CheckCircle2 size={18} color={COLORS.apricot} strokeWidth={2.4} />
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
                        onPress={() => setViewMode('select')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.backBtn}
                        accessibilityLabel="Back to payment choices"
                      >
                        <ArrowLeft size={18} color={COLORS.forestGreen} />
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
                      <X size={18} color={COLORS.forestGreen} />
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
                            color={COLORS.organic}
                            backgroundColor="#FFFFFF"
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
                        <AlertTriangle size={28} color={COLORS.apricot} />
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
                      <CheckCircle2 size={18} color={COLORS.cream} strokeWidth={2.2} />
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
    borderColor: COLORS.forestGreen,
    padding: SPACING.lg,
    shadowColor: COLORS.forestGreen,
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
    borderBottomColor: COLORS.borderLight,
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
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: COLORS.natural,
    ...FONTS.medium,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDF2EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EDF2EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountBox: {
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#F2DFCD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  amountLabel: {
    fontSize: 10,
    color: COLORS.apricot,
    ...FONTS.bold,
    letterSpacing: 0.8,
  },
  amountValue: {
    fontSize: 28,
    color: COLORS.organic,
    ...FONTS.heavy,
    marginVertical: 2,
  },
  breakdownText: {
    fontSize: 11,
    color: COLORS.natural,
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
    backgroundColor: '#F3FAF5',
    borderColor: '#C2E5CD',
  },
  cashOptionBtn: {
    backgroundColor: '#FFFDF7',
    borderColor: '#F3DFC8',
  },
  iconCircleUpi: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F3E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleCash: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FDF1E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payOptionContent: {
    flex: 1,
  },
  payOptionTitle: {
    fontSize: 14.5,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  payOptionSubtitle: {
    fontSize: 11,
    color: COLORS.natural,
    ...FONTS.regular,
    marginTop: 2,
  },
  qrScrollContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  qrAmountBox: {
    alignItems: 'center',
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: '#F1E6D6',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 12,
  },
  qrAmountLabel: {
    fontSize: 9.5,
    color: COLORS.apricot,
    ...FONTS.bold,
    letterSpacing: 0.8,
  },
  qrAmountValue: {
    fontSize: 26,
    color: COLORS.organic,
    ...FONTS.heavy,
    marginVertical: 1,
  },
  qrAmountSub: {
    fontSize: 11,
    color: COLORS.natural,
    ...FONTS.medium,
  },
  qrContainerWrapper: {
    alignItems: 'center',
    marginVertical: 4,
  },
  qrContainer: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.forestGreen,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 10,
  },
  qrInstructionText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.bold,
    textAlign: 'center',
    marginTop: 2,
  },
  qrInstructionSub: {
    fontSize: 10.5,
    color: COLORS.natural,
    ...FONTS.regular,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 12,
  },
  noUpiWarningBox: {
    backgroundColor: '#FFF9F2',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#F2D7B8',
    padding: 14,
    alignItems: 'center',
    marginVertical: 12,
    gap: 6,
  },
  noUpiWarningTitle: {
    fontSize: 14,
    color: COLORS.apricot,
    ...FONTS.bold,
  },
  noUpiWarningText: {
    fontSize: 11.5,
    color: COLORS.natural,
    ...FONTS.regular,
    textAlign: 'center',
    lineHeight: 16,
  },
  confirmUpiBtn: {
    backgroundColor: COLORS.organic,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    marginTop: 14,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  confirmUpiBtnText: {
    fontSize: 14,
    color: COLORS.cream,
    ...FONTS.bold,
  },
});
