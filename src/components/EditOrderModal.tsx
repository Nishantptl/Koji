import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Search,
  CheckCircle2,
  Printer,
  FileText,
  Ban,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Order, CartItem, MenuItem } from '../types';
import { VegBadge } from './VegBadge';
import { TokenBadge } from './TokenBadge';
import { getMenuItems, recalculateOrderTotal, formatTime } from '../services/storage';
import { COLORS, FONTS, SPACING } from '../constants/theme';

const PRESET_KITCHEN_CHIPS = [
  'Extra Spicy',
  'Less Spicy',
  'No Onion/Garlic',
  'Pack Separate',
  'Urgent',
];

interface EditOrderModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSave: (
    orderId: string,
    updatedItems: CartItem[],
    orderNotes?: string,
    shouldPrintKot?: boolean
  ) => void;
  onCancelOrder?: (order: Order) => void;
  onRequestRefund?: (
    order: Order,
    updatedItems: CartItem[],
    refundDue: number,
    orderNotes?: string,
    shouldPrintKot?: boolean
  ) => void;
}

interface EditOrderModalContentProps {
  order: Order;
  onClose: () => void;
  onSave: (
    orderId: string,
    updatedItems: CartItem[],
    orderNotes?: string,
    shouldPrintKot?: boolean
  ) => void;
  onCancelOrder?: (order: Order) => void;
  onRequestRefund?: (
    order: Order,
    updatedItems: CartItem[],
    refundDue: number,
    orderNotes?: string,
    shouldPrintKot?: boolean
  ) => void;
}

