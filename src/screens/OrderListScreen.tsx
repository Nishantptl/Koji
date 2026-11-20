import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import {
  Trash2,
  Clock,
  User,
  Phone,
  FileText,
  Receipt,
  Search,
  Sparkles,
  Check,
  X,
  CheckCircle2,
  Edit3,
  Printer,
  MessageCircle,
  Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Order, CartItem, DailyMetrics, ItemStatus, PaymentMethod } from '../types';
import { BrandHeader } from '../components/BrandHeader';
import { TokenBadge } from '../components/TokenBadge';
import { VegBadge } from '../components/VegBadge';
import { EditOrderModal } from '../components/EditOrderModal';
import { PaymentModal } from '../components/PaymentModal';
import { PrintOrderModal } from '../components/PrintOrderModal';
import { printAddonStationKots } from '../services/printService';
import {
  sendDishReadyNotification,
  sendOrderReadyNotification,
  sendAddonReadyNotification,
} from '../services/whatsappService';
import {
  getOrders,
  getDailyMetrics,
  updateOrderStatus,
  updateOrderItemStatus,
  incrementItemServedQuantity,
  updateOrderPayment,
  updateOrderItems,
  markOrderItemNotified,
  markOrderNotified,
  markSpecificItemsNotified,
  clearTodayOrders,
  formatTime,
  formatDate,
  formatDateClean,
  isOrderFromToday,
} from '../services/storage';
import { COLORS, FONTS, SPACING } from '../constants/theme';

type TimelineFilter = 'active' | 'all';

interface OrderListScreenProps {
  refreshTrigger?: number;
  onNavigateToPOS?: () => void;
  onOrdersChanged?: () => void;
}

