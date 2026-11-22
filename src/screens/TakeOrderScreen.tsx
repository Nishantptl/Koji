import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  AppState,
} from 'react-native';
import {
  ShoppingBag,
  RotateCcw,
  ArrowRight,
  Search,
  X,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { MenuItem, Order, OrderInput, OrderType } from '../types';
import defaultMenuSeed from '../data/menu.json';
import { BrandHeader } from '../components/BrandHeader';
import { CategoryBar } from '../components/CategoryBar';
import { MenuItemCard } from '../components/MenuItemCard';
import { CheckoutModal } from '../components/CheckoutModal';
import { PaymentModal } from '../components/PaymentModal';
import { TokenBadge } from '../components/TokenBadge';
import { KojiConfirmModal, KojiConfirmModalProps } from '../components/KojiConfirmModal';
import { useCart } from '../context/CartContext';
import { saveOrder, getNextToken, getMenuItems, updateOrderPayment } from '../services/storage';
import { printStationKots } from '../services/printService';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface TakeOrderScreenProps {
  onOrderSaved?: () => void;
  menuRefreshTrigger?: number;
}

export const TakeOrderScreen: React.FC<TakeOrderScreenProps> = ({
  onOrderSaved,
  menuRefreshTrigger,
}) => {
  // Operational safeguard: Prevent screen dimming/sleeping during active counter shift
  useKeepAwake();

  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultMenuSeed as MenuItem[]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [nextToken, setNextToken] = useState<string>('#01');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [confirmModal, setConfirmModal] = useState<KojiConfirmModalProps | null>(null);

  // Global draft cart context (persisted across tabs & app reloads)
  const {
    cart,
    cartItemsList,
    totalQuantity,
    totalAmount,
    handleIncrement,
    handleDecrement,
    clearCart,
  } = useCart();


  // Load next sequential token
  const refreshNextToken = useCallback(async () => {
    try {
      const token = await getNextToken();
      setNextToken(token);
    } catch {
      // Fallback
    }
  }, []);

  // Midnight rollover / AppState listener: Refresh nextToken when returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshNextToken();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [refreshNextToken]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getNextToken(), getMenuItems()])
      .then(([token, items]) => {
        if (isMounted) {
          setNextToken(token);
          setMenuItems(items);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [menuRefreshTrigger]);

  // Dynamic categories based on current menu items
  const categoriesList = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map((m) => m.category))).filter(Boolean);
    const standardOrder = ['Sushi', 'Wok & Crisp', 'Rice & Noodles', 'Mocktail'];
    const sorted = [
      ...standardOrder.filter((c) => cats.includes(c)),
      ...cats.filter((c) => !standardOrder.includes(c)),
    ];
    return ['All', ...sorted];
  }, [menuItems]);

  // Filtered menu items based on category, search query, and veg-only filter
  const filteredItems = useMemo(() => {
    let items = menuItems;

    // Category filter
    if (selectedCategory !== 'All') {
      items = items.filter((item) => item.category === selectedCategory);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    return items;
  }, [menuItems, selectedCategory, searchQuery]);

  const handleClearCart = () => {
    if (totalQuantity === 0) return;

    setConfirmModal({
      visible: true,
      variant: 'danger',
      badgeLabel: 'Reset Cart',
      title: 'Reset Current Cart?',
      message: 'All selected dishes in this order will be removed. Are you sure you want to clear the cart?',
      highlightText: `${totalQuantity} dishes in cart (₹${totalAmount})`,
      primaryLabel: 'Yes, Reset Cart',
      cancelLabel: 'Keep Cart',
      onPrimaryPress: () => {
        setConfirmModal(null);
        clearCart();
      },
      onClose: () => setConfirmModal(null),
    });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleOpenReview = () => {
    if (totalQuantity === 0) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Missing Details',
        title: 'Cart is Empty',
        message: 'Please add at least one dish to the cart before reviewing.',
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
    setIsCheckoutOpen(true);
  };

  const handleConfirmOrder = async (details: {
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    autoPrint?: boolean;
    discount?: number;
    discountPercent?: number;
    subtotal?: number;
    paymentMethod?: 'UPI' | 'Cash';
    orderType?: OrderType;
  }) => {
    if (cartItemsList.length === 0) return;

    setIsSubmitting(true);
    try {
      const rawDiscount = details.discount || 0;
      const subtotal = details.subtotal || totalAmount;
      const discount = Math.min(subtotal, Math.max(0, rawDiscount));
      const finalTotal = Math.max(0, subtotal - discount);

      const isCash = details.paymentMethod === 'Cash';
      const isUpi = details.paymentMethod === 'UPI';

      const orderPayload: OrderInput = {
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        notes: details.notes,
        orderType: details.orderType || 'Dine-in',
        items: cartItemsList.map((i) => ({ ...i, status: 'pending', servedQuantity: 0 })),
        subtotal,
        discount,
        discountPercent: details.discountPercent,
        totalAmount: finalTotal,
        status: 'preparing',
        paymentMethod: details.paymentMethod,
        paymentStatus: isCash ? 'Completed' : 'Pending',
        amountPaid: isCash ? finalTotal : 0,
        paidAmount: isCash ? finalTotal : 0,
        balanceDue: isCash ? 0 : finalTotal,
        isPaid: isCash,
      };

      const saved = await saveOrder(orderPayload);

      // Trigger automatic station KOT print if enabled
      if (details.autoPrint) {
        printStationKots(saved).catch(() => {});
      }

      // Reset cart and modal
      clearCart();
      setIsCheckoutOpen(false);

      // Notify parent to refresh timeline
      onOrderSaved?.();

      // Refresh next token for subsequent order
      await refreshNextToken();

      if (isUpi) {
        setPayingOrder(saved);
      } else {
        setConfirmModal({
          visible: true,
          variant: 'forest',
          badgeLabel: 'Order Saved',
          title: 'Order Saved! 🎉',
          message: `Token ${saved.token} has been logged in kitchen (Total: ₹${saved.totalAmount}${isCash ? ' • Paid via Cash' : ''}).`,
          primaryLabel: 'Take Next Order',
          cancelLabel: '',
          onPrimaryPress: () => setConfirmModal(null),
          onClose: () => setConfirmModal(null),
        });
      }
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Save Failed',
        title: 'Unable to Save Order',
        message: err?.message || 'Unable to save order. Please retry.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Brand Header with Logo Asset & Next Token Badge */}
      <BrandHeader
        subtitle="Asian Crafted Fusion"
        rightElement={
          <View style={styles.tokenContainer}>
            <Text style={styles.tokenLabel}>NEXT TOKEN</Text>
            <TokenBadge token={nextToken} variant="apricot" size="md" />
          </View>
        }
      />

      {/* Live Menu Search Bar */}
      <View style={styles.searchRowContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color={COLORS.natural} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dishes (e.g. Wok, Dumpling)..."
            placeholderTextColor={COLORS.natural}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearSearchBtn}
            >
              <X size={14} color={COLORS.natural} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills Bar */}
      <CategoryBar
        categories={categoriesList}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Food Menu List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MenuItemCard
            item={item}
            quantity={cart[item.id]?.quantity || 0}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          totalQuantity > 0 && styles.listContentWithBottomBar,
          filteredItems.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Sparkles size={32} color={COLORS.natural} />
            <Text style={styles.emptyTitle}>No dishes match your filter</Text>
            <Text style={styles.emptySubtitle}>
              Try searching with another keyword or select another category.
            </Text>
            {(searchQuery.length > 0 || selectedCategory !== 'All') && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                style={styles.resetFiltersBtn}
              >
                <Text style={styles.resetFiltersBtnText}>Reset All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Persistent Bottom Action Bar */}
      {totalQuantity > 0 && (
        <View style={styles.bottomBarContainer}>
          <View style={styles.bottomBar}>
            <View style={styles.bottomBarInfo}>
              <View style={styles.itemCountBadge}>
                <ShoppingBag size={14} color={COLORS.forestGreen} />
                <Text style={styles.itemCountText}>
                  {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <Text style={styles.bottomBarTotal}>₹{totalAmount}</Text>
            </View>

            <View style={styles.bottomBarActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleClearCart}
                style={styles.bottomResetButton}
                accessibilityLabel="Reset cart"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RotateCcw size={20} color={COLORS.danger} strokeWidth={2.4} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleOpenReview}
                style={styles.reviewButton}
              >
                <Text style={styles.reviewButtonText}>Review & Save</Text>
                <ArrowRight size={18} color={COLORS.cream} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Checkout Bottom Sheet Modal */}
      <CheckoutModal
        visible={isCheckoutOpen}
        nextToken={nextToken}
        items={cartItemsList}
        totalAmount={totalAmount}
        onClose={() => setIsCheckoutOpen(false)}
        onConfirm={handleConfirmOrder}
        isSubmitting={isSubmitting}
      />

      {/* Dynamic UPI Payment Modal when UPI is selected at checkout */}
      <PaymentModal
        visible={Boolean(payingOrder)}
        order={payingOrder}
        onClose={() => setPayingOrder(null)}
        onPaymentCompleted={async (orderId, method, amount) => {
          try {
            const payMethod: 'UPI' | 'Cash' = method === 'Cash' ? 'Cash' : 'UPI';
            await updateOrderPayment(orderId, payMethod, amount);
            onOrderSaved?.();
          } catch {}
          setPayingOrder(null);
        }}
      />

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  tokenContainer: {
    alignItems: 'flex-end',
  },
  tokenLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    ...FONTS.heavy,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  resetButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(159, 136, 111, 0.4)',
    height: 42,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.regular,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  vegChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(159, 136, 111, 0.4)',
    backgroundColor: COLORS.white,
  },
  vegChipActive: {
    borderColor: COLORS.veg,
    backgroundColor: COLORS.successTint,
  },
  vegChipText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  vegChipTextActive: {
    color: COLORS.veg,
    ...FONTS.bold,
  },
  listContent: {
    paddingTop: 6,
    paddingBottom: SPACING.xxxl,
  },
  listContentWithBottomBar: {
    paddingBottom: 110,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxxl,
  },
  emptyTitle: {
    fontSize: 16,
    color: COLORS.organic,
    ...FONTS.bold,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    ...FONTS.regular,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  resetFiltersBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.organic,
  },
  resetFiltersBtnText: {
    fontSize: 12,
    color: COLORS.ivory,
    ...FONTS.bold,
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: 'transparent',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(140, 158, 145, 0.35)',
  },
  bottomBarInfo: {
    flexDirection: 'column',
  },
  itemCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemCountText: {
    fontSize: 12,
    color: COLORS.natural,
    ...FONTS.medium,
  },
  bottomBarTotal: {
    fontSize: 22,
    color: COLORS.forestGreen,
    ...FONTS.heavy,
    letterSpacing: 0.5,
  },
  bottomBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomResetButton: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  reviewButtonText: {
    fontSize: 15,
    color: COLORS.cream,
    ...FONTS.heavy,
    letterSpacing: 0.3,
  },
});
