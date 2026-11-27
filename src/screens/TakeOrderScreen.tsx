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
  Zap,
  Clock,
  Flame,
  Minus,
  Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import {
  MenuItem,
  OrderInput,
  OrderType,
  SushiWaitEstimate,
  KitchenWaitEstimate,
} from '../types';
import defaultMenuSeed from '../data/menu.json';
import { BrandHeader } from '../components/BrandHeader';
import { CategoryBar } from '../components/CategoryBar';
import { MenuItemCard } from '../components/MenuItemCard';
import { CheckoutModal } from '../components/CheckoutModal';
import { TokenBadge } from '../components/TokenBadge';
import { KojiConfirmModal, KojiConfirmModalProps } from '../components/KojiConfirmModal';
import { useCart } from '../context/CartContext';
import {
  saveOrder,
  getNextToken,
  getMenuItems,
  calculateSushiWaitEstimate,
  getSushiWaitOffset,
  setSushiWaitOffset,
  isSushiItem,
  formatWaitWindow,
  calculateKitchenWaitEstimate,
  getKitchenWaitOffset,
  setKitchenWaitOffset,
  isKitchenItem,
} from '../services/storage';
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
  const [confirmModal, setConfirmModal] = useState<KojiConfirmModalProps | null>(null);
  const [sushiManualOffsetMins, setSushiManualOffsetMins] = useState<number>(0);
  const [kitchenManualOffsetMins, setKitchenManualOffsetMins] = useState<number>(0);
  const [sushiQueueEstimate, setSushiQueueEstimate] = useState<SushiWaitEstimate>({
    pendingSushiCount: 0,
    rawMinutes: 0,
    manualOffsetMins: 0,
    totalMinutes: 0,
    minMinutes: 0,
    maxMinutes: 5,
    formattedRange: 'No wait • Immediate',
    compactRange: 'Immediate',
    urgencyLevel: 'low',
  });
  const [kitchenQueueEstimate, setKitchenQueueEstimate] = useState<KitchenWaitEstimate>({
    pendingKitchenCount: 0,
    rawMinutes: 0,
    manualOffsetMins: 0,
    totalMinutes: 0,
    minMinutes: 0,
    maxMinutes: 5,
    formattedRange: 'No wait • Immediate',
    compactRange: 'Immediate',
    urgencyLevel: 'low',
  });

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

  // Count of unserved sushi rolls in customer's current draft cart
  const currentCartSushiCount = useMemo(() => {
    return cartItemsList.reduce((sum, item) => {
      if (isSushiItem(item, menuItems)) {
        return sum + (item.quantity || 0);
      }
      return sum;
    }, 0);
  }, [cartItemsList, menuItems]);

  // Count of unserved kitchen dishes in customer's current draft cart (Wok & Crisp, Rice & Noodles)
  const currentCartKitchenCount = useMemo(() => {
    return cartItemsList.reduce((sum, item) => {
      if (isKitchenItem(item, menuItems)) {
        return sum + (item.quantity || 0);
      }
      return sum;
    }, 0);
  }, [cartItemsList, menuItems]);

  // Refresh sushi & kitchen wait estimates from active queue
  const refreshWaitEstimates = useCallback(async () => {
    try {
      const [sushiOffset, kitchenOffset] = await Promise.all([
        getSushiWaitOffset(),
        getKitchenWaitOffset(),
      ]);
      setSushiManualOffsetMins(sushiOffset);
      setKitchenManualOffsetMins(kitchenOffset);

      const [sEst, kEst] = await Promise.all([
        calculateSushiWaitEstimate({
          manualOffsetMins: sushiOffset,
          menuItemsOverride: menuItems,
        }),
        calculateKitchenWaitEstimate({
          manualOffsetMins: kitchenOffset,
          menuItemsOverride: menuItems,
        }),
      ]);
      setSushiQueueEstimate(sEst);
      setKitchenQueueEstimate(kEst);
    } catch {
      // Fallback
    }
  }, [menuItems]);

  // Combined live preview wait estimate including customer's current cart sushi
  const sushiCartEstimate = useMemo(() => {
    if (currentCartSushiCount === 0) return null;
    const totalCount = sushiQueueEstimate.pendingSushiCount + currentCartSushiCount;
    const rawMins = totalCount * 3.5;
    const totalMins = Math.max(0, rawMins + sushiManualOffsetMins);
    return formatWaitWindow(totalMins);
  }, [sushiQueueEstimate.pendingSushiCount, currentCartSushiCount, sushiManualOffsetMins]);

  const sushiEffectiveUrgency = sushiCartEstimate
    ? sushiCartEstimate.urgencyLevel
    : sushiQueueEstimate.urgencyLevel;

  // Combined live preview wait estimate including customer's current cart kitchen dishes
  const kitchenCartEstimate = useMemo(() => {
    if (currentCartKitchenCount === 0) return null;
    const totalCount = kitchenQueueEstimate.pendingKitchenCount + currentCartKitchenCount;
    const rawMins = totalCount * 3.5;
    const totalMins = Math.max(0, rawMins + kitchenManualOffsetMins);
    return formatWaitWindow(totalMins);
  }, [kitchenQueueEstimate.pendingKitchenCount, currentCartKitchenCount, kitchenManualOffsetMins]);

  const kitchenEffectiveUrgency = kitchenCartEstimate
    ? kitchenCartEstimate.urgencyLevel
    : kitchenQueueEstimate.urgencyLevel;

  // Quick -5m / +5m manual adjustment stepper for Sushi
  const handleAdjustSushiWait = async (delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const newOffset = sushiManualOffsetMins + delta;
    const rawMins = sushiQueueEstimate.pendingSushiCount * 3.5;
    let clampedOffset = newOffset;
    if (rawMins + newOffset < 0) {
      clampedOffset = -rawMins;
    }

    setSushiManualOffsetMins(clampedOffset);
    await setSushiWaitOffset(clampedOffset);

    const est = await calculateSushiWaitEstimate({
      manualOffsetMins: clampedOffset,
      menuItemsOverride: menuItems,
    });
    setSushiQueueEstimate(est);
  };

  // Quick -5m / +5m manual adjustment stepper for Kitchen
  const handleAdjustKitchenWait = async (delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const newOffset = kitchenManualOffsetMins + delta;
    const rawMins = kitchenQueueEstimate.pendingKitchenCount * 3.5;
    let clampedOffset = newOffset;
    if (rawMins + newOffset < 0) {
      clampedOffset = -rawMins;
    }

    setKitchenManualOffsetMins(clampedOffset);
    await setKitchenWaitOffset(clampedOffset);

    const est = await calculateKitchenWaitEstimate({
      manualOffsetMins: clampedOffset,
      menuItemsOverride: menuItems,
    });
    setKitchenQueueEstimate(est);
  };

  // Refresh wait estimate on initial mount & menuRefreshTrigger (e.g. tab focus)
  useEffect(() => {
    let isMounted = true;
    Promise.all([getSushiWaitOffset(), getKitchenWaitOffset()])
      .then(([sushiOffset, kitchenOffset]) => {
        if (!isMounted) return;
        setSushiManualOffsetMins(sushiOffset);
        setKitchenManualOffsetMins(kitchenOffset);
        return Promise.all([
          calculateSushiWaitEstimate({
            manualOffsetMins: sushiOffset,
            menuItemsOverride: menuItems,
          }),
          calculateKitchenWaitEstimate({
            manualOffsetMins: kitchenOffset,
            menuItemsOverride: menuItems,
          }),
        ]);
      })
      .then((res) => {
        if (isMounted && res) {
          const [sEst, kEst] = res;
          if (sEst) setSushiQueueEstimate(sEst);
          if (kEst) setKitchenQueueEstimate(kEst);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [menuItems, menuRefreshTrigger]);

  // Periodic safeguard refresh every 5s while on Take Order screen
  useEffect(() => {
    const timer = setInterval(() => {
      refreshWaitEstimates();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshWaitEstimates]);

  // Load next sequential token
  const refreshNextToken = useCallback(async () => {
    try {
      const token = await getNextToken();
      setNextToken(token);
    } catch {
      // Fallback
    }
  }, []);

  // Midnight rollover / AppState listener: Refresh nextToken and wait estimate when returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshNextToken();
        refreshWaitEstimates();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [refreshNextToken, refreshWaitEstimates]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getNextToken(), getMenuItems()])
      .then(([token, items]) => {
        if (isMounted) {
          setNextToken(token);
          setMenuItems(items);
        }
      })
      .catch(() => { });

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
    orderType?: OrderType;
  }) => {
    if (cartItemsList.length === 0) return;

    setIsSubmitting(true);
    try {
      const rawDiscount = details.discount || 0;
      const subtotal = details.subtotal || totalAmount;
      const discount = Math.min(subtotal, Math.max(0, rawDiscount));
      const finalTotal = Math.max(0, subtotal - discount);

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
        paymentMethod: undefined,
        paymentStatus: 'Unpaid',
        amountPaid: 0,
        paidAmount: 0,
        balanceDue: finalTotal,
        isPaid: false,
      };

      const saved = await saveOrder(orderPayload);

      // Trigger automatic station KOT print if enabled
      if (details.autoPrint) {
        printStationKots(saved).catch(() => { });
      }

      // Reset cart and modal
      clearCart();
      setIsCheckoutOpen(false);

      // Notify parent to refresh timeline
      onOrderSaved?.();

      // Refresh next token for subsequent order
      await refreshNextToken();
      await refreshWaitEstimates();

      setConfirmModal({
        visible: true,
        variant: 'forest',
        badgeLabel: 'Order Placed',
        title: 'Order Sent to Kitchen',
        message: `Token ${saved.token} has been logged in kitchen (Total: ₹${saved.totalAmount} • Unpaid).`,
        highlightText: `Token ${saved.token} • ${saved.items.length} dishes`,
        primaryLabel: 'Done',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
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

      {/* Live Sushi & Kitchen Queue Wait-Time Estimator Stack */}
      <View style={styles.waitPillOuterContainer}>
        <View style={styles.waitBannersStack}>
          {/* 1. Sushi Wait Banner */}
          <View
            style={[
              styles.waitPillContainer,
              sushiEffectiveUrgency === 'low' && styles.waitPillLow,
              sushiEffectiveUrgency === 'medium' && styles.waitPillMedium,
              sushiEffectiveUrgency === 'high' && styles.waitPillHigh,
            ]}
          >
            {/* Top Row: Left [Icon + Title] & Right [-5m / +5m Steppers] */}
            <View style={styles.waitBannerTopRow}>
              <View style={styles.waitBannerTopLeft}>
                {sushiEffectiveUrgency === 'high' ? (
                  <Flame size={15} color="#DC2626" strokeWidth={2.4} />
                ) : sushiEffectiveUrgency === 'medium' ? (
                  <Clock size={15} color="#B45309" strokeWidth={2.4} />
                ) : (
                  <Zap size={15} color="#15803D" strokeWidth={2.4} />
                )}

                <Text
                  style={[
                    styles.waitBannerTitleText,
                    sushiEffectiveUrgency === 'low' && styles.waitTextLow,
                    sushiEffectiveUrgency === 'medium' && styles.waitTextMedium,
                    sushiEffectiveUrgency === 'high' && styles.waitTextHigh,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                >
                  Sushi:{' '}
                  <Text style={styles.waitBoldText}>
                    {sushiQueueEstimate.totalMinutes <= 0
                      ? 'No wait • Immediate'
                      : sushiQueueEstimate.formattedRange}
                  </Text>
                </Text>
              </View>

              {/* Right: Quick -5m / +5m Stepper Buttons */}
              <View style={styles.waitStepperGroup}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={sushiQueueEstimate.totalMinutes <= 0}
                  onPress={() => handleAdjustSushiWait(-5)}
                  style={[
                    styles.stepperBtn,
                    sushiQueueEstimate.totalMinutes <= 0 && styles.stepperBtnDisabled,
                  ]}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityLabel="Decrease sushi wait estimate by 5 minutes"
                >
                  <Minus
                    size={9}
                    color={sushiQueueEstimate.totalMinutes <= 0 ? COLORS.natural : COLORS.forestGreen}
                    strokeWidth={2.8}
                  />
                  <Text
                    style={[
                      styles.stepperBtnText,
                      sushiQueueEstimate.totalMinutes <= 0 && styles.stepperBtnTextDisabled,
                    ]}
                  >
                    5m
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleAdjustSushiWait(5)}
                  style={styles.stepperBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityLabel="Increase sushi wait estimate by 5 minutes"
                >
                  <Plus size={9} color={COLORS.forestGreen} strokeWidth={2.8} />
                  <Text style={styles.stepperBtnText}>5m</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Row: Full-width Subtitle */}
            <View style={styles.waitBannerBottomRow}>
              <Text
                style={[
                  styles.waitBannerSubtitleText,
                  sushiEffectiveUrgency === 'low' && styles.waitSubtextLow,
                  sushiEffectiveUrgency === 'medium' && styles.waitSubtextMedium,
                  sushiEffectiveUrgency === 'high' && styles.waitSubtextHigh,
                ]}
                numberOfLines={1}
              >
                {`${sushiQueueEstimate.pendingSushiCount} sushi in queue`}
                {sushiManualOffsetMins !== 0 && (
                  <Text
                    onPress={() => handleAdjustSushiWait(-sushiManualOffsetMins)}
                    style={styles.offsetBadgeText}
                  >
                    {` • ${sushiManualOffsetMins > 0 ? `+${sushiManualOffsetMins}m` : `${sushiManualOffsetMins}m`} manual`}
                  </Text>
                )}
                {currentCartSushiCount > 0 && sushiCartEstimate && (
                  <Text style={styles.waitCartAddonText}>
                    {` • With cart: ${sushiCartEstimate.compactRange === 'Immediate' ? 'Immediate' : `~${sushiCartEstimate.compactRange}`}`}
                  </Text>
                )}
              </Text>
            </View>
          </View>

          {/* 2. Kitchen Wait Banner */}
          <View
            style={[
              styles.waitPillContainer,
              kitchenEffectiveUrgency === 'low' && styles.waitPillLow,
              kitchenEffectiveUrgency === 'medium' && styles.waitPillMedium,
              kitchenEffectiveUrgency === 'high' && styles.waitPillHigh,
            ]}
          >
            {/* Top Row: Left [Icon + Title] & Right [-5m / +5m Steppers] */}
            <View style={styles.waitBannerTopRow}>
              <View style={styles.waitBannerTopLeft}>
                {kitchenEffectiveUrgency === 'high' ? (
                  <Flame size={15} color="#DC2626" strokeWidth={2.4} />
                ) : kitchenEffectiveUrgency === 'medium' ? (
                  <Clock size={15} color="#B45309" strokeWidth={2.4} />
                ) : (
                  <Zap size={15} color="#15803D" strokeWidth={2.4} />
                )}

                <Text
                  style={[
                    styles.waitBannerTitleText,
                    kitchenEffectiveUrgency === 'low' && styles.waitTextLow,
                    kitchenEffectiveUrgency === 'medium' && styles.waitTextMedium,
                    kitchenEffectiveUrgency === 'high' && styles.waitTextHigh,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                >
                  Kitchen:{' '}
                  <Text style={styles.waitBoldText}>
                    {kitchenQueueEstimate.totalMinutes <= 0
                      ? 'No wait • Immediate'
                      : kitchenQueueEstimate.formattedRange}
                  </Text>
                </Text>
              </View>

              {/* Right: Quick -5m / +5m Stepper Buttons */}
              <View style={styles.waitStepperGroup}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={kitchenQueueEstimate.totalMinutes <= 0}
                  onPress={() => handleAdjustKitchenWait(-5)}
                  style={[
                    styles.stepperBtn,
                    kitchenQueueEstimate.totalMinutes <= 0 && styles.stepperBtnDisabled,
                  ]}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityLabel="Decrease kitchen wait estimate by 5 minutes"
                >
                  <Minus
                    size={9}
                    color={kitchenQueueEstimate.totalMinutes <= 0 ? COLORS.natural : COLORS.forestGreen}
                    strokeWidth={2.8}
                  />
                  <Text
                    style={[
                      styles.stepperBtnText,
                      kitchenQueueEstimate.totalMinutes <= 0 && styles.stepperBtnTextDisabled,
                    ]}
                  >
                    5m
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleAdjustKitchenWait(5)}
                  style={styles.stepperBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityLabel="Increase kitchen wait estimate by 5 minutes"
                >
                  <Plus size={9} color={COLORS.forestGreen} strokeWidth={2.8} />
                  <Text style={styles.stepperBtnText}>5m</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Row: Full-width Subtitle */}
            <View style={styles.waitBannerBottomRow}>
              <Text
                style={[
                  styles.waitBannerSubtitleText,
                  kitchenEffectiveUrgency === 'low' && styles.waitSubtextLow,
                  kitchenEffectiveUrgency === 'medium' && styles.waitSubtextMedium,
                  kitchenEffectiveUrgency === 'high' && styles.waitSubtextHigh,
                ]}
                numberOfLines={1}
              >
                {`${kitchenQueueEstimate.pendingKitchenCount} dish${kitchenQueueEstimate.pendingKitchenCount === 1 ? '' : 'es'} in queue`}
                {kitchenManualOffsetMins !== 0 && (
                  <Text
                    onPress={() => handleAdjustKitchenWait(-kitchenManualOffsetMins)}
                    style={styles.offsetBadgeText}
                  >
                    {` • ${kitchenManualOffsetMins > 0 ? `+${kitchenManualOffsetMins}m` : `${kitchenManualOffsetMins}m`} manual`}
                  </Text>
                )}
                {currentCartKitchenCount > 0 && kitchenCartEstimate && (
                  <Text style={styles.waitCartAddonText}>
                    {` • With cart: ${kitchenCartEstimate.compactRange === 'Immediate' ? 'Immediate' : `~${kitchenCartEstimate.compactRange}`}`}
                  </Text>
                )}
              </Text>
            </View>
          </View>
        </View>
      </View>

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
  // Live Wait Estimator Banners (Sushi & Kitchen)
  waitPillOuterContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 4,
    paddingBottom: 2,
  },
  waitBannersStack: {
    gap: 5,
  },
  waitPillContainer: {
    borderRadius: 10,
    borderWidth: 1.2,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  waitPillLow: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  waitPillMedium: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  waitPillHigh: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  waitBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  waitBannerTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    marginRight: 6,
  },
  waitBannerTitleText: {
    fontSize: 14,
    ...FONTS.bold,
    letterSpacing: 0.1,
    flex: 1,
  },
  waitTextLow: {
    color: '#15803D',
  },
  waitTextMedium: {
    color: '#B45309',
  },
  waitTextHigh: {
    color: '#DC2626',
  },
  waitSubtextLow: {
    color: '#166534',
  },
  waitSubtextMedium: {
    color: '#92400E',
  },
  waitSubtextHigh: {
    color: '#991B1B',
  },
  waitBoldText: {
    ...FONTS.heavy,
  },
  waitBannerBottomRow: {
    width: '100%',
    marginTop: 2,
  },
  waitBannerSubtitleText: {
    fontSize: 11.5,
    ...FONTS.medium,
    width: '100%',
  },
  waitCartAddonText: {
    ...FONTS.bold,
    textDecorationLine: 'underline',
  },
  offsetBadgeText: {
    fontSize: 10.5,
    ...FONTS.medium,
    color: COLORS.natural,
    textDecorationLine: 'underline',
  },
  waitStepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  stepperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 5,
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 2,
  },
  stepperBtnDisabled: {
    opacity: 0.35,
    backgroundColor: COLORS.surfaceMuted,
  },
  stepperBtnText: {
    fontSize: 11,
    ...FONTS.bold,
    color: COLORS.forestGreen,
  },
  stepperBtnTextDisabled: {
    color: COLORS.natural,
  },
});
