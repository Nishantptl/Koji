import React, { useState, useEffect, useMemo } from 'react';
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
  Keyboard,
  Alert,
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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CartItem, CustomerProfile } from '../types';
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
  }) => void;
  isSubmitting?: boolean;
}

const QUICK_NOTES = [
  'Extra Spicy 🌶️',
  'Mild / Less Spicy',
  'No Onion/Garlic',
  'Pack Separately 🥡',
  'Less Ice 🧊',
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [autoPrint, setAutoPrint] = useState<boolean>(true);

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
      Alert.alert(
        'Customer Name Required',
        'Customer name is strictly required to confirm this order.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Validation 2: Contact Number is strictly mandatory and exactly 10 digits
    const isValidPhone = /^[0-9]{10}$/.test(cleanPhone);
    if (!isValidPhone) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      setValidationError('Please enter a valid 10-digit mobile number');
      Alert.alert(
        '10-Digit Mobile Number Required',
        'Please enter a valid 10-digit mobile number (Indian standard mobile format e.g. 9876543210).',
        [{ text: 'OK' }]
      );
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
    });

    // Reset form fields
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setValidationError(null);
  };

  const handleClose = () => {
    setValidationError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
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

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>Review Order</Text>
                  <TokenBadge token={nextToken} variant="apricot" size="md" />
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={handleClose}
                  style={styles.closeButton}
                >
                  <X size={20} color={COLORS.organic} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Bill Amount</Text>
                    <Text style={styles.totalAmount}>₹{totalAmount}</Text>
                  </View>
                </View>

                {/* Mandatory Customer Details Form */}
                <View style={styles.formSection}>
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
                      <User size={16} color={COLORS.natural} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Customer Name *"
                      placeholderTextColor={COLORS.natural}
                      value={customerName}
                      onFocus={() => setShowSuggestions(true)}
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
                        <X size={14} color={COLORS.natural} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Returning Customer Auto-Suggestions Dropdown */}
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <View style={styles.suggestionsBox}>
                      <View style={styles.suggestionsHeader}>
                        <View style={styles.suggestionsHeaderLeft}>
                          <Sparkles size={12} color={COLORS.apricot} />
                          <Text style={styles.suggestionsHeaderTitle}>
                            RETURNING CUSTOMERS
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setShowSuggestions(false)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <X size={12} color={COLORS.natural} />
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
                              <Phone size={11} color={COLORS.natural} />
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
                      <Phone size={16} color={COLORS.natural} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="10-Digit Mobile Number *"
                      placeholderTextColor={COLORS.natural}
                      value={customerPhone}
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

                  {/* Payment Status Notice */}
                  <View style={styles.paymentNoticeBox}>
                    <Text style={styles.paymentNoticeLabel}>PAYMENT STATUS</Text>
                    <View style={styles.paymentNoticePill}>
                      <Text style={styles.paymentNoticeText}>
                        ⏳ Pending (Collect upon serving)
                      </Text>
                    </View>
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
                      : `Confirm & Save ${nextToken} • ₹${totalAmount}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.ivory,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
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
    backgroundColor: COLORS.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
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
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
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
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.apricot,
    marginTop: -4,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    shadowColor: COLORS.organic,
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
    backgroundColor: '#FAF2DE',
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
    color: COLORS.apricot,
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
    backgroundColor: '#FAF2DE',
    borderWidth: 1,
    borderColor: COLORS.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionAvatarText: {
    fontSize: 10,
    color: COLORS.apricot,
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
    borderColor: COLORS.apricot,
    backgroundColor: '#FDF1E2',
  },
  chipText: {
    fontSize: 11,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  chipTextSelected: {
    color: COLORS.apricot,
    ...FONTS.bold,
  },
  autoPrintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFDF7',
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
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
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
  paymentNoticeBox: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  paymentNoticeLabel: {
    fontSize: 11,
    color: COLORS.organic,
    ...FONTS.heavy,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  paymentNoticePill: {
    backgroundColor: '#FAF2DE',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: COLORS.apricot,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentNoticeText: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.bold,
  },
});