export const OrderListScreen: React.FC<OrderListScreenProps> = ({
  refreshTrigger,
  onNavigateToPOS,
  onOrdersChanged,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<DailyMetrics>({
    totalOrders: 0,
    totalRevenue: 0,
    activeOrders: 0,
    completedOrders: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('active');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [fetchedOrders, dailyMetrics] = await Promise.all([
        getOrders(),
        getDailyMetrics(),
      ]);
      setOrders(fetchedOrders);
      setMetrics(dailyMetrics);
    } catch (err) {
      console.warn('Failed to load orders:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getOrders(), getDailyMetrics()])
      .then(([fetchedOrders, dailyMetrics]) => {
        if (isMounted) {
          setOrders(fetchedOrders);
          setMetrics(dailyMetrics);
        }
      })
      .catch((err) => {
        console.warn('Failed to load orders:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }
    await loadData();
    setIsRefreshing(false);
  };

  // Mark full order done
  const handleMarkOrderDone = async (orderId: string) => {
    try {
      const updated = await updateOrderStatus(orderId, 'completed');
      setOrders(updated);
      const newMetrics = await getDailyMetrics();
      setMetrics(newMetrics);
      onOrdersChanged?.();
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not update order status.');
    }
  };

  // Item-level Done / Cancel controls
  const handleItemStatusChange = async (
    orderId: string,
    itemIndex: number,
    status: ItemStatus
  ) => {
    try {
      const updated = await updateOrderItemStatus(orderId, itemIndex, status);
      setOrders(updated);
      const newMetrics = await getDailyMetrics();
      setMetrics(newMetrics);
      onOrdersChanged?.();
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not update item status.');
    }
  };

  // Item-level progressive serving counter (0/3 -> 1/3 -> 2/3 -> 3/3 Done)
  const handleIncrementServed = async (orderId: string, itemIndex: number) => {
    try {
      const updated = await incrementItemServedQuantity(orderId, itemIndex);
      setOrders(updated);
      const newMetrics = await getDailyMetrics();
      setMetrics(newMetrics);
      onOrdersChanged?.();
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not update served count.');
    }
  };

  // Payment status update (Cash or UPI, supporting split payments)
  const handlePaymentCompleted = async (
    orderId: string,
    method: PaymentMethod,
    amount?: number
  ) => {
    try {
      const updated = await updateOrderPayment(
        orderId,
        method === 'Cash' ? 'Cash' : 'UPI',
        amount
      );
      setOrders(updated);
      onOrdersChanged?.();
    } catch (err: any) {
      Alert.alert('Payment Update Failed', err?.message || 'Could not update payment status.');
    }
  };

  // WhatsApp Pickup Notification: Option A (Single dish ready alert)
  const handleNotifyDishReady = async (
    order: Order,
    cartItem: CartItem,
    itemIdx: number
  ) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const sent = await sendDishReadyNotification(order, cartItem);
    if (sent) {
      try {
        const updatedOrders = await markOrderItemNotified(
          order.id,
          cartItem.id,
          itemIdx
        );
        setOrders(updatedOrders);
        onOrdersChanged?.();
      } catch {}
    }
  };

  // WhatsApp Pickup Notification: Option B & C (Smart Order Ready & Add-on Ready Alert)
  const handleNotifyOrderReady = async (order: Order) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const activeItems = order.items.filter(
      (i) => i.status !== 'cancelled' && i.quantity > 0
    );
    const unnotifiedItems = activeItems.filter((i) => !i.notified);

    // If zero unnotified items remain, prompt to resend full notification
    if (unnotifiedItems.length === 0) {
      Alert.alert(
        'Order Already Notified',
        `A pickup alert was already sent for Token ${order.token}. Would you like to send it again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Again',
            onPress: async () => {
              const sent = await sendOrderReadyNotification(order);
              if (sent) {
                const updatedOrders = await markOrderNotified(order.id);
                setOrders(updatedOrders);
                onOrdersChanged?.();
              }
            },
          },
        ]
      );
      return;
    }

    // First time notifying whole order -> Send standard full order message
    if (unnotifiedItems.length === activeItems.length) {
      const sent = await sendOrderReadyNotification(order);
      if (sent) {
        try {
          const updatedOrders = await markOrderNotified(order.id);
          setOrders(updatedOrders);
          onOrdersChanged?.();
        } catch {}
      }
      return;
    }

    // Some items were previously notified and new add-ons were added!
    // Send specific add-on pickup message listing ONLY the newly unnotified items
    const sent = await sendAddonReadyNotification(order, unnotifiedItems);
    if (sent) {
      try {
        const unnotifiedIds = unnotifiedItems.map((i) => i.id);
        const updatedOrders = await markSpecificItemsNotified(order.id, unnotifiedIds);
        setOrders(updatedOrders);
        onOrdersChanged?.();
      } catch {}
    }
  };

  // Save live editing of ticket items & trigger incremental KOT add-on printing
  const handleSaveOrderItems = async (orderId: string, updatedItems: CartItem[]) => {
    try {
      const targetOrder = orders.find((o) => o.id === orderId);

      // Find newly added unprinted add-ons (isAddon === true && !isPrinted)
      const unprintedAddons = updatedItems.filter(
        (i) => i.isAddon && !i.isPrinted && i.status !== 'cancelled' && i.quantity > 0
      );

      let itemsToPersist = updatedItems;

      if (unprintedAddons.length > 0 && targetOrder) {
        // Dispatch KOT print ONLY for the newly added unprinted add-on items
        const printed = await printAddonStationKots(targetOrder, unprintedAddons);
        if (printed) {
          const nowIso = new Date().toISOString();
          // Mark newly printed items as isPrinted: true upon dispatching the intent
          itemsToPersist = updatedItems.map((item) =>
            unprintedAddons.some((addon) => addon.id === item.id)
              ? { ...item, isPrinted: true, printedAt: item.printedAt || nowIso }
              : item
          );
        }
      }

      const updated = await updateOrderItems(orderId, itemsToPersist);
      setOrders(updated);
      const newMetrics = await getDailyMetrics();
      setMetrics(newMetrics);
      onOrdersChanged?.();
    } catch (err: any) {
      Alert.alert('Edit Failed', err?.message || 'Could not save order changes.');
    }
  };

  // Strictly filter to the current calendar day for the shift Timeline
  const todayOrders = useMemo(() => {
    return orders.filter((o) => isOrderFromToday(o.timestamp));
  }, [orders]);

  const activeOrdersCount = useMemo(() => {
    return todayOrders.filter((o) => o.status === 'preparing').length;
  }, [todayOrders]);

  const allTodayOrdersCount = useMemo(() => {
    return todayOrders.length;
  }, [todayOrders]);

  // Filtered orders by tab ('active' vs 'all') and search query, strictly within today's shift
  const filteredOrders = useMemo(() => {
    let list = todayOrders;

    if (timelineFilter === 'active') {
      list = list.filter((order) => order.status === 'preparing');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((order) => {
        const tokenMatch = order.token.toLowerCase().includes(q);
        const nameMatch = order.customerName?.toLowerCase().includes(q) || false;
        const phoneMatch = order.customerPhone?.toLowerCase().includes(q) || false;
        const itemMatch = order.items.some((i) =>
          i.name.toLowerCase().includes(q)
        );
        return tokenMatch || nameMatch || phoneMatch || itemMatch;
      });
    }

    return list;
  }, [todayOrders, timelineFilter, searchQuery]);

  const handleClearTodayOrders = () => {
    if (todayOrders.length === 0) {
      Alert.alert('No Orders', "There are no orders recorded in today's shift.");
      return;
    }

    Alert.alert(
      "Reset Today's Shift?",
      "Delete all of today's shift orders? Past days' order history in Admin will not be affected.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Delete Today's Orders",
          style: 'destructive',
          onPress: async () => {
            await clearTodayOrders();
            await loadData();
            onOrdersChanged?.();
            Alert.alert('Shift Reset', "Today's shift orders have been cleared.");
          },
        },
      ]
    );
  };

  // Order item card renderer
  const renderOrderCard = ({ item }: { item: Order }) => {
    const isToday = isOrderFromToday(item.timestamp);
    const timeStr = formatTime(item.timestamp);
    const dateStr = formatDate(item.timestamp);
    const isPreparing = item.status === 'preparing';

    const balanceDue = typeof item.balanceDue === 'number'
      ? item.balanceDue
      : (item.paymentStatus === 'Completed' ? 0 : item.totalAmount);
    const amountPaid = typeof item.amountPaid === 'number'
      ? item.amountPaid
      : (item.paymentStatus === 'Completed' ? item.totalAmount : 0);
    const isPaid = item.paymentStatus === 'Completed' || balanceDue <= 0;
    const isPartial = item.paymentStatus === 'Partial' || (amountPaid > 0 && balanceDue > 0);

    return (
      <View style={[styles.orderCard, isPreparing && styles.orderCardActive]}>
        {/* Header Row: Token Badge, Time & Date, Total */}
        <View style={styles.cardHeader}>
          {/* Left: Token Pill (#09) and Time (4:13 PM) */}
          <View style={styles.cardHeaderLeft}>
            <TokenBadge token={item.token} variant="apricot" size="lg" />
            <View style={styles.timeRow}>
              <Clock size={13} color={COLORS.textSecondary} />
              <Text style={styles.timeText}>{timeStr}</Text>
              {!isToday && <Text style={styles.dateText}>• {dateStr}</Text>}
            </View>
          </View>

          {/* Right: Print Button and Total Amount */}
          <View style={styles.cardHeaderRight}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setPrintingOrder(item)}
              style={styles.printCardBtn}
              accessibilityLabel="Print order KOT or receipt"
            >
              <Printer size={13} color={COLORS.forestGreen} strokeWidth={2.2} />
              <Text style={styles.printCardBtnText}>Print</Text>
            </TouchableOpacity>
            <View style={styles.amountCol}>
              <Text style={styles.amountText}>₹{item.totalAmount}</Text>
              {isPartial && balanceDue > 0 && (
                <Text style={styles.amountSubDueText}>Due: ₹{balanceDue}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Status Bar Row: [ ✎ Edit Order ] [ Payment Pill ] [ Order Status ] */}
        <View style={styles.statusBarRow}>
          <View style={styles.actionBarGroup}>
            {/* 1. Edit Order */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setEditingOrder(item)}
              style={styles.actionBtnEdit}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Edit3 size={12} color={COLORS.organic} strokeWidth={2.2} />
              <Text
                style={styles.actionBtnEditText}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                Edit Order
              </Text>
            </TouchableOpacity>

            {/* 2. Payment Pill (Streamlined "Payment" / "✓ UPI" / "✓ Cash") */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPayingOrder(item)}
              style={[
                styles.actionBtnPayment,
                isPaid ? styles.paymentPillCompleted : styles.paymentPillPending,
              ]}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              {!isPaid && (
                <Wallet size={12} color="#B86815" strokeWidth={2.4} />
              )}
              <Text
                style={[
                  styles.actionBtnPaymentText,
                  isPaid
                    ? styles.paymentPillTextCompleted
                    : styles.paymentPillTextPending,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                {isPaid
                  ? item.paymentMethod === 'UPI + Cash' ||
                    (Array.isArray(item.payments) &&
                      item.payments.some((p) => p.method === 'UPI' && p.amount > 0) &&
                      item.payments.some((p) => p.method === 'Cash' && p.amount > 0))
                    ? '✓ UPI + Cash'
                    : item.paymentMethod === 'Cash' ||
                      (Array.isArray(item.payments) &&
                        item.payments.some((p) => p.method === 'Cash' && p.amount > 0) &&
                        !item.payments.some((p) => p.method === 'UPI' && p.amount > 0))
                    ? '✓ Cash'
                    : '✓ UPI'
                  : 'Payment'}
              </Text>
            </TouchableOpacity>

            {/* 3. Order Status */}
            {isPreparing ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleMarkOrderDone(item.id)}
                style={styles.actionBtnDone}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              >
                <Check size={13} color={COLORS.ivory} strokeWidth={2.8} />
                <Text
                  style={styles.actionBtnDoneText}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                >
                  Mark Done ✓
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionBtnCompletedBadge}>
                <CheckCircle2 size={12} color={COLORS.veg} strokeWidth={2.4} />
                <Text
                  style={styles.actionBtnCompletedText}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                >
                  {item.completedAt ? `Done ${formatTime(item.completedAt)}` : 'Completed'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Customer Details Row (clean text with direct phone linking & WhatsApp Notify Ready) */}
        {(item.customerName || item.customerPhone) && (
          <View style={styles.customerRow}>
            <View style={styles.customerInfoGroup}>
              {item.customerName && (
                <View style={styles.customerDetail}>
                  <User size={13} color={COLORS.organic} />
                  <Text style={styles.customerDetailText}>{item.customerName}</Text>
                </View>
              )}
              {item.customerPhone && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    const cleanPhone = item.customerPhone?.replace(/[^0-9+]/g, '');
                    if (cleanPhone) {
                      Linking.openURL(`tel:${cleanPhone}`).catch(() => {
                        Alert.alert('Unable to Call', 'Could not open phone dialer on this device.');
                      });
                    }
                  }}
                  style={styles.customerDetail}
                >
                  <Phone size={13} color={COLORS.organic} />
                  <Text style={styles.customerDetailText}>{item.customerPhone}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Option B: Whole Order WhatsApp Notify Ready Button */}
            {item.customerPhone ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => handleNotifyOrderReady(item)}
                style={[
                  styles.notifyOrderPill,
                  item.notified && styles.notifyOrderPillNotified,
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Send complete order ready alert via WhatsApp"
              >
                {item.notified ? (
                  <>
                    <Check size={11} color="#25D366" strokeWidth={2.8} />
                    <Text style={styles.notifyOrderPillTextNotified}>Notified</Text>
                  </>
                ) : (
                  <>
                    <MessageCircle size={11} color="#128C7E" strokeWidth={2.4} />
                    <Text style={styles.notifyOrderPillText}>Notify Ready</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Items List with Incremental Dish Serving / Progress Counter */}
        <View style={styles.itemsContainer}>
          {item.items.map((cartItem, idx) => {
            const isItemCancelled = cartItem.status === 'cancelled';
            const isItemDone =
              cartItem.status === 'completed' ||
              (cartItem.servedQuantity ?? 0) >= cartItem.quantity;
            const servedCount =
              typeof cartItem.servedQuantity === 'number'
                ? cartItem.servedQuantity
                : (isItemDone ? cartItem.quantity : 0);

            const isAddonItem = Boolean(cartItem.isAddon || cartItem.addedAt);
            const prevItem = idx > 0 ? item.items[idx - 1] : null;
            const prevIsAddon = Boolean(prevItem?.isAddon || prevItem?.addedAt);
            const showAddonDivider = Boolean(
              isAddonItem &&
                (!prevIsAddon ||
                  (cartItem.addedAt &&
                    prevItem?.addedAt &&
                    formatTime(prevItem.addedAt) !== formatTime(cartItem.addedAt)))
            );

            return (
              <React.Fragment key={`${cartItem.id}_${idx}`}>
                {showAddonDivider && (
                  <View style={styles.addonDividerContainer}>
                    <View style={styles.addonDividerLine} />
                    <View style={styles.addonPill}>
                      <Text style={styles.addonPillText}>
                        ── Added Items ({formatTime(cartItem.addedAt || item.timestamp)}) ──
                      </Text>
                    </View>
                    <View style={styles.addonDividerLine} />
                  </View>
                )}

                <View
                  style={[
                    styles.itemRow,
                    isItemCancelled && styles.itemRowCancelled,
                  ]}
                >
                  <View style={styles.itemLeft}>
                    <VegBadge isVeg={cartItem.isVeg} size={15} />
                    <Text
                      style={[
                        styles.multiplierText,
                        isItemCancelled && styles.textLineThrough,
                      ]}
                    >
                      {cartItem.quantity}x
                    </Text>
                    <Text
                      style={[
                        styles.itemNameText,
                        isItemCancelled && styles.textLineThrough,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.88}
                    >
                      {cartItem.name}
                    </Text>
                  </View>

                  {/* Right: Compact Progressive Done Counter, Item Cancellation & WhatsApp Alert */}
                  <View style={styles.itemRightActions}>
                    <View style={styles.itemStatusButtonGroup}>
                      {isItemCancelled ? (
                        <View style={styles.itemCancelledBadge}>
                          <Text style={styles.itemCancelledBadgeText}>Cancelled</Text>
                        </View>
                      ) : isItemDone ? (
                        <View style={styles.itemDoneBadge}>
                          <Check size={10} color={COLORS.veg} strokeWidth={2.8} />
                          <Text style={styles.itemDoneBadgeText}>
                            {cartItem.quantity}/{cartItem.quantity} Done
                          </Text>
                        </View>
                      ) : (
                        <>
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => handleIncrementServed(item.id, idx)}
                            style={styles.itemProgressBtn}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          >
                            <Check size={10} color={COLORS.veg} strokeWidth={2.6} />
                            <Text style={styles.itemProgressText}>
                              {servedCount}/{cartItem.quantity} Done
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() =>
                              handleItemStatusChange(item.id, idx, 'cancelled')
                            }
                            style={styles.itemCancelActionBtn}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          >
                            <X size={10} color={COLORS.danger} strokeWidth={2.8} />
                            <Text style={styles.itemCancelActionText}>Cancel</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Option A: WhatsApp Single Dish Ready Alert Button */}
                      {!isItemCancelled && item.customerPhone ? (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleNotifyDishReady(item, cartItem, idx)}
                          style={[
                            styles.itemWhatsappBtn,
                            cartItem.notified && styles.itemWhatsappBtnNotified,
                          ]}
                          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          accessibilityLabel="Send WhatsApp pickup alert for this dish"
                        >
                          <MessageCircle
                            size={12}
                            color={cartItem.notified ? '#25D366' : COLORS.forestGreen}
                            strokeWidth={2.4}
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Cooking Notes Callout (if present) */}
        {item.notes ? (
          <View style={styles.notesCallout}>
            <FileText size={13} color={COLORS.organic} style={styles.noteIcon} />
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Brand Header with Logo Asset */}
      <BrandHeader
        subtitle="Shift Order Timeline"
        rightElement={
          todayOrders.length > 0 ? (
            <TouchableOpacity
              onPress={handleClearTodayOrders}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearHistoryButton}
              accessibilityLabel="Reset shift orders"
            >
              <Trash2 size={16} color={COLORS.danger} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Daily Metrics Summary Card */}
      <View style={styles.metricsCard}>
        <View style={styles.metricsHeaderRow}>
          <Text style={styles.metricsShiftTitle}>Today&apos;s Shift</Text>
          <Text style={styles.metricsDateText}>{formatDateClean()}</Text>
        </View>

        <View style={styles.metricsValuesRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Orders</Text>
            <Text style={styles.metricNumber}>{metrics.totalOrders}</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>In Kitchen</Text>
            <Text style={[styles.metricNumber, { color: COLORS.apricot }]}>
              {metrics.activeOrders}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Shift Revenue</Text>
            <Text style={styles.metricNumberHighlight}>₹{metrics.totalRevenue}</Text>
          </View>
        </View>
      </View>

      {/* Top Filter Tabs: "Active Orders" vs "All Orders" (Strictly Current Day) */}
      <View style={styles.timelineTabsWrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            try {
              Haptics.selectionAsync();
            } catch {
              // Ignore
            }
            setTimelineFilter('active');
          }}
          style={[
            styles.timelineTab,
            timelineFilter === 'active' && styles.timelineTabActive,
          ]}
        >
          <Text
            style={[
              styles.timelineTabText,
              timelineFilter === 'active' && styles.timelineTabTextActive,
            ]}
          >
            Active Orders ({activeOrdersCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            try {
              Haptics.selectionAsync();
            } catch {
              // Ignore
            }
            setTimelineFilter('all');
          }}
          style={[
            styles.timelineTab,
            timelineFilter === 'all' && styles.timelineTabActive,
          ]}
        >
          <Text
            style={[
              styles.timelineTabText,
              timelineFilter === 'all' && styles.timelineTabTextActive,
            ]}
          >
            All Orders ({allTodayOrdersCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar (if today orders exist) */}
      {todayOrders.length > 0 && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.natural} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by token (#01), name, or dish..."
              placeholderTextColor={COLORS.natural}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      )}

      {/* Orders Timeline */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderCard}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.organic}
            colors={[COLORS.organic, COLORS.apricot]}
          />
        }
        contentContainerStyle={[
          styles.listContainer,
          filteredOrders.length === 0 && styles.listContainerEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Receipt size={36} color={COLORS.natural} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery
                ? 'No matching orders found'
                : timelineFilter === 'active'
                ? 'No active orders in kitchen! 🎉'
                : 'No orders recorded yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term or clear the filter.'
                : timelineFilter === 'active'
                ? 'All taken orders are completed. Tap "All Orders" to view full shift history.'
                : 'Orders taken at the POS station will appear here in chronological order.'}
            </Text>

            {!searchQuery && timelineFilter === 'active' && todayOrders.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setTimelineFilter('all')}
                style={styles.emptyActionButton}
              >
                <Text style={styles.emptyActionButtonText}>View All Shift Orders</Text>
              </TouchableOpacity>
            )}

            {!searchQuery && todayOrders.length === 0 && onNavigateToPOS && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onNavigateToPOS}
                style={styles.emptyActionButton}
              >
                <Sparkles size={16} color={COLORS.ivory} />
                <Text style={styles.emptyActionButtonText}>Take First Order</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Live Order Editing Modal */}
      <EditOrderModal
        visible={!!editingOrder}
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onSave={handleSaveOrderItems}
      />

      {/* Payment Processing Modal (UPI / Cash) */}
      <PaymentModal
        visible={!!payingOrder}
        order={payingOrder}
        onClose={() => setPayingOrder(null)}
        onPaymentCompleted={handlePaymentCompleted}
      />

      {/* Print KOTs / Customer Receipt Modal */}
      <PrintOrderModal
        visible={!!printingOrder}
        order={printingOrder}
        onClose={() => setPrintingOrder(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  metricsCard: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  metricsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  metricsShiftTitle: {
    fontSize: 15,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  metricsDateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },
  clearHistoryButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.borderLight,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    ...FONTS.medium,
    marginBottom: 2,
  },
  metricNumber: {
    fontSize: 18,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  metricNumberHighlight: {
    fontSize: 18,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  timelineTabsWrapper: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    gap: SPACING.sm,
  },
  timelineTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF7',
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
  },
  timelineTabActive: {
    backgroundColor: COLORS.organic,
    borderColor: COLORS.organic,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  timelineTabText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.semibold,
  },
  timelineTabTextActive: {
    color: COLORS.ivory,
    ...FONTS.bold,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: COLORS.borderLight,
    paddingHorizontal: SPACING.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.organic,
    marginLeft: SPACING.sm,
    ...FONTS.regular,
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  listContainerEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  orderCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardActive: {
    borderColor: COLORS.apricot,
    backgroundColor: '#FFFDF9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeWrapper: {
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    ...FONTS.semibold,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
    ...FONTS.regular,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EDF2EC',
    borderWidth: 1,
    borderColor: '#C2D4C6',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
  },
  printCardBtnText: {
    fontSize: 11.5,
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountSubDueText: {
    fontSize: 10,
    color: COLORS.amber,
    ...FONTS.bold,
    marginTop: -2,
  },
  amountText: {
    fontSize: 18,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  statusBarRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  actionBarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  actionBtnEdit: {
    height: 36,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F5F7F3',
    borderWidth: 1,
    borderColor: '#D4DDD6',
    borderRadius: 8,
  },
  actionBtnEditText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.semibold,
  },
  actionBtnPayment: {
    height: 36,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderWidth: 1.2,
    borderRadius: 8,
  },
  actionBtnPaymentText: {
    fontSize: 12,
    ...FONTS.bold,
  },
  paymentPillCompleted: {
    backgroundColor: '#E2EFE6',
    borderColor: COLORS.forestGreen,
  },
  paymentPillPending: {
    backgroundColor: '#FEF6EB',
    borderColor: '#D78B30',
  },
  paymentPillPartial: {
    backgroundColor: '#FEF6EB',
    borderColor: '#D78B30',
  },
  paymentPillTextCompleted: {
    color: COLORS.forestGreen,
  },
  paymentPillTextPending: {
    color: '#B86815',
  },
  paymentPillTextPartial: {
    color: '#B86815',
  },
  actionBtnDone: {
    height: 36,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.organic,
    borderRadius: 8,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  actionBtnDoneText: {
    fontSize: 12,
    color: COLORS.ivory,
    ...FONTS.bold,
  },
  actionBtnCompletedBadge: {
    height: 36,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 8,
  },
  actionBtnCompletedText: {
    fontSize: 12,
    color: COLORS.veg,
    ...FONTS.bold,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  customerInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    flex: 1,
  },
  notifyOrderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
  },
  notifyOrderPillNotified: {
    backgroundColor: '#DCF8C6',
    borderColor: '#25D366',
  },
  notifyOrderPillText: {
    fontSize: 10.5,
    color: '#128C7E',
    ...FONTS.bold,
  },
  notifyOrderPillTextNotified: {
    fontSize: 10.5,
    color: '#25D366',
    ...FONTS.bold,
  },
  customerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customerDetailText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  itemsContainer: {
    paddingTop: SPACING.sm,
    paddingBottom: 2,
  },
  addonDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 2,
  },
  addonDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  addonPill: {
    backgroundColor: '#FAF2DE',
    borderColor: COLORS.apricot,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginHorizontal: 8,
  },
  addonPillText: {
    fontSize: 10,
    color: COLORS.organic,
    ...FONTS.bold,
    letterSpacing: 0.3,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  itemRowCancelled: {
    opacity: 0.45,
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  multiplierText: {
    width: 22,
    fontSize: 12.5,
    color: COLORS.apricot,
    ...FONTS.heavy,
  },
  itemNameText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  textLineThrough: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  itemRightActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  itemStatusButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemWhatsappBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#EDF2EC',
    borderWidth: 1,
    borderColor: '#C2D4C6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemWhatsappBtnNotified: {
    backgroundColor: '#DCF8C6',
    borderColor: '#25D366',
  },
  itemProgressBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemProgressText: {
    fontSize: 10.5,
    color: COLORS.veg,
    ...FONTS.bold,
  },
  itemCancelActionBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemCancelActionText: {
    fontSize: 10,
    color: COLORS.danger,
    ...FONTS.bold,
  },
  itemDoneBadge: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemDoneBadgeText: {
    fontSize: 10.5,
    color: COLORS.veg,
    ...FONTS.bold,
  },
  itemCancelledBadge: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemCancelledBadgeText: {
    fontSize: 10,
    color: COLORS.danger,
    ...FONTS.bold,
  },
  notesCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF3E3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E8D2AA',
  },
  noteIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  notesText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.regular,
    flex: 1,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 16,
    color: COLORS.organic,
    ...FONTS.bold,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    ...FONTS.regular,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.organic,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: SPACING.lg,
  },
  emptyActionButtonText: {
    fontSize: 13,
    color: COLORS.ivory,
    ...FONTS.bold,
  },
});
