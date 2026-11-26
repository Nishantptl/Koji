import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  Smartphone,
  Banknote,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  QrCode as QrIcon,
  Scale,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import { Order, PaymentMethod, UpiConfig } from '../types';
import { TokenBadge } from './TokenBadge';
import { getUpiConfig } from '../services/storage';
import { COLORS, FONTS, SPACING } from '../constants/theme';

export interface SplitPaymentDetails {
  upiPaid: number;
  cashPaid: number;
}

interface PaymentModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onPaymentCompleted: (
    orderId: string,
    method: PaymentMethod,
    amount?: number,
    splitDetails?: SplitPaymentDetails
  ) => void;
  initialViewMode?: 'select' | 'upi_qr' | 'split';
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  order,
  onClose,
  onPaymentCompleted,
  initialViewMode,
}) => {
  const [activeMode, setActiveMode] = useState<'select' | 'upi_qr' | 'split' | null>(null);
  const [upiConfig, setUpiConfig] = useState<UpiConfig>({ upiId: '', merchantName: 'Kōji' });
  const [upiInput, setUpiInput] = useState<string>('');
  const [cashInput, setCashInput] = useState<string>('');
  const [prevOrderId, setPrevOrderId] = useState<string | null>(order?.id || null);

  // Reset state when switching orders per React recommended pattern
  if (order?.id && order.id !== prevOrderId) {
    setPrevOrderId(order.id);
    setUpiInput('');
    setCashInput('');
    setActiveMode(null);
  }

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
    setUpiInput('');
    setCashInput('');
    onClose();
  };

  if (!order || !visible) return null;

  const grandTotal = typeof order.grandTotal === 'number' && order.grandTotal > 0
    ? order.grandTotal
    : (order.totalAmount || 0);
  const alreadyPaid = (typeof order.upiPaid === 'number' || typeof order.cashPaid === 'number')
    ? (Math.max(0, order.upiPaid || 0) + Math.max(0, order.cashPaid || 0))
    : (typeof order.amountPaid === 'number' ? order.amountPaid : (order.isPaid ? grandTotal : 0));
  const remainingDue = Math.max(0, grandTotal - alreadyPaid);
  const amountToCollect = remainingDue > 0 ? remainingDue : (alreadyPaid >= grandTotal ? 0 : grandTotal);
  const isPartial = alreadyPaid > 0 && remainingDue > 0;

  // Immediate Cash payment
  const handleSelectCash = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { }
    setActiveMode(null);
    onPaymentCompleted(order.id, 'Cash', amountToCollect);
    onClose();
  };

  // Switch to Dynamic UPI QR view
  const handleSelectUpiOption = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }
    setActiveMode('upi_qr');
  };

  // Switch to Split Payment view
  const handleSelectSplitOption = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }
    setActiveMode('split');
    // Initialize both inputs completely empty with placeholder "0"
    setUpiInput('');
    setCashInput('');
  };

  // Confirm UPI payment received
  const handleConfirmUpi = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { }
    setActiveMode(null);
    onPaymentCompleted(order.id, 'UPI', amountToCollect);
    onClose();
  };

  // Smart Auto-Fill Handlers for Split Mode (Clamped to prevent negative auto-fill)
  const handleUpiInputChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setUpiInput(clean);
    if (clean) {
      const num = parseInt(clean, 10);
      if (num <= amountToCollect) {
        setCashInput(String(amountToCollect - num));
      } else {
        setCashInput('');
      }
    } else {
      setCashInput('');
    }
  };

  const handleCashInputChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setCashInput(clean);
    if (clean) {
      const num = parseInt(clean, 10);
      if (num <= amountToCollect) {
        setUpiInput(String(amountToCollect - num));
      } else {
        setUpiInput('');
      }
    } else {
      setUpiInput('');
    }
  };

  // Strictly 50/50 and Clear chips
  const applySplitPreset = (preset: '50_50' | 'clear') => {
    try {
      Haptics.selectionAsync();
    } catch { }

    if (preset === '50_50') {
      const half = Math.ceil(amountToCollect / 2);
      setUpiInput(String(half));
      setCashInput(String(amountToCollect - half));
    } else if (preset === 'clear') {
      setUpiInput('');
      setCashInput('');
    }
  };

  const upiNum = parseInt(upiInput, 10) || 0;
  const cashNum = parseInt(cashInput, 10) || 0;
  const splitTotalPaid = upiNum + cashNum;
  const splitRemainingDue = Math.max(0, amountToCollect - splitTotalPaid);

  // Strict Validation: neither individual input nor combined total may exceed remaining due
  const isUpiExceeded = upiNum > amountToCollect;
  const isCashExceeded = cashNum > amountToCollect;
  const isTotalExceeded = splitTotalPaid > amountToCollect;
  const isInvalid = isUpiExceeded || isCashExceeded || isTotalExceeded;

  const isUpiInputInvalid = isUpiExceeded || (isTotalExceeded && upiNum > 0);
  const isCashInputInvalid = isCashExceeded || (isTotalExceeded && cashNum > 0);

  const handleConfirmSplitPayment = () => {
    if (isInvalid || splitTotalPaid <= 0) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { }
    setActiveMode(null);
    onPaymentCompleted(order.id, 'Split', splitTotalPaid, {
      upiPaid: upiNum,
      cashPaid: cashNum,
    });
    onClose();
  };

  const merchantName = upiConfig.merchantName.trim() || 'Kōji';
  const upiId = upiConfig.upiId.trim();
  const cleanToken = order.token.startsWith('#') ? order.token : `#${order.token}`;

  // Standard NPCI UPI URI
  const upiUri = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amountToCollect.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Token ${cleanToken}`)}`
    : '';

  // Dynamic NPCI UPI URI for Split Payment (when upiNum > 0)
  const splitUpiUri = (upiId && upiNum > 0)
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${upiNum.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Token ${cleanToken}`)}`
    : '';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleModalClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoider}
      >
        <TouchableWithoutFeedback onPress={handleModalClose}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.card}>
                {/* ========================================================= */}
                {/* VIEW 1: METHOD SELECTION (UPI vs CASH vs SPLIT)           */}
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
                          Total Ticket: ₹{grandTotal.toLocaleString('en-IN')}  •  Collected: ₹{alreadyPaid.toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>

                    {/* 3-Option Selection Prompts */}
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

                      {/* 3. Split Payment (UPI + Cash) */}
                      <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={handleSelectSplitOption}
                        style={[styles.payOptionBtn, styles.splitOptionBtn]}
                      >
                        <View style={styles.iconCircleSplit}>
                          <Scale size={22} color={COLORS.forest} strokeWidth={2.4} />
                        </View>
                        <View style={styles.payOptionContent}>
                          <Text style={styles.payOptionTitle}>⚖️ Split (UPI + Cash)</Text>
                          <Text style={styles.payOptionSubtitle}>
                            Customize partial amounts (e.g. ₹500 UPI + ₹500 Cash)
                          </Text>
                        </View>
                        <CheckCircle2 size={18} color={COLORS.forest} strokeWidth={2.4} />
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

                {/* ========================================================= */}
                {/* VIEW 3: SPLIT PAYMENT MODAL (UPI + CASH)                   */}
                {/* ========================================================= */}
                {viewMode === 'split' && (
                  <View style={styles.splitMainWrapper}>
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
                          <Text style={styles.headerTitle}>Split Payment</Text>
                          <Text style={styles.headerSubtitle}>UPI + Cash Settlement</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={handleModalClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.closeBtn}
                        accessibilityLabel="Close split payment"
                      >
                        <X size={18} color={COLORS.forest} />
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.splitScrollContent}
                    >
                      {/* Summary Row: Grand Total, Already Paid & Remaining Due */}
                      <View style={styles.splitSummaryRow}>
                        <View style={styles.splitSummaryItem}>
                          <Text style={styles.splitSummaryLabel}>GRAND TOTAL</Text>
                          <Text style={styles.splitSummaryValue}>₹{grandTotal.toLocaleString('en-IN')}</Text>
                        </View>
                        {alreadyPaid > 0 && (
                          <>
                            <View style={styles.splitSummaryDivider} />
                            <View style={styles.splitSummaryItem}>
                              <Text style={styles.splitSummaryLabel}>PAID SO FAR</Text>
                              <Text style={[styles.splitSummaryValue, { color: COLORS.forest }]}>
                                ₹{alreadyPaid.toLocaleString('en-IN')}
                              </Text>
                            </View>
                          </>
                        )}
                        <View style={styles.splitSummaryDivider} />
                        <View style={styles.splitSummaryItem}>
                          <Text style={styles.splitSummaryLabel}>REMAINING DUE</Text>
                          <Text style={[styles.splitSummaryValue, { color: COLORS.amber }]}>
                            ₹{amountToCollect.toLocaleString('en-IN')}
                          </Text>
                        </View>
                      </View>

                      {/* Preset Chips: Strictly 50/50 and Clear */}
                      <View style={styles.presetChipsRow}>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => applySplitPreset('50_50')}
                          style={styles.presetChip}
                        >
                          <Text style={styles.presetChipText}>50 / 50</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => applySplitPreset('clear')}
                          style={[styles.presetChip, styles.presetChipClear]}
                        >
                          <Text style={[styles.presetChipText, styles.presetChipClearText]}>Clear</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Dual Inputs: UPI and Cash */}
                      <View style={styles.splitInputsContainer}>
                        <View style={styles.splitInputCol}>
                          <View style={styles.splitInputHeader}>
                            <Smartphone
                              size={14}
                              color={isUpiInputInvalid ? COLORS.danger : COLORS.forest}
                              strokeWidth={2.4}
                            />
                            <Text
                              style={[
                                styles.splitInputLabel,
                                isUpiInputInvalid && styles.splitInputLabelError,
                              ]}
                            >
                              UPI AMOUNT (₹)
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.splitInputWrapper,
                              isUpiInputInvalid && styles.splitInputWrapperError,
                            ]}
                          >
                            <Text
                              style={[
                                styles.currencyPrefix,
                                isUpiInputInvalid && styles.currencyPrefixError,
                              ]}
                            >
                              ₹
                            </Text>
                            <TextInput
                              style={styles.splitTextInput}
                              keyboardType="numeric"
                              value={upiInput}
                              placeholder="0"
                              placeholderTextColor={COLORS.slate}
                              onChangeText={handleUpiInputChange}
                            />
                          </View>
                        </View>

                        <View style={styles.splitInputCol}>
                          <View style={styles.splitInputHeader}>
                            <Banknote
                              size={14}
                              color={isCashInputInvalid ? COLORS.danger : COLORS.amber}
                              strokeWidth={2.4}
                            />
                            <Text
                              style={[
                                styles.splitInputLabel,
                                isCashInputInvalid && styles.splitInputLabelError,
                              ]}
                            >
                              CASH AMOUNT (₹)
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.splitInputWrapper,
                              isCashInputInvalid && styles.splitInputWrapperError,
                            ]}
                          >
                            <Text
                              style={[
                                styles.currencyPrefix,
                                isCashInputInvalid && styles.currencyPrefixError,
                              ]}
                            >
                              ₹
                            </Text>
                            <TextInput
                              style={styles.splitTextInput}
                              keyboardType="numeric"
                              value={cashInput}
                              placeholder="0"
                              placeholderTextColor={COLORS.slate}
                              onChangeText={handleCashInputChange}
                            />
                          </View>
                        </View>
                      </View>

                      {/* Dynamic UPI QR Code for Split Payment (when upiNum > 0 and valid) */}
                      {upiNum > 0 && !isUpiExceeded && !isTotalExceeded && (
                        <View style={styles.splitQrSection}>
                          <View style={styles.splitQrHeader}>
                            <QrIcon size={14} color={COLORS.forest} strokeWidth={2.4} />
                            <Text style={styles.splitQrHeaderText}>
                              Scan to pay ₹{upiNum.toLocaleString('en-IN')} via UPI
                            </Text>
                          </View>

                          {upiId ? (
                            <View style={styles.splitQrBox}>
                              <View style={styles.splitQrCodeWrapper}>
                                <QRCode
                                  value={splitUpiUri}
                                  size={130}
                                  color={COLORS.forest}
                                  backgroundColor={COLORS.white}
                                />
                              </View>
                              <Text style={styles.splitQrInstructionText}>
                                {merchantName} • Token {cleanToken}
                              </Text>
                              <Text style={styles.splitQrSubText}>
                                Amount ₹{upiNum.toLocaleString('en-IN')} will auto-populate on customer&apos;s phone
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.splitQrWarningBox}>
                              <AlertTriangle size={15} color={COLORS.amber} />
                              <Text style={styles.splitQrWarningText}>
                                Configure Merchant UPI ID in Admin Hub to enable QR code
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Live Validation & Status Banner */}
                      <View style={styles.splitStatusBanner}>
                        {isInvalid ? (
                          <View style={styles.splitStatusBadgeError}>
                            <AlertCircle size={14} color={COLORS.danger} strokeWidth={2.4} />
                            <Text style={styles.splitStatusTextError}>
                              Total split amount cannot exceed remaining due (₹{amountToCollect.toLocaleString('en-IN')})
                            </Text>
                          </View>
                        ) : splitTotalPaid === 0 ? (
                          <Text style={styles.splitStatusTextNeutral}>
                            Enter UPI and Cash amounts to settle
                          </Text>
                        ) : splitTotalPaid === amountToCollect ? (
                          <View style={styles.splitStatusBadgeSuccess}>
                            <CheckCircle2 size={14} color={COLORS.forest} strokeWidth={2.4} />
                            <Text style={styles.splitStatusTextSuccess}>
                              ✓ Settle in Full (₹{upiNum.toLocaleString('en-IN')} UPI + ₹{cashNum.toLocaleString('en-IN')} Cash)
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.splitStatusBadgePartial}>
                            <AlertTriangle size={14} color={COLORS.amber} strokeWidth={2.4} />
                            <Text style={styles.splitStatusTextPartial}>
                              Partial Payment: ₹{splitTotalPaid.toLocaleString('en-IN')} paid • ₹{splitRemainingDue.toLocaleString('en-IN')} will remain Due
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Confirm Button */}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={isInvalid || splitTotalPaid <= 0}
                        onPress={handleConfirmSplitPayment}
                        style={[
                          styles.confirmSplitBtn,
                          (isInvalid || splitTotalPaid <= 0) && styles.confirmSplitBtnDisabled,
                        ]}
                      >
                        <CheckCircle2 size={18} color={COLORS.white} strokeWidth={2.4} />
                        <Text style={styles.confirmSplitBtnText}>
                          {isInvalid
                            ? 'Amount Exceeds Due'
                            : splitTotalPaid === amountToCollect
                              ? `✓ Record Full Payment • ₹${splitTotalPaid.toLocaleString('en-IN')}`
                              : splitTotalPaid > 0
                                ? `Record Partial Payment • ₹${splitTotalPaid.toLocaleString('en-IN')}`
                                : 'Enter Amount to Settle'}
                        </Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 56, 30, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 410,
    maxHeight: '92%',
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
  splitOptionBtn: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.forest,
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
  iconCircleSplit: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
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
  // Split Mode Styles
  splitSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 6,
  },
  splitSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  splitSummaryLabel: {
    fontSize: 9.5,
    color: COLORS.slate,
    ...FONTS.bold,
    letterSpacing: 0.6,
  },
  splitSummaryValue: {
    fontSize: 18,
    color: COLORS.forest,
    ...FONTS.heavy,
    marginTop: 2,
  },
  splitSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  presetChipClear: {
    backgroundColor: COLORS.dangerTint,
    borderColor: 'rgba(217, 83, 79, 0.3)',
  },
  presetChipClearText: {
    color: COLORS.danger,
  },
  splitInputsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  splitInputCol: {
    flex: 1,
  },
  splitInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  splitInputLabel: {
    fontSize: 10,
    color: COLORS.slate,
    ...FONTS.bold,
    letterSpacing: 0.5,
  },
  splitInputLabelError: {
    color: COLORS.danger,
  },
  splitInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    height: 44,
  },
  splitInputWrapperError: {
    borderColor: COLORS.danger,
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
  },
  currencyPrefix: {
    fontSize: 15,
    color: COLORS.forest,
    ...FONTS.bold,
    marginRight: 4,
  },
  currencyPrefixError: {
    color: COLORS.danger,
  },
  splitTextInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.forest,
    ...FONTS.heavy,
    paddingVertical: 0,
  },
  splitStatusBanner: {
    marginVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitStatusTextNeutral: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.medium,
  },
  splitStatusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.successTint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  splitStatusBadgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    width: '100%',
  },
  splitStatusTextError: {
    fontSize: 11.5,
    color: COLORS.danger,
    ...FONTS.semibold,
  },
  splitStatusTextSuccess: {
    fontSize: 11.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  splitStatusBadgePartial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.amberTint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  splitStatusTextPartial: {
    fontSize: 11,
    color: COLORS.amber,
    ...FONTS.bold,
  },
  confirmSplitBtn: {
    backgroundColor: COLORS.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmSplitBtnDisabled: {
    opacity: 0.5,
  },
  confirmSplitBtnText: {
    fontSize: 13.5,
    color: COLORS.white,
    ...FONTS.bold,
  },
  splitMainWrapper: {
    maxHeight: '100%',
  },
  splitScrollContent: {
    paddingBottom: 4,
  },
  splitQrSection: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: COLORS.forest,
    padding: SPACING.sm + 2,
    marginVertical: 6,
    alignItems: 'center',
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  splitQrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  splitQrHeaderText: {
    fontSize: 12.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  splitQrBox: {
    alignItems: 'center',
    width: '100%',
  },
  splitQrCodeWrapper: {
    padding: 10,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 6,
  },
  splitQrInstructionText: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  splitQrSubText: {
    fontSize: 9.5,
    color: COLORS.slate,
    ...FONTS.medium,
    marginTop: 1,
    textAlign: 'center',
  },
  splitQrWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.amberTint,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  splitQrWarningText: {
    fontSize: 11,
    color: COLORS.amber,
    ...FONTS.medium,
  },
});
