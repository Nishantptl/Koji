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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Order, CartItem, MenuItem } from '../types';
import { VegBadge } from './VegBadge';
import { TokenBadge } from './TokenBadge';
import { getMenuItems, recalculateOrderTotal, formatTime } from '../services/storage';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface EditOrderModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSave: (orderId: string, updatedItems: CartItem[]) => void;
}

interface EditOrderModalContentProps {
  order: Order;
  onClose: () => void;
  onSave: (orderId: string, updatedItems: CartItem[]) => void;
}

const EditOrderModalContent: React.FC<EditOrderModalContentProps> = ({
  order,
  onClose,
  onSave,
}) => {
  const [items, setItems] = useState<CartItem[]>(() =>
    order.items.map((i) => ({ ...i }))
  );
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

  const handleAddDish = (menuDish: MenuItem | CartItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }

    setItems((prev) => {
      const baseDishId = menuDish.id.split('_addon_')[0];

      // 1. Check if there is an existing UN-SERVED add-on batch of this item added in this session:
      const existingUnservedAddonIdx = prev.findIndex(
        (i) =>
          i.id.split('_addon_')[0] === baseDishId &&
          Boolean(i.isAddon) &&
          (i.servedQuantity ?? 0) === 0 &&
          i.status !== 'cancelled'
      );

      if (existingUnservedAddonIdx >= 0) {
        const copy = [...prev];
        copy[existingUnservedAddonIdx] = {
          ...copy[existingUnservedAddonIdx],
          quantity: copy[existingUnservedAddonIdx].quantity + 1,
        };
        return copy;
      }

      // 2. Check if an original (non-addon) item exists and has NOT been served
      const originalItemIdx = prev.findIndex(
        (i) =>
          !i.isAddon &&
          (i.id === menuDish.id || i.id.split('_addon_')[0] === baseDishId)
      );

      if (
        originalItemIdx >= 0 &&
        (prev[originalItemIdx].servedQuantity ?? 0) === 0 &&
        prev[originalItemIdx].status !== 'completed'
      ) {
        // Can increment the original unserved dish
        const copy = [...prev];
        copy[originalItemIdx] = {
          ...copy[originalItemIdx],
          quantity: copy[originalItemIdx].quantity + 1,
          status: copy[originalItemIdx].status === 'cancelled' ? 'pending' : copy[originalItemIdx].status,
        };
        return copy;
      }

      // 3. Otherwise (the item has already been partially or fully served (servedQuantity > 0)
      // or no item exists): Treat newly added dish as an INDEPENDENT BATCH with an isAddon: true flag,
      // its own unique item ID, its addition timestamp, and servedQuantity: 0.
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

    // Do NOT simply increment the quantity of an existing item if that item has already been
    // partially or fully served (servedQuantity > 0). Create an independent add-on batch!
    if (servedCount > 0 || targetItem.status === 'completed') {
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

  const handleSave = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Ignore
    }
    onSave(order.id, items);
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
        </View>
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onClose}
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
                        <Minus size={13} color={COLORS.ivory} />
                      </TouchableOpacity>
                      <Text style={styles.stepperQtyText}>
                        {cartItem.quantity}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleIncrement(idx)}
                        style={styles.stepperBtn}
                      >
                        <Plus size={13} color={COLORS.ivory} />
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
              </React.Fragment>
            );
          })
        )}

        {/* Section 2: Add-On Dishes from Menu */}
        <View style={styles.addSectionDivider} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ADD MORE DISHES</Text>
          <Text style={styles.hintText}>Stamps new dishes with live timestamp</Text>
        </View>

        {/* Quick Search */}
        <View style={styles.searchBar}>
          <Search size={14} color={COLORS.natural} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu to add..."
            placeholderTextColor={COLORS.natural}
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
                <Plus size={13} color={COLORS.organic} strokeWidth={2.4} />
                <Text style={styles.addDishBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer Save Action */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSave}
          style={styles.saveButton}
        >
          <CheckCircle2 size={18} color={COLORS.ivory} strokeWidth={2.4} />
          <Text style={styles.saveButtonText}>
            {(() => {
              const currentPaid = typeof order.amountPaid === 'number'
                ? order.amountPaid
                : (order.paymentStatus === 'Completed' ? order.totalAmount : 0);
              const estimatedDue = Math.max(0, activeTotal - currentPaid);
              if (currentPaid > 0 && estimatedDue > 0) {
                return `Save Ticket Changes • Total: ₹${activeTotal} (Due: ₹${estimatedDue})`;
              }
              return `Save Ticket Changes • ₹${activeTotal}`;
            })()}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  visible,
  order,
  onClose,
  onSave,
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
    backgroundColor: COLORS.ivory,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    ...FONTS.bold,
    letterSpacing: 0.8,
  },
  activeTotalText: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  hintText: {
    fontSize: 10,
    color: COLORS.textMuted,
    ...FONTS.regular,
  },
  emptyItemsBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  emptyItemsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    ...FONTS.regular,
  },
  ticketItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  ticketItemRowCancelled: {
    opacity: 0.5,
    backgroundColor: '#F5EAE1',
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
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  textLineThrough: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  addedAtBadge: {
    fontSize: 9,
    color: COLORS.apricot,
    ...FONTS.heavy,
    marginTop: 1,
  },
  cancelledBadge: {
    fontSize: 9,
    color: COLORS.danger,
    ...FONTS.bold,
    marginTop: 1,
  },
  servedBadge: {
    fontSize: 9,
    color: COLORS.veg,
    ...FONTS.bold,
    marginTop: 1,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  modalAddonDivider: {
    alignItems: 'center',
    marginVertical: 8,
    paddingVertical: 3,
    backgroundColor: '#FAF2DE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.apricot,
  },
  modalAddonDividerText: {
    fontSize: 10,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  ticketItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketItemPrice: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.bold,
    minWidth: 42,
    textAlign: 'right',
  },
  miniStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.organic,
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
    color: COLORS.ivory,
    ...FONTS.heavy,
    minWidth: 14,
    textAlign: 'center',
  },
  trashBtn: {
    padding: 4,
  },
  addSectionDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    height: 36,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.organic,
    marginLeft: 6,
    ...FONTS.regular,
  },
  menuAddList: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
  },
  menuAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
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
    color: COLORS.organic,
    ...FONTS.semibold,
  },
  menuAddPrice: {
    fontSize: 11,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },
  addDishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addDishBtnText: {
    fontSize: 11,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.cream,
  },
  saveButton: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.organic,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 13.5,
    color: COLORS.ivory,
    ...FONTS.heavy,
    textAlign: 'center',
    flexShrink: 1,
  },
});
