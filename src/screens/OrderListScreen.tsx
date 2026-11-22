import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  AppState,
} from 'react-native';
import {
  Trash2,
  Receipt,
  Search,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Order, CartItem, DailyMetrics, ItemStatus, PaymentMethod } from '../types';
import { BrandHeader } from '../components/BrandHeader';
import { OrderTicketCard } from '../components/OrderTicketCard';
import { EditOrderModal } from '../components/EditOrderModal';
import { PaymentModal } from '../components/PaymentModal';
import { PrintOrderModal } from '../components/PrintOrderModal';
import { KojiConfirmModal, KojiConfirmModalProps } from '../components/KojiConfirmModal';
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
  formatDateClean,
  isOrderFromToday,
  isOrderUnpaid,
  recalculateOrderTotal,
} from '../services/storage';
import { COLORS, FONTS, SPACING } from '../constants/theme';

type TimelineFilter = 'active' | 'all' | 'unpaid';

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
  // Operational safeguard: Prevent screen dimming/sleeping during active kitchen timeline shift
  useKeepAwake();

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
  const [markDoneAfterPaymentId, setMarkDoneAfterPaymentId] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [pendingCompletionOrder, setPendingCompletionOrder] = useState<Order | null>(null);
  const [pendingDishIncrement, setPendingDishIncrement] = useState<{ orderId: string; itemIndex: number } | null>(null);
  const [pendingDishIncrementAfterPayment, setPendingDishIncrementAfterPayment] = useState<{ orderId: string; itemIndex: number } | null>(null);
  const [confirmModal, setConfirmModal] = useState<KojiConfirmModalProps | null>(null);

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

  // Midnight rollover / AppState listener: Refresh shift timeline & metrics when returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadData();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [loadData]);

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

  // Helper to commit marking an order completed
  const markOrderDoneAction = async (orderId: string) => {
    try {
      const updated = await updateOrderStatus(orderId, 'completed');
      setOrders(updated);
      const newMetrics = await getDailyMetrics();
      setMetrics(newMetrics);
      onOrdersChanged?.();
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Update Failed',
        title: 'Update Failed',
        message: err?.message || 'Could not update order status.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    }
  };

  // Mark full order done with unpaid rush safeguard
  const handleMarkOrderDone = async (order: Order) => {
    const dueAmount = Math.max(0, order.totalAmount - (order.paidAmount || order.amountPaid || 0));
    const isPaid = Boolean(order.isPaid ?? (order.paymentStatus === 'Completed' && dueAmount === 0));

    // If unpaid or due amount > 0, do not mark done; open KojiConfirmModal safeguard
    if (!isPaid || dueAmount > 0) {
      setPendingCompletionOrder(order);
      return;
    }

    // Only mark done immediately if order is fully paid with zero due balance
    await markOrderDoneAction(order.id);
  };

  // Cancel item confirmation prompt
  const handlePromptCancelItem = (order: Order, itemIndex: number) => {
    const item = order.items[itemIndex];
    const cleanToken = order.token.replace(/^#+/, '');
    const dishSummary = item
      ? `Token #${cleanToken} • ${item.quantity}x ${item.name} (₹${item.price * item.quantity})`
      : `Token #${cleanToken} • Selected Item`;

    setConfirmModal({
      visible: true,
      variant: 'danger',
      badgeLabel: 'Cancel Item',
      title: 'Cancel Dish?',
      message:
        'Are you sure you want to cancel this dish? It will be removed from the kitchen prep queue and bill totals will be updated.',
      highlightText: dishSummary,
      primaryLabel: 'Cancel Item',
      cancelLabel: 'Keep Dish',
      onPrimaryPress: async () => {
        setConfirmModal(null);
        await handleConfirmCancelItem(order, itemIndex);
      },
      onClose: () => setConfirmModal(null),
    });
  };

  // Auto-complete order & trigger unpaid alert when cancelling the last remaining pending dish
  const handleConfirmCancelItem = async (order: Order, itemIndex: number) => {
    try {
      const updatedItems = order.items.map((it, idx) => {
        if (idx === itemIndex) {
          return { ...it, status: 'cancelled' as ItemStatus };
        }
        return it;
      });

      const rawSubtotal = recalculateOrderTotal(updatedItems);
      const discount = Math.min(rawSubtotal, Math.max(0, order.discount || 0));
      const updatedTotalAmount = Math.max(0, rawSubtotal - discount);

      const paidAmount = typeof order.paidAmount === 'number'
        ? order.paidAmount
        : (typeof order.amountPaid === 'number'
          ? order.amountPaid
          : (order.paymentStatus === 'Completed' ? order.totalAmount : 0));

      const updatedDueAmount = Math.max(0, updatedTotalAmount - paidAmount);
      const isPaid = Boolean(order.isPaid ?? (order.paymentStatus === 'Completed' && updatedDueAmount === 0));

      const remainingActiveItems = updatedItems.filter((i) => i.status !== 'cancelled');

      // 1. If all items in the order were cancelled, handle as a cancelled/closed order with ₹0 due
      if (remainingActiveItems.length === 0) {
        await updateOrderItemStatus(order.id, itemIndex, 'cancelled');
        const updated = await updateOrderStatus(order.id, 'completed');
        setOrders(updated);
        const newMetrics = await getDailyMetrics();
        setMetrics(newMetrics);
        onOrdersChanged?.();
        return;
      }

      // Check if all remaining non-cancelled items in the order are now 100% done
      const allRemainingDone = remainingActiveItems.every((i) =>
        i.status === 'completed' ||
        (typeof i.servedQuantity === 'number' && i.servedQuantity >= (i.quantity || 1))
      );

      // 2. If cancelling this item still leaves pending dishes in preparation
      if (!allRemainingDone) {
        const updated = await updateOrderItemStatus(order.id, itemIndex, 'cancelled');
        setOrders(updated);
        const newMetrics = await getDailyMetrics();
        setMetrics(newMetrics);
        onOrdersChanged?.();
        return;
      }

      // 3. Cancelling this item leaves ONLY already-completed dishes (entire order is ready to complete)
      const updatedOrders = await updateOrderItemStatus(order.id, itemIndex, 'cancelled');
      setOrders(updatedOrders);
      const newMetrics = await getDailyMetrics();
      setMetrics(newMetrics);
      onOrdersChanged?.();

      // If updatedDueAmount === 0 (already paid in full or overpaid), auto-complete order immediately
      if (isPaid && updatedDueAmount === 0) {
        await markOrderDoneAction(order.id);
        return;
      }

      // If updatedDueAmount > 0 (!isPaid || updatedDueAmount > 0), trigger Payment Pending KojiConfirmModal
      const refreshedOrder: Order = updatedOrders.find((o) => o.id === order.id) || {
        ...order,
        items: updatedItems,
        totalAmount: updatedTotalAmount,
        balanceDue: updatedDueAmount,
        paidAmount,
        amountPaid: paidAmount,
        isPaid: false,
      };

      setPendingDishIncrement(null);
      setPendingCompletionOrder({
        ...refreshedOrder,
        totalAmount: updatedTotalAmount,
        balanceDue: updatedDueAmount,
        paidAmount,
        amountPaid: paidAmount,
        isPaid: false,
      });
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Action Failed',
        title: 'Action Failed',
        message: err?.message || 'Could not cancel item.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    }
  };

  // Item-level progressive serving counter (0/3 -> 1/3 -> 2/3 -> 3/3 Done)
  const handleIncrementServed = async (order: Order, itemIndex: number) => {
    try {
      const targetItem = order.items[itemIndex];
      if (!targetItem || targetItem.status === 'cancelled') {
        return;
      }

      const totalQty = targetItem.quantity || 1;
      const currentServed = typeof targetItem.servedQuantity === 'number'
        ? targetItem.servedQuantity
        : (targetItem.status === 'completed' ? totalQty : 0);

      // If already fully served, nothing to increment
      if (currentServed >= totalQty) {
        return;
      }

      const nextServed = currentServed + 1;
      const willThisItemBeDone = nextServed >= totalQty;

      // Check whether incrementing this dish will make ALL active (non-cancelled) items 100% done
      const willAllActiveBeDone =
        willThisItemBeDone &&
        order.items.every((item, idx) => {
          if (item.status === 'cancelled') return true;
          if (idx === itemIndex) return true;
          return (
            item.status === 'completed' ||
            (typeof item.servedQuantity === 'number' && item.servedQuantity >= (item.quantity || 1))
          );
        });

      const paidAmount = typeof order.paidAmount === 'number'
        ? order.paidAmount
        : (typeof order.amountPaid === 'number'
          ? order.amountPaid
          : (order.paymentStatus === 'Completed' ? order.totalAmount : 0));
      const dueAmount = Math.max(0, order.totalAmount - paidAmount);
      const isPaid = Boolean(order.isPaid ?? (order.paymentStatus === 'Completed' && dueAmount === 0));

      // Edge case 1: If this tap finishes the final remaining dish AND (!isPaid || dueAmount > 0)
      if (willAllActiveBeDone && (!isPaid || dueAmount > 0)) {
        setPendingDishIncrement({ orderId: order.id, itemIndex });
        setPendingCompletionOrder(order);
        return;
      }

      // Normal path: either not the final dish, or order is already fully paid
      const updated = await incrementItemServedQuantity(order.id, itemIndex);
      setOrders(updated);
      const newMetrics = await getDailyMetrics();
      setMetrics(newMetrics);
      onOrdersChanged?.();
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Action Failed',
        title: 'Action Failed',
        message: err?.message || 'Could not update served count.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    }
  };

  // Payment status update (Cash or UPI, supporting split payments)
  const handlePaymentCompleted = async (
    orderId: string,
    method: PaymentMethod,
    amount?: number
  ) => {
    try {
      let finalOrders = await updateOrderPayment(
        orderId,
        method === 'Cash' ? 'Cash' : 'UPI',
        amount
      );

      // If completing final dish triggered this payment, increment that dish now
      if (pendingDishIncrementAfterPayment?.orderId === orderId) {
        finalOrders = await incrementItemServedQuantity(
          orderId,
          pendingDishIncrementAfterPayment.itemIndex
        );
        setPendingDishIncrementAfterPayment(null);
      }

      // Automatically mark order Done upon payment confirmation if triggered from Mark Done alert
      if (markDoneAfterPaymentId === orderId) {
        setMarkDoneAfterPaymentId(null);
        finalOrders = await updateOrderStatus(orderId, 'completed');
      }

      setOrders(finalOrders);
      const newMetrics = await getDailyMetrics();
      setMetrics(newMetrics);
      onOrdersChanged?.();
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Payment Failed',
        title: 'Payment Update Failed',
        message: err?.message || 'Could not update payment status.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
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
    } catch { }

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
      } catch { }
    }
  };

  // WhatsApp Pickup Notification: Option B & C (Smart Order Ready & Add-on Ready Alert)
  const handleNotifyOrderReady = async (order: Order) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }

    const activeItems = order.items.filter(
      (i) => i.status !== 'cancelled' && i.quantity > 0
    );
    const unnotifiedItems = activeItems.filter((i) => !i.notified);

    // If zero unnotified items remain, prompt to resend full notification
    if (unnotifiedItems.length === 0) {
      setConfirmModal({
        visible: true,
        variant: 'forest',
        badgeLabel: 'Order Ready',
        title: 'Order Already Notified',
        message: `A pickup alert was already sent for Token ${order.token}. Would you like to send it again?`,
        primaryLabel: 'Send Again',
        cancelLabel: 'Cancel',
        onPrimaryPress: async () => {
          setConfirmModal(null);
          const sent = await sendOrderReadyNotification(order);
          if (sent) {
            const updatedOrders = await markOrderNotified(order.id);
            setOrders(updatedOrders);
            onOrdersChanged?.();
          }
        },
        onClose: () => setConfirmModal(null),
      });
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
        } catch { }
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
      } catch { }
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
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Edit Failed',
        title: 'Edit Failed',
        message: err?.message || 'Could not save order changes.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
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

  const unpaidOrdersCount = useMemo(() => {
    return todayOrders.filter(isOrderUnpaid).length;
  }, [todayOrders]);

  // Filtered orders by tab ('active' vs 'all' vs 'unpaid') and search query, strictly within today's shift
  // Sorted in FIFO queue order (ascending chronological / token order: #01 first, then #02, #03...)
  const filteredOrders = useMemo(() => {
    let list = todayOrders;

    if (timelineFilter === 'active') {
      list = list.filter((order) => order.status === 'preparing');
    } else if (timelineFilter === 'unpaid') {
      list = list.filter(isOrderUnpaid);
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

    // Sort FIFO: ascending chronological / token order (#01 first, then #02, #03...)
    return [...list].sort((a, b) => {
      const tokenA = parseInt(a.token.replace(/[^0-9]/g, ''), 10);
      const tokenB = parseInt(b.token.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(tokenA) && !isNaN(tokenB) && tokenA !== tokenB) {
        return tokenA - tokenB;
      }
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
  }, [todayOrders, timelineFilter, searchQuery]);

  const handleClearTodayOrders = () => {
    if (todayOrders.length === 0) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'No Orders',
        title: 'No Shift Orders',
        message: "There are no orders recorded in today's shift.",
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    setConfirmModal({
      visible: true,
      variant: 'danger',
      badgeLabel: 'Clear Shift',
      title: "Reset Today's Shift?",
      message:
        "Delete all of today's shift orders? Past days' order history in Admin will not be affected.",
      primaryLabel: "Yes, Clear Shift",
      cancelLabel: "Keep Orders",
      onPrimaryPress: async () => {
        setConfirmModal(null);
        await clearTodayOrders();
        await loadData();
        onOrdersChanged?.();
      },
      onClose: () => setConfirmModal(null),
    });
  };

  // Order item card renderer
  const renderOrderCard = ({ item }: { item: Order }) => {
    return (
      <OrderTicketCard
        order={item}
        onPrint={(ord) => setPrintingOrder(ord)}
        onEdit={(ord) => setEditingOrder(ord)}
        onPayment={(ord) => {
          if (isOrderUnpaid(ord)) {
            setPayingOrder(ord);
          }
        }}
        onMarkDone={() => handleMarkOrderDone(item)}
        onNotifyOrderReady={(ord) => handleNotifyOrderReady(ord)}
        onNotifyDishReady={(ord, cartItem, idx) =>
          handleNotifyDishReady(ord, cartItem, idx)
        }
        onIncrementServed={(_, idx) => handleIncrementServed(item, idx)}
        onCancelItem={(_, idx) => handlePromptCancelItem(item, idx)}
      />
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

      {/* Top Filter Tabs: "Active Orders" vs "All Orders" vs "Unpaid" (Strictly Current Day) */}
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
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[
              styles.timelineTabText,
              timelineFilter === 'active' && styles.timelineTabTextActive,
            ]}
          >
            Active ({activeOrdersCount})
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
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[
              styles.timelineTabText,
              timelineFilter === 'all' && styles.timelineTabTextActive,
            ]}
          >
            All ({allTodayOrdersCount})
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
            setTimelineFilter('unpaid');
          }}
          style={[
            styles.timelineTab,
            unpaidOrdersCount > 0 && styles.timelineTabUnpaidHighlight,
            timelineFilter === 'unpaid' &&
            (unpaidOrdersCount > 0
              ? styles.timelineTabUnpaidActive
              : styles.timelineTabActive),
          ]}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[
              styles.timelineTabText,
              unpaidOrdersCount > 0 && styles.timelineTabTextUnpaidHighlight,
              timelineFilter === 'unpaid' &&
              (unpaidOrdersCount > 0
                ? styles.timelineTabTextUnpaidActive
                : styles.timelineTabTextActive),
            ]}
          >
            Unpaid ({unpaidOrdersCount})
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
                  : timelineFilter === 'unpaid'
                    ? 'All shift orders are fully paid! 💳'
                    : 'No orders recorded yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term or clear the filter.'
                : timelineFilter === 'active'
                  ? 'All taken orders are completed. Tap "All Orders" to view full shift history.'
                  : timelineFilter === 'unpaid'
                    ? 'There are no pending balances or unpaid tickets in today\'s shift.'
                    : 'Orders taken at the POS station will appear here in chronological order.'}
            </Text>

            {!searchQuery &&
              (timelineFilter === 'active' || timelineFilter === 'unpaid') &&
              todayOrders.length > 0 && (
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
        key={payingOrder ? `${payingOrder.id}_${payingOrder.balanceDue}_${payingOrder.totalAmount}` : 'closed'}
        visible={!!payingOrder}
        order={payingOrder}
        onClose={() => {
          setMarkDoneAfterPaymentId(null);
          setPendingDishIncrementAfterPayment(null);
          setPayingOrder(null);
        }}
        onPaymentCompleted={handlePaymentCompleted}
      />

      {/* Print KOTs / Customer Receipt Modal */}
      <PrintOrderModal
        visible={!!printingOrder}
        order={printingOrder}
        onClose={() => setPrintingOrder(null)}
      />

      {/* Payment Pending Modal (Rush Safeguard via KojiConfirmModal) */}
      {!!pendingCompletionOrder && (() => {
        const ord = pendingCompletionOrder;
        const cleanToken = ord.token.replace(/^#+/, '');
        const paidAmount = ord.paidAmount || ord.amountPaid || 0;
        const dueAmount = Math.max(0, ord.totalAmount - paidAmount);
        const displayDue = dueAmount > 0 ? dueAmount : ord.totalAmount;

        return (
          <KojiConfirmModal
            visible={true}
            variant="amber"
            badgeLabel="Payment Pending"
            title="Payment Pending"
            message={`Token #${cleanToken} • ${ord.customerName?.trim() || 'Walk-in'} (${ord.orderType || 'Dine-in'}) still has an unpaid balance. Collect payment now or mark done anyway?`}
            heroLabel="DUE BALANCE"
            heroAmount={`₹${displayDue}`}
            primaryLabel="Collect Payment & Complete"
            onPrimaryPress={() => {
              const dishInc = pendingDishIncrement;
              setPendingCompletionOrder(null);
              setPendingDishIncrement(null);
              if (dishInc) {
                setPendingDishIncrementAfterPayment(dishInc);
              }
              setMarkDoneAfterPaymentId(ord.id);
              setPayingOrder(ord);
            }}
            secondaryLabel="✓ Mark Done (Keep Unpaid)"
            onSecondaryPress={async () => {
              const dishInc = pendingDishIncrement;
              setPendingCompletionOrder(null);
              setPendingDishIncrement(null);
              if (dishInc) {
                await incrementItemServedQuantity(dishInc.orderId, dishInc.itemIndex);
              }
              await markOrderDoneAction(ord.id);
            }}
            cancelLabel="Cancel"
            onClose={() => {
              setPendingCompletionOrder(null);
              setPendingDishIncrement(null);
            }}
          />
        );
      })()}

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
    gap: 6,
  },
  timelineTab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
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
  timelineTabUnpaidHighlight: {
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
  },
  timelineTabUnpaidActive: {
    backgroundColor: COLORS.amber,
    borderColor: COLORS.amber,
    shadowColor: COLORS.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  timelineTabText: {
    fontSize: 11.5,
    color: COLORS.organic,
    ...FONTS.semibold,
  },
  timelineTabTextActive: {
    color: COLORS.ivory,
    ...FONTS.bold,
  },
  timelineTabTextUnpaidHighlight: {
    color: COLORS.amber,
    ...FONTS.bold,
  },
  timelineTabTextUnpaidActive: {
    color: COLORS.white,
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
    backgroundColor: COLORS.white,
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
    backgroundColor: COLORS.sage,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.sage,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
  },
  paymentPillPending: {
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
  },
  paymentPillPartial: {
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
  },
  paymentPillTextCompleted: {
    color: COLORS.forest,
  },
  paymentPillTextPending: {
    color: COLORS.amber,
  },
  paymentPillTextPartial: {
    color: COLORS.amber,
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
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
    borderWidth: 1,
    borderRadius: 8,
  },
  actionBtnCompletedText: {
    fontSize: 12,
    color: COLORS.forest,
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
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.success,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
  },
  notifyOrderPillNotified: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
  },
  notifyOrderPillText: {
    fontSize: 10.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  notifyOrderPillTextNotified: {
    fontSize: 10.5,
    color: COLORS.forest,
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
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
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
    backgroundColor: COLORS.successTint,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemWhatsappBtnNotified: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
  },
  itemProgressBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemProgressText: {
    fontSize: 10.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  itemCancelActionBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: COLORS.dangerTint,
    borderColor: COLORS.danger,
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
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemDoneBadgeText: {
    fontSize: 10.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  itemCancelledBadge: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerTint,
    borderColor: COLORS.danger,
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
    backgroundColor: COLORS.amberTint,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.amber,
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
