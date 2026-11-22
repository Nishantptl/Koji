import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  X,
  User,
  Phone,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Printer,
  Check,
  Smartphone,
  Banknote,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CartItem, CustomerProfile, OrderType } from '../types';
import { KojiConfirmModal, KojiConfirmModalProps } from './KojiConfirmModal';
import { VegBadge } from './VegBadge';
import { TokenBadge } from './TokenBadge';
import { getCustomerProfiles } from '../services/storage';
import {
  getAutoPrintPreference,
  setAutoPrintPreference,
} from '../services/printService';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface CheckoutModalProps {
  visible: boolean;
  nextToken: string;
  items: CartItem[];
  totalAmount: number;
  onClose: () => void;
  onConfirm: (details: {
    customerName: string;
    customerPhone: string;
    notes?: string;
    autoPrint?: boolean;
    discount?: number;
    discountPercent?: number;
    subtotal?: number;
    paymentMethod?: 'UPI' | 'Cash';
    orderType?: OrderType;
  }) => void;
  isSubmitting?: boolean;
}

const QUICK_NOTES = [
  'Extra Spicy',
  'Mild / Less Spicy',
  'No Cucumber',
  'No Onion/Garlic',
  'Less Ice',
  'Pack Separately',
  'Extra Sauce',
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  visible,
  nextToken,
  items,
  totalAmount,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [discountPercentInput, setDiscountPercentInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Cash' | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [autoPrint, setAutoPrint] = useState<boolean>(true);
  const [customerSectionY, setCustomerSectionY] = useState<number>(260);
  const [confirmModal, setConfirmModal] = useState<KojiConfirmModalProps | null>(null);

  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  const scrollToCustomerName = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, customerSectionY - 15),
        animated: true,
      });
    }, 120);
  }, [customerSectionY]);

  const scrollToCustomerPhone = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, customerSectionY + 70),
        animated: true,
      });
    }, 120);
  }, [customerSectionY]);

  const subtotal = useMemo(() => {
    return items.reduce((s, i) => s + i.price * i.quantity, 0);
  }, [items]);

  const rawPercent = parseInt(discountPercentInput, 10) || 0;
  const discountPercent = Math.min(100, Math.max(0, rawPercent));
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Load returning customer profiles and auto-print preference
  useEffect(() => {
    let isMounted = true;
    if (visible) {
      getCustomerProfiles()
        .then((data) => {
          if (isMounted) setProfiles(data);
        })
        .catch(() => {});

      getAutoPrintPreference()
        .then((pref) => {
          if (isMounted) setAutoPrint(pref);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [visible]);

  const handleToggleAutoPrint = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const newVal = !autoPrint;
    setAutoPrint(newVal);
    setAutoPrintPreference(newVal);
  };

  // Filter returning customer suggestions
  const filteredSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return [];
    return profiles
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 4);
  }, [customerName, profiles]);

  // When matching returning customers appear, keep dropdown smoothly in full view
  useEffect(() => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, customerSectionY - 15),
          animated: true,
        });
      }, 100);
    }
  }, [showSuggestions, filteredSuggestions.length, customerSectionY]);

  const handleSelectProfile = (profile: CustomerProfile) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setCustomerName(profile.name);
    setCustomerPhone(profile.phone);
    setShowSuggestions(false);
    if (validationError) setValidationError(null);
  };

  const handleQuickNoteTap = (noteText: string) => {
    try {
      Haptics.selectionAsync();
    } catch {
      // Ignore
    }
    setNotes((prev) => {
      if (!prev.trim()) {
        return noteText;
      }
      if (prev.includes(noteText)) {
        return prev
          .replace(noteText, '')
          .replace(/,\s*,/g, ',')
          .replace(/^,\s*|,\s*$/g, '')
          .trim();
      }
      return `${prev.trim()}, ${noteText}`;
    });
  };

  const handleConfirmPress = () => {
    setValidationError(null);
    const trimmedName = customerName.trim();
    const cleanPhone = customerPhone.replace(/\D/g, '');

    // Validation 1: Customer Name is strictly mandatory
    if (!trimmedName) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      setValidationError('Please enter customer name');
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Missing Details',
        title: 'Customer Name Required',
        message: 'Customer name is strictly required to confirm this order.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    // Validation 2: Contact Number is strictly mandatory and exactly 10 digits
    const isValidPhone = /^[0-9]{10}$/.test(cleanPhone);
    if (!isValidPhone) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      setValidationError('Please enter a valid 10-digit mobile number');
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Missing Details',
        title: '10-Digit Mobile Number Required',
        message: 'Please enter a valid 10-digit mobile number (Indian standard format e.g. 9876543210).',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Ignore
    }

    onConfirm({
      customerName: trimmedName,
      customerPhone: cleanPhone,
      notes: notes.trim() || undefined,
      autoPrint,
      discount: discountAmount > 0 ? discountAmount : undefined,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      subtotal,
      paymentMethod: paymentMethod || undefined,
      orderType,
    });

    // Reset form fields
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setDiscountPercentInput('');
    setPaymentMethod(null);
    setOrderType('Dine-in');
    setValidationError(null);
  };

  const handleClose = () => {
    setValidationError(null);
    setDiscountPercentInput('');
    setPaymentMethod(null);
    setOrderType('Dine-in');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Backdrop Tap Outside Dismissal */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdropDismissArea} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          style={styles.keyboardAvoid}
        >
          <View style={styles.sheetContainer}>
            {/* Sheet Drag Indicator */}
            <View style={styles.dragBarContainer}>
              <View style={styles.dragBar} />
            </View>

            {/* Pinned Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>Review Order</Text>
                <TokenBadge token={nextToken} variant="apricot" size="md" />
              </View>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityLabel="Close review order modal"
              >
                <X size={20} color={COLORS.forest} />
              </TouchableOpacity>
            </View>

            {/* Single Outer ScrollView between Pinned Header and Pinned Footer */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              bounces={true}
              overScrollMode="always"
            >
                {/* Itemized Receipt Preview */}
                <View style={styles.receiptCard}>
                  <Text style={styles.sectionHeader}>ORDER SUMMARY</Text>

                  {items.map((cartItem) => (
                    <View key={cartItem.id} style={styles.receiptItemRow}>
                      <View style={styles.receiptItemLeft}>
                        <VegBadge isVeg={cartItem.isVeg} size={13} />
                        <Text style={styles.receiptItemQty}>
                          {cartItem.quantity}x
                        </Text>
                        <Text
                          style={styles.receiptItemName}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {cartItem.name}
                        </Text>
                      </View>
                      <Text style={styles.receiptItemPrice}>
                        ₹{cartItem.price * cartItem.quantity}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.receiptDivider} />

                  {/* Subtotal Row */}
                  <View style={styles.summaryLineRow}>
                    <Text style={styles.summaryLineLabel}>Subtotal</Text>
                    <Text style={styles.summaryLineValue}>₹{subtotal}</Text>
                  </View>

                  {/* Percentage-based Discount Input Row */}
                  <View style={styles.discountRow}>
                    <Text style={styles.discountRowLabel}>Discount (%)</Text>
                    <View style={styles.discountInputBox}>
                      <TextInput
                        style={styles.discountInputField}
                        placeholder="0"
                        placeholderTextColor={COLORS.textMuted}
                        value={discountPercentInput}
                        onChangeText={(t) => {
                          const clean = t.replace(/[^0-9]/g, '');
                          if (!clean) {
                            setDiscountPercentInput('');
                            return;
                          }
                          const val = parseInt(clean, 10);
                          if (val > 100) {
                            setDiscountPercentInput('100');
                          } else {
                            setDiscountPercentInput(clean);
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={3}
                        selectTextOnFocus
                      />
                      <Text style={styles.discountSuffix}>%</Text>
                    </View>
                  </View>

                  {/* Auto-calculated Discount Deduction */}
                  {discountPercent > 0 && (
                    <View style={styles.discountAppliedRow}>
                      <Text style={styles.discountAppliedLabel}>
                        Discount ({discountPercent}%)
                      </Text>
                      <Text style={styles.discountAppliedValue}>-₹{discountAmount}</Text>
                    </View>
                  )}

                  {/* Total Bill Amount (Net) */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Bill Amount</Text>
                    <Text style={styles.totalAmount}>₹{finalTotal}</Text>
                  </View>
                </View>

                {/* Mandatory Customer Details Form */}
                <View
                  style={styles.formSection}
                  onLayout={(event) => {
                    const y = event.nativeEvent.layout.y;
                    if (y > 0) setCustomerSectionY(y);
                  }}
                >
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>CUSTOMER DETAILS (MANDATORY)</Text>
                    <Text style={styles.requiredIndicator}>* Required</Text>
                  </View>

                  {/* Validation Error Banner if any */}
                  {validationError && (
                    <View style={styles.errorBanner}>
                      <AlertCircle size={14} color={COLORS.danger} />
                      <Text style={styles.errorBannerText}>{validationError}</Text>
                    </View>
                  )}

                  {/* Customer Name (Mandatory) */}
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIcon}>
                      <User size={16} color={COLORS.slate} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Customer Name *"
                      placeholderTextColor={COLORS.slate}
                      value={customerName}
                      onFocus={() => {
                        setShowSuggestions(true);
                        scrollToCustomerName();
                      }}
                      onChangeText={(text) => {
                        setCustomerName(text);
                        setShowSuggestions(true);
                        if (validationError) setValidationError(null);
                      }}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                    {customerName.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setCustomerName('');
                          setShowSuggestions(false);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.clearInputBtn}
                      >
                        <X size={14} color={COLORS.slate} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Returning Customer Auto-Suggestions Dropdown */}
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <View style={styles.suggestionsBox}>
                      <View style={styles.suggestionsHeader}>
                        <View style={styles.suggestionsHeaderLeft}>
                          <Sparkles size={12} color={COLORS.amber} />
                          <Text style={styles.suggestionsHeaderTitle}>
                            RETURNING CUSTOMERS
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setShowSuggestions(false)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <X size={12} color={COLORS.slate} />
                        </TouchableOpacity>
                      </View>

                      {filteredSuggestions.map((profile, idx) => {
                        const isLast = idx === filteredSuggestions.length - 1;
                        return (
                          <TouchableOpacity
                            key={`${profile.name}_${profile.phone}`}
                            activeOpacity={0.7}
                            onPress={() => handleSelectProfile(profile)}
                            style={[
                              styles.suggestionRow,
                              isLast && styles.suggestionRowLast,
                            ]}
                          >
                            <View style={styles.suggestionLeft}>
                              <View style={styles.suggestionAvatar}>
                                <Text style={styles.suggestionAvatarText}>
                                  {profile.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <Text style={styles.suggestionName}>
                                {profile.name}
                              </Text>
                            </View>

                            <View style={styles.suggestionRight}>
                              <Phone size={11} color={COLORS.slate} />
                              <Text style={styles.suggestionPhone}>
                                {profile.phone}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Contact Number (Mandatory 10 Digits) */}
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIcon}>
                      <Phone size={16} color={COLORS.slate} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="10-Digit Mobile Number *"
                      placeholderTextColor={COLORS.slate}
                      value={customerPhone}
                      onFocus={() => {
                        scrollToCustomerPhone();
                      }}
                      onChangeText={(text) => {
                        // Allow only numeric digits
                        const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
                        setCustomerPhone(cleaned);
                        if (validationError) setValidationError(null);
                      }}
                      keyboardType="numeric"
                      maxLength={10}
                      returnKeyType="next"
                    />
                    {customerPhone.length > 0 && (
                      <Text
                        style={[
                          styles.phoneCounter,
                          customerPhone.length === 10
                            ? styles.phoneCounterValid
                            : styles.phoneCounterInvalid,
                        ]}
                      >
                        {customerPhone.length}/10
                      </Text>
                    )}
                  </View>

                  {/* Cooking / Verbal Notes */}
                  <View style={styles.inputWrapperMultiline}>
                    <View style={[styles.inputIcon, { marginTop: 10 }]}>
                      <FileText size={16} color={COLORS.natural} />
                    </View>
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      placeholder="Special Instructions (e.g. Extra spicy, no scallions)"
                      placeholderTextColor={COLORS.natural}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  {/* Quick Note Chips */}
                  <View style={styles.quickChipsWrapper}>
                    {QUICK_NOTES.map((chip) => {
                      const isSelected = notes.includes(chip);
                      return (
                        <TouchableOpacity
                          key={chip}
                          activeOpacity={0.7}
                          onPress={() => handleQuickNoteTap(chip)}
                          style={[
                            styles.chip,
                            isSelected && styles.chipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextSelected,
                            ]}
                          >
                            {chip}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Interactive ORDER TYPE Selector */}
                  <View style={styles.orderTypeSectionBox}>
                    <Text style={styles.orderTypeSectionLabel}>ORDER TYPE</Text>
                    <View style={styles.orderTypePillsRow}>
                      {(['Dine-in', 'Parcel', 'Car'] as OrderType[]).map((type) => {
                        const isSelected = orderType === type;
                        return (
                          <TouchableOpacity
                            key={type}
                            activeOpacity={0.8}
                            onPress={() => {
                              try {
                                Haptics.selectionAsync();
                              } catch {}
                              setOrderType(type);
                            }}
                            style={[
                              styles.orderTypeSelectorPill,
                              isSelected && styles.orderTypeSelectorPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.orderTypeSelectorPillText,
                                isSelected && styles.orderTypeSelectorPillTextActive,
                              ]}
                            >
                              {type}
                            </Text>
                            {isSelected && (
                              <Check size={13} color={COLORS.white} strokeWidth={2.8} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Interactive PAYMENT Selector */}
                  <View style={styles.paymentSectionBox}>
                    <Text style={styles.paymentSectionLabel}>PAYMENT</Text>
                    <View style={styles.paymentPillsRow}>
                      {/* UPI Option */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          try {
                            Haptics.selectionAsync();
                          } catch {}
                          setPaymentMethod((prev) => (prev === 'UPI' ? null : 'UPI'));
                        }}
                        style={[
                          styles.paymentSelectorPill,
                          paymentMethod === 'UPI' && styles.paymentSelectorPillActiveUpi,
                        ]}
                      >
                        <Smartphone
                          size={16}
                          color={paymentMethod === 'UPI' ? COLORS.forest : COLORS.slate}
                          strokeWidth={2.4}
                        />
                        <Text
                          style={[
                            styles.paymentSelectorPillText,
                            paymentMethod === 'UPI' && styles.paymentSelectorPillTextActiveUpi,
                          ]}
                        >
                          UPI
                        </Text>
                        {paymentMethod === 'UPI' && (
                          <Check size={14} color={COLORS.forest} strokeWidth={2.8} />
                        )}
                      </TouchableOpacity>

                      {/* Cash Option */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          try {
                            Haptics.selectionAsync();
                          } catch {}
                          setPaymentMethod((prev) => (prev === 'Cash' ? null : 'Cash'));
                        }}
                        style={[
                          styles.paymentSelectorPill,
                          paymentMethod === 'Cash' && styles.paymentSelectorPillActiveCash,
                        ]}
                      >
                        <Banknote
                          size={16}
                          color={paymentMethod === 'Cash' ? COLORS.forest : COLORS.slate}
                          strokeWidth={2.4}
                        />
                        <Text
                          style={[
                            styles.paymentSelectorPillText,
                            paymentMethod === 'Cash' && styles.paymentSelectorPillTextActiveCash,
                          ]}
                        >
                          Cash
                        </Text>
                        {paymentMethod === 'Cash' && (
                          <Check size={14} color={COLORS.forest} strokeWidth={2.8} />
                        )}
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.paymentHelperText}>
                      {paymentMethod === 'UPI'
                        ? '✓ Dynamic UPI QR code will open upon saving to scan & pay'
                        : paymentMethod === 'Cash'
                        ? '✓ Order will be saved and recorded as paid in Cash'
                        : '• Unpaid / Collect upon serving (tap UPI or Cash to collect now)'}
                    </Text>
                  </View>

                  {/* Auto-Print Station KOTs Toggle */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleToggleAutoPrint}
                    style={styles.autoPrintRow}
                  >
                    <View
                      style={[
                        styles.autoPrintCheckbox,
                        autoPrint && styles.autoPrintCheckboxActive,
                      ]}
                    >
                      {autoPrint && (
                        <Check size={13} color={COLORS.ivory} strokeWidth={3} />
                      )}
                    </View>
                    <View style={styles.autoPrintTextContainer}>
                      <View style={styles.autoPrintTitleRow}>
                        <Printer size={14} color={COLORS.forestGreen} />
                        <Text style={styles.autoPrintTitle}>
                          Auto-Print Station KOTs
                        </Text>
                      </View>
                      <Text style={styles.autoPrintSubtitle}>
                        Directly dispatches split slips (Veg Sushi, Non-Veg Sushi, Wok) to RawBT
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* Bottom Confirm Action */}
              <View style={styles.footer}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleConfirmPress}
                  disabled={isSubmitting || items.length === 0}
                  style={[
                    styles.confirmButton,
                    (isSubmitting || items.length === 0) && styles.confirmButtonDisabled,
                  ]}
                >
                  <CheckCircle2 size={20} color={COLORS.ivory} strokeWidth={2.4} />
                  <Text style={styles.confirmButtonText}>
                    {isSubmitting
                      ? 'Saving Order...'
                      : `Confirm & Save ${nextToken} • ₹${finalTotal}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>

        {/* Universal Kōji Confirmation / Notice Modal */}
        {confirmModal && (
          <KojiConfirmModal
            {...confirmModal}
            onClose={() => {
              confirmModal.onClose?.();
              setConfirmModal(null);
            }}
          />
        )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  backdropDismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  keyboardAvoid: {
    justifyContent: 'flex-end',
    width: '100%',
    maxHeight: '92%',
  },
  sheetContainer: {
    backgroundColor: COLORS.ivory,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '100%',
    flexShrink: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  dragBarContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    color: COLORS.forest,
    ...FONTS.heavy,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexShrink: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  scrollContentContainer: {
    paddingBottom: 48,
  },
  receiptCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    fontSize: 11,
    color: COLORS.textMuted,
    ...FONTS.bold,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  requiredIndicator: {
    fontSize: 10,
    color: COLORS.danger,
    ...FONTS.bold,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.dangerTint,
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: SPACING.sm,
  },
  errorBannerText: {
    fontSize: 11,
    color: COLORS.danger,
    ...FONTS.semibold,
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  receiptItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: SPACING.md,
  },
  receiptItemQty: {
    fontSize: 13,
    color: COLORS.apricot,
    ...FONTS.bold,
    minWidth: 22,
  },
  receiptItemName: {
    fontSize: 14,
    color: COLORS.organic,
    ...FONTS.medium,
    flex: 1,
  },
  receiptItemPrice: {
    fontSize: 14,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
    borderStyle: 'dashed',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  totalLabel: {
    fontSize: 15,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  totalAmount: {
    fontSize: 20,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  formSection: {
    marginBottom: SPACING.xl,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  clearInputBtn: {
    padding: 6,
  },
  suggestionsBox: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.amber,
    marginTop: -4,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.amberTint,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  suggestionsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  suggestionsHeaderTitle: {
    fontSize: 10,
    color: COLORS.amber,
    ...FONTS.heavy,
    letterSpacing: 0.6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.amberTint,
    borderWidth: 1,
    borderColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionAvatarText: {
    fontSize: 10,
    color: COLORS.amber,
    ...FONTS.bold,
  },
  suggestionName: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  suggestionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestionPhone: {
    fontSize: 11,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },
  phoneCounter: {
    fontSize: 11,
    ...FONTS.bold,
    marginLeft: 6,
  },
  phoneCounterValid: {
    color: COLORS.veg,
  },
  phoneCounterInvalid: {
    color: COLORS.textMuted,
  },
  inputWrapperMultiline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: COLORS.organic,
    ...FONTS.regular,
  },
  inputMultiline: {
    height: 64,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  quickChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surfaceMuted,
  },
  chipSelected: {
    borderColor: COLORS.amber,
    backgroundColor: COLORS.amberTint,
  },
  chipText: {
    fontSize: 11,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  chipTextSelected: {
    color: COLORS.amber,
    ...FONTS.bold,
  },
  autoPrintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(140, 158, 145, 0.35)',
    marginTop: SPACING.md,
    gap: 12,
  },
  autoPrintCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: COLORS.forestGreen,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoPrintCheckboxActive: {
    backgroundColor: COLORS.forestGreen,
  },
  autoPrintTextContainer: {
    flex: 1,
  },
  autoPrintTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  autoPrintTitle: {
    fontSize: 13,
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  autoPrintSubtitle: {
    fontSize: 11,
    color: COLORS.natural,
    ...FONTS.regular,
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.ivory,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.organic,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    color: COLORS.ivory,
    ...FONTS.heavy,
    letterSpacing: 0.3,
  },
  summaryLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLineLabel: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },
  summaryLineValue: {
    fontSize: 14,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 2,
  },
  discountRowLabel: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },
  discountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.2,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    minWidth: 90,
  },
  discountPrefix: {
    fontSize: 13,
    color: COLORS.textMuted,
    ...FONTS.bold,
    marginRight: 4,
  },
  discountSuffix: {
    fontSize: 13,
    color: COLORS.textMuted,
    ...FONTS.bold,
    marginLeft: 4,
  },
  discountInputField: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.bold,
    padding: 0,
    minWidth: 40,
    flex: 1,
  },
  discountAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  discountAppliedLabel: {
    fontSize: 13,
    color: COLORS.danger,
    ...FONTS.medium,
  },
  discountAppliedValue: {
    fontSize: 13.5,
    color: COLORS.danger,
    ...FONTS.bold,
  },
  orderTypeSectionBox: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  orderTypeSectionLabel: {
    fontSize: 11,
    color: COLORS.organic,
    ...FONTS.heavy,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  orderTypePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderTypeSelectorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.canvas,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
  },
  orderTypeSelectorPillActive: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  orderTypeSelectorPillText: {
    fontSize: 13,
    color: COLORS.slate,
    ...FONTS.bold,
  },
  orderTypeSelectorPillTextActive: {
    color: COLORS.white,
  },
  paymentSectionBox: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  paymentSectionLabel: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.heavy,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  paymentPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentSelectorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
  },
  paymentSelectorPillActiveUpi: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
  },
  paymentSelectorPillActiveCash: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.border,
  },
  paymentSelectorPillText: {
    fontSize: 13,
    color: COLORS.slate,
    ...FONTS.bold,
  },
  paymentSelectorPillTextActiveUpi: {
    color: COLORS.forest,
  },
  paymentSelectorPillTextActiveCash: {
    color: COLORS.forest,
  },
  paymentHelperText: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    ...FONTS.medium,
    marginTop: 6,
    paddingHorizontal: 2,
  },
});