const EditOrderModalContent: React.FC<EditOrderModalContentProps> = ({
  order,
  onClose,
  onSave,
  onCancelOrder,
  onRequestRefund,
}) => {
  const [items, setItems] = useState<CartItem[]>(() =>
    order.items.map((i) => ({ ...i }))
  );
  const [orderNotes, setOrderNotes] = useState<string>(order.notes || '');
  const [activeNoteIndexes, setActiveNoteIndexes] = useState<{ [index: number]: boolean }>({});
  const [allMenu, setAllMenu] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    getMenuItems()
      .then((menu) => {
        if (isMounted) {
          setAllMenu(menu);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const activeTotal = useMemo(() => {
    return recalculateOrderTotal(items);
  }, [items]);

  const handleToggleNoteInput = (index: number) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setActiveNoteIndexes((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleItemNoteChange = (index: number, text: string) => {
    setItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = {
          ...copy[index],
          notes: text.trim() ? text : undefined,
        };
      }
      return copy;
    });
  };

  const handleAddPresetChip = (chip: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setOrderNotes((prev) => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return chip;
      if (cleanPrev.toLowerCase().includes(chip.toLowerCase())) return cleanPrev;
      return `${cleanPrev}, ${chip}`;
    });
  };

  const handleAddDish = (menuDish: MenuItem | CartItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }

    setItems((prev) => {
      const baseDishId = menuDish.id.split('_addon_')[0];

      // 1. Check if there is an existing UN-SERVED, unprinted add-on batch of this item in this edit session:
      const existingUnservedAddonIdx = prev.findIndex(
        (i) =>
          i.id.split('_addon_')[0] === baseDishId &&
          Boolean(i.isAddon) &&
          (i.servedQuantity ?? 0) === 0 &&
          i.status !== 'cancelled' &&
          !i.isPrinted
      );

      if (existingUnservedAddonIdx >= 0) {
        const copy = [...prev];
        copy[existingUnservedAddonIdx] = {
          ...copy[existingUnservedAddonIdx],
          quantity: copy[existingUnservedAddonIdx].quantity + 1,
        };
        return copy;
      }

      // 2. Otherwise treat newly added dish as a separate add-on line item with an isAddon: true flag,
      // its own unique item ID, its addition timestamp, and servedQuantity: 0.
      // NEVER merge into or mutate an existing original or already-served line item.
      const nowIso = new Date().toISOString();
      const uniqueAddonId = `${baseDishId}_addon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const newItem: CartItem = {
        ...menuDish,
        id: uniqueAddonId,
        quantity: 1,
        servedQuantity: 0,
        status: 'pending',
        addedAt: nowIso,
        isAddon: true,
        notified: false,
      };

      return [...prev, newItem];
    });
  };

  const handleIncrement = (index: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }

    const targetItem = items[index];
    const servedCount = targetItem.servedQuantity ?? 0;

    // Do NOT increment quantity of an existing original or already-served item (which turns 1/1 into 1/2).
    // Instead, delegate to handleAddDish to append a separate add-on item in the Add-Ons section!
    if (!targetItem.isAddon || servedCount > 0 || targetItem.status === 'completed' || targetItem.isPrinted) {
      handleAddDish(targetItem);
      return;
    }

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        quantity: copy[index].quantity + 1,
      };
      return copy;
    });
  };

  const handleDecrement = (index: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }

    const targetItem = items[index];
    const servedCount = targetItem.servedQuantity ?? 0;

    // Protect against decrementing below already served count
    if (targetItem.quantity <= servedCount && servedCount > 0) {
      return;
    }

    setItems((prev) => {
      const copy = [...prev];
      if (copy[index].quantity > 1) {
        copy[index] = {
          ...copy[index],
          quantity: copy[index].quantity - 1,
        };
      } else {
        copy.splice(index, 1);
      }
      return copy;
    });
  };

  const handleRemove = (index: number) => {
    const targetItem = items[index];
    const servedCount = targetItem.servedQuantity ?? 0;

    if (servedCount > 0) {
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }

    setItems((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleSave = (shouldPrintKot: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Ignore
    }

    const alreadyPaid = (order.upiPaid || 0) + (order.cashPaid || 0);
    const rawSubtotal = recalculateOrderTotal(items);
    const discount = Math.min(rawSubtotal, Math.max(0, order.discount || 0));
    const newGrandTotal = Math.max(0, rawSubtotal - discount);

    if (alreadyPaid > newGrandTotal && onRequestRefund) {
      const refundDue = alreadyPaid - newGrandTotal;
      onRequestRefund(
        order,
        items,
        refundDue,
        orderNotes.trim() ? orderNotes.trim() : undefined,
        shouldPrintKot
      );
      onClose();
      return;
    }

    onSave(order.id, items, orderNotes.trim() ? orderNotes.trim() : undefined, shouldPrintKot);
    onClose();
  };

  const filteredMenu = useMemo(() => {
    if (!searchQuery.trim()) return allMenu;
    const q = searchQuery.toLowerCase().trim();
    return allMenu.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [allMenu, searchQuery]);

  return (
    <View style={styles.sheetContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Edit Order</Text>
          <TokenBadge token={order.token} variant="apricot" size="md" />
          {onCancelOrder && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                onClose();
                onCancelOrder(order);
              }}
              style={styles.cancelOrderHeaderBtn}
            >
              <Ban size={12} color={COLORS.danger} strokeWidth={2.4} />
              <Text style={styles.cancelOrderHeaderBtnText}>Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onClose}
          style={styles.closeButton}
        >
          <X size={20} color={COLORS.forest} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1: Current Items on Ticket */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CURRENT TICKET ITEMS</Text>
          <Text style={styles.activeTotalText}>Active Total: ₹{activeTotal}</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyItemsBox}>
            <Text style={styles.emptyItemsText}>
              No items remaining on this ticket. Add dishes below.
            </Text>
          </View>
        ) : (
          items.map((cartItem, idx) => {
            const isCancelled = cartItem.status === 'cancelled';
            const isAddonItem = Boolean(cartItem.isAddon || cartItem.addedAt);
            const prevItem = idx > 0 ? items[idx - 1] : null;
            const prevIsAddon = Boolean(prevItem?.isAddon || prevItem?.addedAt);
            const showAddonDivider = Boolean(
              isAddonItem &&
                (!prevIsAddon ||
                  (cartItem.addedAt &&
                    prevItem?.addedAt &&
                    formatTime(prevItem.addedAt) !== formatTime(cartItem.addedAt)))
            );
            const servedCount = cartItem.servedQuantity ?? 0;
            const isCannotDecrement = servedCount > 0 && cartItem.quantity <= servedCount;
            const isNoteOpen = Boolean(activeNoteIndexes[idx] || cartItem.notes);

            return (
              <React.Fragment key={`${cartItem.id}_${idx}`}>
                {showAddonDivider && (
                  <View style={styles.modalAddonDivider}>
                    <Text style={styles.modalAddonDividerText}>
                      ── Added Items ({formatTime(cartItem.addedAt || order.timestamp)}) ──
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.ticketItemRow,
                    isCancelled && styles.ticketItemRowCancelled,
                  ]}
                >
                  <View style={styles.ticketItemMainRow}>
                    <View style={styles.ticketItemLeft}>
                      <VegBadge isVeg={cartItem.isVeg} size={13} />
                      <View style={styles.ticketItemNameCol}>
                        <Text
                          style={[
                            styles.ticketItemName,
                            isCancelled && styles.textLineThrough,
                          ]}
                          numberOfLines={1}
                        >
                          {cartItem.name}
                        </Text>
                        <View style={styles.ticketItemBadgeRow}>
                          {servedCount > 0 && (
                            <Text style={styles.servedBadge}>
                              ✓ {servedCount}/{cartItem.quantity} served
                            </Text>
                          )}
                          {cartItem.isAddon && (
                            <Text style={styles.addedAtBadge}>
                              + Add-on Batch
                            </Text>
                          )}
                          {isCancelled && (
                            <Text style={styles.cancelledBadge}>
                              Cancelled (₹0)
                            </Text>
                          )}

                          {/* Per-Item Note Toggle Button */}
                          {!isCancelled && (
                            <TouchableOpacity
                              activeOpacity={0.75}
                              onPress={() => handleToggleNoteInput(idx)}
                              style={[
                                styles.itemNoteToggleBtn,
                                Boolean(cartItem.notes) && styles.itemNoteToggleBtnActive,
                              ]}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <FileText size={10} color={cartItem.notes ? COLORS.forest : COLORS.slate} />
                              <Text
                                style={[
                                  styles.itemNoteToggleText,
                                  Boolean(cartItem.notes) && styles.itemNoteToggleTextActive,
                                ]}
                              >
                                {cartItem.notes ? 'Note' : '+ Note'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.ticketItemActions}>
                      <Text style={styles.ticketItemPrice}>
                        ₹{cartItem.price * cartItem.quantity}
                      </Text>

                      <View style={styles.miniStepper}>
                        <TouchableOpacity
                          onPress={() => handleDecrement(idx)}
                          disabled={isCannotDecrement}
                          style={[styles.stepperBtn, isCannotDecrement && styles.btnDisabled]}
                        >
                          <Minus size={13} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.stepperQtyText}>
                          {cartItem.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleIncrement(idx)}
                          style={styles.stepperBtn}
                        >
                          <Plus size={13} color={COLORS.white} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleRemove(idx)}
                        disabled={servedCount > 0}
                        style={[styles.trashBtn, servedCount > 0 && styles.btnDisabled]}
                      >
                        <Trash2 size={15} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Inline Preparation Note Input for this dish row */}
                  {isNoteOpen && !isCancelled && (
                    <View style={styles.itemNoteInputRow}>
                      <TextInput
                        style={styles.itemNoteInput}
                        placeholder="Add prep note (e.g. Less spicy, No onion)..."
                        placeholderTextColor={COLORS.slate}
                        value={cartItem.notes || ''}
                        onChangeText={(txt) => handleItemNoteChange(idx, txt)}
                      />
                      {Boolean(cartItem.notes) && (
                        <TouchableOpacity
                          onPress={() => handleItemNoteChange(idx, '')}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={styles.clearItemNoteBtn}
                        >
                          <X size={12} color={COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </React.Fragment>
            );
          })
        )}

        {/* Section 2: Add-On Dishes from Menu */}
        <View style={styles.addSectionDivider} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ADD MORE DISHES</Text>
          <Text style={styles.hintText}>Appends as new add-on batch</Text>
        </View>

        {/* Quick Search */}
        <View style={styles.searchBar}>
          <Search size={14} color={COLORS.slate} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu to add..."
            placeholderTextColor={COLORS.slate}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Menu List to Add */}
        <View style={styles.menuAddList}>
          {filteredMenu.map((dish) => (
            <View key={dish.id} style={styles.menuAddRow}>
              <View style={styles.menuAddLeft}>
                <VegBadge isVeg={dish.isVeg} size={12} />
                <View style={styles.menuAddTitleCol}>
                  <Text style={styles.menuAddName} numberOfLines={1}>
                    {dish.name}
                  </Text>
                  <Text style={styles.menuAddPrice}>₹{dish.price}</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleAddDish(dish)}
                style={styles.addDishBtn}
              >
                <Plus size={13} color={COLORS.forest} strokeWidth={2.4} />
                <Text style={styles.addDishBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Section 3: Extra Kitchen / Order-Level Notes with Quick Chips */}
        <View style={styles.addSectionDivider} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>EXTRA KITCHEN / ORDER NOTE</Text>
          <Text style={styles.hintText}>Printed on KOT slips</Text>
        </View>

        <View style={styles.orderNoteChipsRow}>
          {PRESET_KITCHEN_CHIPS.map((chip) => {
            const isIncluded = orderNotes.toLowerCase().includes(chip.toLowerCase());
            return (
              <TouchableOpacity
                key={chip}
                activeOpacity={0.75}
                onPress={() => handleAddPresetChip(chip)}
                style={[
                  styles.orderNoteChip,
                  isIncluded && styles.orderNoteChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.orderNoteChipText,
                    isIncluded && styles.orderNoteChipTextSelected,
                  ]}
                >
                  {chip}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.orderNoteInputContainer}>
          <TextInput
            style={styles.orderNoteTextInput}
            placeholder="Special preparation instructions, allergy requests, packing instructions..."
            placeholderTextColor={COLORS.slate}
            multiline
            numberOfLines={2}
            value={orderNotes}
            onChangeText={setOrderNotes}
          />
          {Boolean(orderNotes) && (
            <TouchableOpacity
              onPress={() => setOrderNotes('')}
              style={styles.clearOrderNoteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color={COLORS.slate} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Footer: Dual Action Buttons */}
      <View style={styles.footer}>
        <View style={styles.footerDualRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSave(false)}
            style={styles.saveChangesOnlyBtn}
          >
            <CheckCircle2 size={16} color={COLORS.forest} strokeWidth={2.4} />
            <Text style={styles.saveChangesOnlyBtnText} numberOfLines={1}>
              Save Changes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSave(true)}
            style={styles.saveAndPrintKotBtn}
          >
            <Printer size={16} color={COLORS.white} strokeWidth={2.4} />
            <Text style={styles.saveAndPrintKotBtnText} numberOfLines={1}>
              Save &amp; Print KOT
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  visible,
  order,
  onClose,
  onSave,
  onCancelOrder,
  onRequestRefund,
}) => {
  if (!order || !visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoider}
      >
        <View style={styles.backdrop}>
          <EditOrderModalContent
            key={order.id}
            order={order}
            onClose={onClose}
            onSave={onSave}
            onCancelOrder={onCancelOrder}
            onRequestRefund={onRequestRefund}
          />
        </View>
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
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
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
    flex: 1,
  },
  cancelOrderHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDECEB',
    borderColor: COLORS.danger,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 'auto',
    marginRight: 8,
  },
  cancelOrderHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
  },
  headerTitle: {
    fontSize: 18,
    color: COLORS.forest,
    ...FONTS.heavy,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.bold,
    letterSpacing: 0.8,
  },
  activeTotalText: {
    fontSize: 12,
    color: COLORS.amber,
    ...FONTS.heavy,
  },
  hintText: {
    fontSize: 10.5,
    color: COLORS.slate,
    ...FONTS.medium,
  },
  emptyItemsBox: {
    padding: SPACING.lg,
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  emptyItemsText: {
    fontSize: 12,
    color: COLORS.slate,
    ...FONTS.medium,
    textAlign: 'center',
  },
  modalAddonDivider: {
    backgroundColor: COLORS.amberTint,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  modalAddonDividerText: {
    fontSize: 9.5,
    color: COLORS.amber,
    ...FONTS.bold,
    letterSpacing: 0.4,
  },
  ticketItemRow: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ticketItemRowCancelled: {
    opacity: 0.45,
    backgroundColor: COLORS.canvas,
  },
  ticketItemMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ticketItemNameCol: {
    flex: 1,
  },
  ticketItemName: {
    fontSize: 13.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  ticketItemBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  textLineThrough: {
    textDecorationLine: 'line-through',
    color: COLORS.slate,
  },
  servedBadge: {
    fontSize: 10,
    color: COLORS.success,
    ...FONTS.semibold,
  },
  addedAtBadge: {
    fontSize: 10,
    color: COLORS.amber,
    ...FONTS.bold,
  },
  cancelledBadge: {
    fontSize: 10,
    color: COLORS.danger,
    ...FONTS.bold,
  },
  itemNoteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  itemNoteToggleBtnActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.forest,
  },
  itemNoteToggleText: {
    fontSize: 9.5,
    color: COLORS.slate,
    ...FONTS.bold,
  },
  itemNoteToggleTextActive: {
    color: COLORS.forest,
  },
  itemNoteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    marginTop: 6,
    height: 34,
  },
  itemNoteInput: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.forest,
    ...FONTS.medium,
    paddingVertical: 0,
  },
  clearItemNoteBtn: {
    padding: 3,
  },
  ticketItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketItemPrice: {
    fontSize: 13,
    color: COLORS.forest,
    ...FONTS.bold,
    minWidth: 44,
    textAlign: 'right',
  },
  miniStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forest,
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
  },
  stepperBtn: {
    padding: 2,
  },
  stepperQtyText: {
    fontSize: 12,
    color: COLORS.white,
    ...FONTS.heavy,
    minWidth: 14,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  trashBtn: {
    padding: 4,
  },
  addSectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    height: 36,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.forest,
    marginLeft: 6,
    ...FONTS.regular,
  },
  menuAddList: {
    backgroundColor: COLORS.sage,
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  menuAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuAddLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  menuAddTitleCol: {
    flex: 1,
  },
  menuAddName: {
    fontSize: 13,
    color: COLORS.forest,
    ...FONTS.semibold,
  },
  menuAddPrice: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.medium,
  },
  addDishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.sage,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addDishBtnText: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  // Order-Level Notes Styles
  orderNoteChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  orderNoteChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  orderNoteChipSelected: {
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
  },
  orderNoteChipText: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.semibold,
  },
  orderNoteChipTextSelected: {
    color: COLORS.amber,
    ...FONTS.bold,
  },
  orderNoteInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.canvas,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 52,
    marginBottom: SPACING.md,
  },
  orderNoteTextInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.forest,
    ...FONTS.medium,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
  clearOrderNoteBtn: {
    padding: 2,
    marginLeft: 6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.canvas,
  },
  footerDualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveChangesOnlyBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.forest,
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  saveChangesOnlyBtnText: {
    fontSize: 13,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  saveAndPrintKotBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.forest,
    borderRadius: 14,
    paddingHorizontal: 10,
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveAndPrintKotBtnText: {
    fontSize: 13,
    color: COLORS.white,
    ...FONTS.bold,
  },
});
