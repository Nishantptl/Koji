import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts/legacy';
import {
  Order,
  OrderInput,
  OrderStatus,
  OrderType,
  ItemStatus,
  MenuItem,
  CartItem,
  DailyMetrics,
  DateRangeOption,
  CustomerProfile,
  PaymentMethod,
  PaymentStatus,
  UpiConfig,
  PaymentRecord,
} from '../types';
import defaultMenuSeed from '../data/menu.json';

const STORAGE_KEY = 'koji_orders_cache';
const MENU_STORAGE_KEY = 'koji_menu_cache';
const PAYMENT_QR_STORAGE_KEY = '@koji_payment_qr';
export const UPI_CONFIG_STORAGE_KEY = '@koji_upi_config';
export const LAST_ACTIVE_DATE_KEY = '@koji_last_active_date';

export const getUpiConfig = async (): Promise<UpiConfig> => {
  try {
    const json = await AsyncStorage.getItem(UPI_CONFIG_STORAGE_KEY);
    if (json) {
      const parsed = JSON.parse(json);
      return {
        upiId: parsed.upiId || '',
        merchantName: parsed.merchantName || 'Kōji',
      };
    }
    return { upiId: '', merchantName: 'Kōji' };
  } catch {
    return { upiId: '', merchantName: 'Kōji' };
  }
};

export const saveUpiConfig = async (config: UpiConfig): Promise<void> => {
  await AsyncStorage.setItem(UPI_CONFIG_STORAGE_KEY, JSON.stringify(config));
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
};

export const getPaymentQrUri = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(PAYMENT_QR_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const savePaymentQrUri = async (uri: string): Promise<void> => {
  await AsyncStorage.setItem(PAYMENT_QR_STORAGE_KEY, uri);
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
};

export const resetPaymentQrUri = async (): Promise<void> => {
  await AsyncStorage.removeItem(PAYMENT_QR_STORAGE_KEY);
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
};

// ==========================================
// DAILY ACTIVE DATE & ROLLOVER SAFEGUARD
// ==========================================

export const getLastActiveDate = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LAST_ACTIVE_DATE_KEY);
  } catch {
    return null;
  }
};

export const setLastActiveDate = async (dateStr: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_ACTIVE_DATE_KEY, dateStr);
  } catch {}
};

/**
 * Midnight rollover check:
 * Compares current local date ('YYYY-MM-DD') with stored lastActiveDate.
 * If todayDate !== lastActiveDate:
 *   - Automatically updates lastActiveDate in AsyncStorage.
 *   - Ensures token generation starts from #01 and today's shift KPIs start fresh at ₹0.
 *   - Historical orders remain completely intact for Order History and Export Reports.
 */
export const checkAndHandleDailyRollover = async (): Promise<{
  isRollover: boolean;
  todayDate: string;
  previousDate: string | null;
}> => {
  const todayDate = formatDateYYYYMMDD(new Date());
  let lastActiveDate: string | null = null;
  try {
    lastActiveDate = await AsyncStorage.getItem(LAST_ACTIVE_DATE_KEY);
  } catch {}

  if (!lastActiveDate || lastActiveDate !== todayDate) {
    try {
      await AsyncStorage.setItem(LAST_ACTIVE_DATE_KEY, todayDate);
    } catch {}
    return {
      isRollover: true,
      todayDate,
      previousDate: lastActiveDate,
    };
  }

  return {
    isRollover: false,
    todayDate,
    previousDate: lastActiveDate,
  };
};

// ==========================================
// DATE & TIME HELPERS
// ==========================================

export const isOrderFromToday = (timestamp: string): boolean => {
  try {
    const orderDate = new Date(timestamp);
    if (isNaN(orderDate.getTime())) return false;
    const now = new Date();
    return (
      orderDate.getFullYear() === now.getFullYear() &&
      orderDate.getMonth() === now.getMonth() &&
      orderDate.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
};

export const formatTime = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minStr} ${ampm}`;
  } catch {
    return 'Just now';
  }
};

export const formatDate = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return '';
  }
};

export const formatDateYYYYMMDD = (date: Date = new Date()): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatDateClean = (dateInput: Date | string = new Date()): string => {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd} ${mmm} ${yyyy}`;
  } catch {
    return '';
  }
};

/**
 * Formats date and time strictly as "DD-MM-YYYY hh:mm A" for clean Excel & PDF tables
 */
export const formatDateTimeDDMMYYYY = (isoString: string | Date): string => {
  try {
    const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hh = String(hours).padStart(2, '0');
    const minStr = String(minutes).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${minStr} ${ampm}`;
  } catch {
    return '';
  }
};

// ==========================================
// TOKEN & CALCULATION HELPERS
// ==========================================

export const calculateTodayToken = (orders: Order[]): string => {
  const todayOrders = orders.filter((o) => isOrderFromToday(o.timestamp));
  let maxNum = 0;
  for (const o of todayOrders) {
    const match = o.token?.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextIndex = Math.max(todayOrders.length + 1, maxNum + 1);
  return `#${String(nextIndex).padStart(2, '0')}`;
};

/**
 * Recalculates total bill amount by summing active, non-cancelled items.
 */
export const recalculateOrderTotal = (items: CartItem[]): number => {
  return items
    .filter((item) => item.status !== 'cancelled')
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
};

/**
 * Calculates the current outstanding balance due for an order.
 */
export const getOrderBalanceDue = (order: Order): number => {
  if (typeof order.balanceDue === 'number') {
    return Math.max(0, order.balanceDue);
  }
  const paid = typeof order.paidAmount === 'number'
    ? order.paidAmount
    : (typeof order.amountPaid === 'number'
      ? order.amountPaid
      : (order.paymentStatus === 'Completed' ? order.totalAmount : 0));
  return Math.max(0, order.totalAmount - paid);
};

/**
 * Calculates the amount paid so far for an order.
 */
export const getOrderAmountPaid = (order: Order): number => {
  if (typeof order.paidAmount === 'number') {
    return Math.max(0, order.paidAmount);
  }
  if (typeof order.amountPaid === 'number') {
    return Math.max(0, order.amountPaid);
  }
  return order.paymentStatus === 'Completed' ? order.totalAmount : 0;
};

/**
 * Returns true if an order is fully settled/paid (no outstanding balance).
 */
export const isOrderFullyPaid = (order: Order): boolean => {
  const paid = getOrderAmountPaid(order);
  const due = Math.max(0, order.totalAmount - paid);
  const isPaid = typeof order.isPaid === 'boolean'
    ? order.isPaid
    : (order.paymentStatus === 'Completed' && due === 0);
  return isPaid && due === 0;
};

/**
 * Returns true if an order is unpaid or has a pending due balance.
 */
export const isOrderUnpaid = (order: Order): boolean => {
  return !isOrderFullyPaid(order);
};

/**
 * Returns the effective due amount for collection display.
 */
export const getOrderDueAmount = (order: Order): number => {
  const balanceDue = getOrderBalanceDue(order);
  return balanceDue > 0 ? balanceDue : order.totalAmount;
};

/**
 * Formats an INR amount with commas (e.g. ₹1,299).
 */
export const formatCurrency = (amount: number): string => {
  return `₹${(amount || 0).toLocaleString('en-IN')}`;
};

// ==========================================
// MENU PERSISTENCE (ADMIN & POS)
// ==========================================

/**
 * Reads all menu items from AsyncStorage, seeding from menu.json on first launch.
 */
export const getMenuItems = async (): Promise<MenuItem[]> => {
  try {
    const json = await AsyncStorage.getItem(MENU_STORAGE_KEY);
    if (!json) {
      // Seed default menu items
      const initial: MenuItem[] = (defaultMenuSeed as MenuItem[]).map((m) => ({
        ...m,
        isAvailable: m.isAvailable ?? true,
      }));
      await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existingItems: MenuItem[] = parsed.map((item: any) => ({
        ...item,
        isAvailable: item.isAvailable ?? true,
      }));

      // Automatically merge missing default seed items (e.g. Diet Coke, Water Bottle)
      // without overwriting existing customized dishes, prices, or availability
      const existingIds = new Set(existingItems.map((i) => i.id));
      const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase().trim()));

      const missingSeedItems = (defaultMenuSeed as MenuItem[])
        .filter((seed) => !existingIds.has(seed.id) && !existingNames.has(seed.name.toLowerCase().trim()))
        .map((m) => ({
          ...m,
          isAvailable: m.isAvailable ?? true,
        }));

      if (missingSeedItems.length > 0) {
        const merged = [...existingItems, ...missingSeedItems];
        await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }

      return existingItems;
    }
    return defaultMenuSeed as MenuItem[];
  } catch (error) {
    console.warn('[Kōji Menu Storage] Failed to read menu:', error);
    return defaultMenuSeed as MenuItem[];
  }
};

/**
 * Adds a new dish to the local menu.
 */
export const resetMenuToDefault = async (): Promise<MenuItem[]> => {
  const seed: MenuItem[] = (defaultMenuSeed as MenuItem[]).map((m) => ({
    ...m,
    isAvailable: m.isAvailable ?? true,
  }));
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(seed));
  return seed;
};

export const addMenuItem = async (
  dish: Omit<MenuItem, 'id'>
): Promise<MenuItem> => {
  const items = await getMenuItems();
  const newItem: MenuItem = {
    ...dish,
    id: `dish_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    isAvailable: dish.isAvailable ?? true,
  };

  const updated = [newItem, ...items];
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(updated));

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore
  }

  return newItem;
};

/**
 * Updates an existing dish (e.g. price, name, veg status).
 */
export const updateMenuItem = async (
  item: MenuItem
): Promise<MenuItem[]> => {
  const items = await getMenuItems();
  const updated = items.map((i) => (i.id === item.id ? item : i));
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(updated));

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore
  }

  return updated;
};

/**
 * Toggles dish availability (Available vs Sold Out).
 */
export const toggleItemAvailability = async (
  id: string
): Promise<MenuItem[]> => {
  const items = await getMenuItems();
  const updated = items.map((i) =>
    i.id === id ? { ...i, isAvailable: !(i.isAvailable ?? true) } : i
  );
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(updated));

  try {
    await Haptics.selectionAsync();
  } catch {
    // Ignore
  }

  return updated;
};

/**
 * Deletes a dish from the menu.
 */
export const deleteMenuItem = async (id: string): Promise<MenuItem[]> => {
  const items = await getMenuItems();
  const updated = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

// ==========================================
// ORDER PERSISTENCE & ACTIONS
// ==========================================

const normalizeOrder = (order: any): Order => {
  const normalizedItems: CartItem[] = Array.isArray(order.items)
    ? order.items.map((i: any) => {
        const qty = i.quantity || 1;
        const status = i.status || 'pending';
        let servedQty = 0;
        if (typeof i.servedQuantity === 'number') {
          servedQty = i.servedQuantity;
        } else if (status === 'completed') {
          servedQty = qty;
        }
        return {
          ...i,
          quantity: qty,
          servedQuantity: servedQty,
          status,
        };
      })
    : [];

  let payments: PaymentRecord[] | undefined = Array.isArray(order.payments)
    ? order.payments
    : undefined;

  if (!payments && order.paymentStatus === 'Completed' && order.paymentMethod) {
    const m = order.paymentMethod.includes('Cash') && order.paymentMethod.includes('UPI')
      ? 'UPI'
      : order.paymentMethod === 'Cash'
      ? 'Cash'
      : 'UPI';
    payments = [
      {
        method: m,
        amount: order.amountPaid || order.totalAmount || recalculateOrderTotal(normalizedItems),
        paidAt: order.timestamp,
      },
    ];
  }

  const rawSubtotal = typeof order.subtotal === 'number'
    ? order.subtotal
    : recalculateOrderTotal(normalizedItems);
  const discount = Math.min(rawSubtotal, Math.max(0, order.discount || 0));
  const subtotal = rawSubtotal;
  const totalAmount = typeof order.totalAmount === 'number' && order.totalAmount > 0
    ? order.totalAmount
    : Math.max(0, subtotal - discount);

  const rawAmountPaid = typeof order.paidAmount === 'number'
    ? order.paidAmount
    : (typeof order.amountPaid === 'number'
      ? order.amountPaid
      : (order.paymentStatus === 'Completed' ? totalAmount : 0));

  const amountPaid = Math.max(0, rawAmountPaid);
  const balanceDue = typeof order.balanceDue === 'number'
    ? Math.max(0, order.balanceDue)
    : Math.max(0, totalAmount - amountPaid);

  const isPaid = typeof order.isPaid === 'boolean'
    ? order.isPaid
    : (order.paymentStatus === 'Completed' && balanceDue === 0);

  const paymentStatus: PaymentStatus =
    order.paymentStatus || (balanceDue === 0 && amountPaid > 0 ? 'Completed' : 'Pending');

  return {
    ...order,
    items: normalizedItems,
    payments,
    orderType:
      order.orderType === 'Take Away' || order.orderType === 'Parcel'
        ? 'Parcel'
        : order.orderType || 'Dine-in',
    discountPercent: typeof order.discountPercent === 'number' ? order.discountPercent : undefined,
    status: order.status === 'completed' ? 'completed' : 'preparing',
    paymentStatus,
    subtotal,
    discount,
    totalAmount,
    amountPaid,
    paidAmount: amountPaid,
    balanceDue,
    isPaid,
  };
};

export const getOrders = async (): Promise<Order[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      return [];
    }
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeOrder);
    }
    return [];
  } catch (error) {
    console.warn('[Kōji Storage] Failed to read cached orders:', error);
    return [];
  }
};

export const saveOrder = async (orderData: OrderInput): Promise<Order> => {
  await checkAndHandleDailyRollover();
  const existingOrders = await getOrders();
  const token = calculateTodayToken(existingOrders);

  // Ensure each item has status: 'pending', servedQuantity: 0, and isPrinted tracking
  const itemsWithStatus: CartItem[] = orderData.items.map((i) => ({
    ...i,
    status: i.status || 'pending',
    servedQuantity: 0,
    isPrinted: Boolean(i.isPrinted),
    printedAt: i.printedAt,
  }));

  const rawSubtotal = recalculateOrderTotal(itemsWithStatus);
  const subtotal = typeof orderData.subtotal === 'number' ? orderData.subtotal : rawSubtotal;
  const discount = Math.min(subtotal, Math.max(0, orderData.discount || 0));
  const totalAmount = typeof orderData.totalAmount === 'number'
    ? orderData.totalAmount
    : Math.max(0, subtotal - discount);

  const isPaid = orderData.paymentStatus === 'Completed' || orderData.isPaid === true;
  const amountPaid = isPaid ? totalAmount : (orderData.amountPaid ?? orderData.paidAmount ?? 0);
  const balanceDue = Math.max(0, totalAmount - amountPaid);
  const paymentStatus: PaymentStatus =
    balanceDue <= 0 && isPaid
      ? 'Completed'
      : amountPaid > 0
      ? 'Partial'
      : 'Pending';

  const payments: PaymentRecord[] = [];
  if (isPaid && orderData.paymentMethod) {
    const method = orderData.paymentMethod === 'Cash' ? 'Cash' : 'UPI';
    payments.push({
      method,
      amount: totalAmount,
      paidAt: new Date().toISOString(),
    });
  }

  const rawOrderType = orderData.orderType;
  const orderType: OrderType =
    rawOrderType === 'Take Away' || rawOrderType === 'Parcel'
      ? 'Parcel'
      : rawOrderType === 'Car'
      ? 'Car'
      : 'Dine-in';

  const newOrder: Order = {
    ...orderData,
    orderType,
    subtotal,
    discount,
    items: itemsWithStatus,
    totalAmount,
    amountPaid,
    paidAmount: amountPaid,
    balanceDue,
    isPaid: paymentStatus === 'Completed' && balanceDue === 0,
    id: `koji_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    token,
    timestamp: new Date().toISOString(),
    status: orderData.status || 'preparing',
    paymentStatus,
    paymentMethod: orderData.paymentMethod || undefined,
    payments: payments.length > 0 ? payments : undefined,
  };

  const updatedOrders = [newOrder, ...existingOrders];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore
  }

  return newOrder;
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus
): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      const isCompleted = status === 'completed';
      const updatedItems = isCompleted
        ? order.items.map((i) =>
            i.status === 'cancelled'
              ? i
              : { ...i, status: 'completed' as ItemStatus, servedQuantity: i.quantity }
          )
        : order.items;

      return {
        ...order,
        items: updatedItems,
        status,
        completedAt: isCompleted ? new Date().toISOString() : undefined,
      };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Fallback
  }

  return updatedOrders;
};

/**
 * Updates a specific item's status within an order (Done or Cancel)
 * and automatically recalculates the active bill total.
 */
export const updateOrderItemStatus = async (
  orderId: string,
  itemIndex: number,
  itemStatus: ItemStatus
): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      const newItems = [...order.items];
      if (newItems[itemIndex]) {
        const currentItem = newItems[itemIndex];
        newItems[itemIndex] = {
          ...currentItem,
          status: itemStatus,
          servedQuantity: itemStatus === 'completed' ? currentItem.quantity : currentItem.servedQuantity,
        };
      }
      const rawSubtotal = recalculateOrderTotal(newItems);
      const discount = Math.min(rawSubtotal, Math.max(0, order.discount || 0));
      const newTotal = Math.max(0, rawSubtotal - discount);
      const currentPaid = typeof order.amountPaid === 'number'
        ? order.amountPaid
        : (order.paymentStatus === 'Completed' ? order.totalAmount : 0);
      const balanceDue = Math.max(0, newTotal - currentPaid);
      let newPaymentStatus: PaymentStatus = 'Pending';
      if (currentPaid === 0) {
        newPaymentStatus = 'Pending';
      } else if (currentPaid > 0 && balanceDue > 0) {
        newPaymentStatus = 'Partial';
      } else {
        newPaymentStatus = 'Completed';
      }

      const nonCancelled = newItems.filter((i) => i.status !== 'cancelled');
      const allCompleted =
        nonCancelled.length > 0 &&
        nonCancelled.every((i) => i.status === 'completed');
      const shouldAutoComplete = allCompleted && balanceDue <= 0;

      return {
        ...order,
        items: newItems,
        totalAmount: newTotal,
        amountPaid: currentPaid,
        paidAmount: currentPaid,
        balanceDue,
        isPaid: newPaymentStatus === 'Completed' && balanceDue === 0,
        paymentStatus: newPaymentStatus,
        status: shouldAutoComplete ? 'completed' : order.status,
        completedAt: shouldAutoComplete
          ? order.completedAt || new Date().toISOString()
          : order.completedAt,
      };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Fallback
  }

  return updatedOrders;
};

/**
 * Increments the served quantity of an item by 1 (e.g., 0/3 -> 1/3 -> 2/3 -> 3/3 Done).
 * When servedQuantity reaches quantity, marks item completed.
 * When all items in order are completed, marks order completed.
 */
export const incrementItemServedQuantity = async (
  orderId: string,
  itemIndex: number
): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      const newItems = [...order.items];
      const targetItem = newItems[itemIndex];
      if (!targetItem || targetItem.status === 'cancelled') {
        return order;
      }

      const totalQty = targetItem.quantity || 1;
      const currentServed = typeof targetItem.servedQuantity === 'number'
        ? targetItem.servedQuantity
        : (targetItem.status === 'completed' ? totalQty : 0);

      const nextServed = Math.min(totalQty, currentServed + 1);
      const isCompleted = nextServed >= totalQty;

      newItems[itemIndex] = {
        ...targetItem,
        servedQuantity: nextServed,
        status: isCompleted ? 'completed' : 'pending',
      };

      const rawSubtotal = recalculateOrderTotal(newItems);
      const discount = Math.min(rawSubtotal, Math.max(0, order.discount || 0));
      const newTotal = Math.max(0, rawSubtotal - discount);
      const currentPaid = typeof order.amountPaid === 'number'
        ? order.amountPaid
        : (order.paymentStatus === 'Completed' ? order.totalAmount : 0);
      const balanceDue = Math.max(0, newTotal - currentPaid);
      let newPaymentStatus: PaymentStatus = 'Pending';
      if (currentPaid === 0) {
        newPaymentStatus = 'Pending';
      } else if (currentPaid > 0 && balanceDue > 0) {
        newPaymentStatus = 'Partial';
      } else {
        newPaymentStatus = 'Completed';
      }

      const nonCancelled = newItems.filter((i) => i.status !== 'cancelled');
      const allCompleted =
        nonCancelled.length > 0 &&
        nonCancelled.every((i) => i.status === 'completed');
      const shouldAutoComplete = allCompleted && balanceDue <= 0;

      return {
        ...order,
        items: newItems,
        totalAmount: newTotal,
        amountPaid: currentPaid,
        paidAmount: currentPaid,
        balanceDue,
        isPaid: newPaymentStatus === 'Completed' && balanceDue === 0,
        paymentStatus: newPaymentStatus,
        status: shouldAutoComplete ? 'completed' : order.status,
        completedAt: shouldAutoComplete
          ? order.completedAt || new Date().toISOString()
          : order.completedAt,
      };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Fallback
  }

  return updatedOrders;
};

/**
 * Updates the payment status and payment method of an order.
 * Supports split payment tracking (e.g. initial UPI + add-on Cash).
 */
export const updateOrderPayment = async (
  orderId: string,
  paymentMethod: 'UPI' | 'Cash',
  payAmount?: number
): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const nowIso = new Date().toISOString();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      const existingPayments: PaymentRecord[] = Array.isArray(order.payments)
        ? [...order.payments]
        : typeof order.amountPaid === 'number' && order.amountPaid > 0 && order.paymentMethod
        ? [
            {
              method: order.paymentMethod === 'Cash' ? 'Cash' : 'UPI',
              amount: order.amountPaid,
              paidAt: order.timestamp,
            },
          ]
        : [];

      const currentPaidBefore = existingPayments.reduce((s, p) => s + p.amount, 0);
      const currentDue = Math.max(0, order.totalAmount - currentPaidBefore);
      const amountPaying =
        typeof payAmount === 'number' && payAmount > 0
          ? Math.min(payAmount, currentDue > 0 ? currentDue : order.totalAmount)
          : currentDue > 0
          ? currentDue
          : order.totalAmount;

      const newRecord: PaymentRecord = {
        method: paymentMethod,
        amount: amountPaying,
        paidAt: nowIso,
      };

      const updatedPayments = [...existingPayments, newRecord];
      const totalPaid = updatedPayments.reduce((s, p) => s + p.amount, 0);
      const balanceDue = Math.max(0, order.totalAmount - totalPaid);

      const hasUpi = updatedPayments.some((p) => p.method === 'UPI' && p.amount > 0);
      const hasCash = updatedPayments.some((p) => p.method === 'Cash' && p.amount > 0);
      const combinedMethod: PaymentMethod =
        hasUpi && hasCash ? 'UPI + Cash' : paymentMethod;

      const paymentStatus: PaymentStatus =
        balanceDue <= 0
          ? 'Completed'
          : totalPaid > 0
          ? 'Partial'
          : 'Pending';

      return {
        ...order,
        amountPaid: totalPaid,
        paidAmount: totalPaid,
        balanceDue,
        isPaid: balanceDue <= 0,
        paymentStatus,
        paymentMethod: combinedMethod,
        payments: updatedPayments,
      };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Fallback
  }

  return updatedOrders;
};

/**
 * Updates the items list for an active ticket (live editing & adding new dishes).
 * Recomputes totalAmount, amountPaid, balanceDue, and paymentStatus.
 * If order has unserved items, sets status to 'preparing'.
 */
export const updateOrderItems = async (
  orderId: string,
  updatedItems: CartItem[]
): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      // Group base items first and add-on items strictly below
      const baseItems = updatedItems.filter((i) => !i.isAddon && !i.addedAt);
      const addonItems = updatedItems.filter((i) => i.isAddon || i.addedAt);
      const orderedItems = [...baseItems, ...addonItems];

      const rawSubtotal = recalculateOrderTotal(orderedItems);
      const discount = Math.min(rawSubtotal, Math.max(0, order.discount || 0));
      const newTotal = Math.max(0, rawSubtotal - discount);

      // Determine money collected so far
      const currentPaid = typeof order.amountPaid === 'number'
        ? order.amountPaid
        : (order.paymentStatus === 'Completed' ? order.totalAmount : 0);

      const balanceDue = Math.max(0, newTotal - currentPaid);

      let newPaymentStatus: PaymentStatus = 'Pending';
      if (currentPaid === 0) {
        newPaymentStatus = 'Pending';
      } else if (currentPaid > 0 && balanceDue > 0) {
        newPaymentStatus = 'Partial';
      } else {
        newPaymentStatus = 'Completed';
      }

      // Check if order has any unserved items
      const hasUnservedItems = orderedItems.some(
        (i) =>
          i.status !== 'cancelled' &&
          (i.status === 'pending' || (i.servedQuantity ?? 0) < i.quantity)
      );

      const hadNewItems = orderedItems.some(
        (item) => !order.items.some((orig) => orig.id === item.id)
      );

      // Ensure newly added items start with notified: false
      const sanitizedItems = orderedItems.map((item) => {
        const isExisting = order.items.some((orig) => orig.id === item.id);
        if (!isExisting) {
          return {
            ...item,
            notified: false,
            notifiedAt: undefined,
          };
        }
        return item;
      });

      const isPreparing = hasUnservedItems || hadNewItems || order.status === 'preparing';

      return {
        ...order,
        items: sanitizedItems,
        totalAmount: newTotal,
        amountPaid: currentPaid,
        balanceDue,
        status: isPreparing ? 'preparing' : order.status,
        completedAt: isPreparing ? undefined : order.completedAt,
        paymentStatus: newPaymentStatus,
        notified: hadNewItems ? false : order.notified,
      };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Fallback
  }

  return updatedOrders;
};

/**
 * Marks specified items (or all active items if itemIds is omitted) in an order as printed.
 */
export const markOrderItemsAsPrinted = async (
  orderId: string,
  itemIds?: string[]
): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const nowIso = new Date().toISOString();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      const updatedItems = order.items.map((item) => {
        if (!itemIds || itemIds.includes(item.id)) {
          return {
            ...item,
            isPrinted: true,
            printedAt: item.printedAt || nowIso,
          };
        }
        return item;
      });
      return { ...order, items: updatedItems };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
  return updatedOrders;
};

/**
 * Marks a specific item in an order as notified via WhatsApp.
 * Bidirectional Sync: If all active items in the order become notified,
 * automatically updates parent order.notified to true.
 */
export const markOrderItemNotified = async (
  orderId: string,
  itemId: string,
  itemIdx?: number
): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const nowIso = new Date().toISOString();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      const updatedItems = order.items.map((item, idx) => {
        const matches = typeof itemIdx === 'number' ? idx === itemIdx : item.id === itemId;
        if (matches) {
          return {
            ...item,
            notified: true,
            notifiedAt: nowIso,
          };
        }
        return item;
      });

      // Item-to-Order Sync:
      // If all active (non-cancelled) items are notified, mark whole order as notified
      const activeItems = updatedItems.filter(
        (i) => i.status !== 'cancelled' && i.quantity > 0
      );
      const allActiveNotified =
        activeItems.length > 0 && activeItems.every((i) => i.notified === true);

      return {
        ...order,
        items: updatedItems,
        notified: allActiveNotified ? true : order.notified,
        notifiedAt: allActiveNotified ? (order.notifiedAt || nowIso) : order.notifiedAt,
      };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
  return updatedOrders;
};

/**
 * Marks a whole order as notified via WhatsApp.
 * Bidirectional Sync: Simultaneously marks all active (non-cancelled) items
 * in the order as notified (item.notified = true).
 */
export const markOrderNotified = async (orderId: string): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const nowIso = new Date().toISOString();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      // Order-to-Item Sync:
      // Set notified = true on all active items
      const updatedItems = order.items.map((item) => {
        if (item.status !== 'cancelled') {
          return {
            ...item,
            notified: true,
            notifiedAt: item.notifiedAt || nowIso,
          };
        }
        return item;
      });

      return {
        ...order,
        items: updatedItems,
        notified: true,
        notifiedAt: nowIso,
      };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
  return updatedOrders;
};

export const markSpecificItemsNotified = async (
  orderId: string,
  itemIds: string[]
): Promise<Order[]> => {
  const existingOrders = await getOrders();
  const nowIso = new Date().toISOString();
  const updatedOrders = existingOrders.map((order) => {
    if (order.id === orderId) {
      const updatedItems = order.items.map((item) => {
        if (itemIds.includes(item.id)) {
          return {
            ...item,
            notified: true,
            notifiedAt: item.notifiedAt || nowIso,
          };
        }
        return item;
      });

      return {
        ...order,
        items: updatedItems,
        notified: true,
        notifiedAt: order.notifiedAt || nowIso,
      };
    }
    return order;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
  return updatedOrders;
};

export const clearTodayOrders = async (): Promise<void> => {
  const existingOrders = await getOrders();
  const pastOrders = existingOrders.filter((o) => !isOrderFromToday(o.timestamp));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pastOrders));
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore
  }
};

export const clearAllOrders = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore
  }
};

export const getDailyMetrics = async (): Promise<DailyMetrics> => {
  await checkAndHandleDailyRollover();
  const orders = await getOrders();
  const todayOrders = orders.filter((o) => isOrderFromToday(o.timestamp));
  const totalRevenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const activeOrders = todayOrders.filter((o) => o.status === 'preparing').length;
  const completedOrders = todayOrders.filter((o) => o.status === 'completed').length;

  return {
    totalOrders: todayOrders.length,
    totalRevenue,
    activeOrders,
    completedOrders,
  };
};

export const getNextToken = async (): Promise<string> => {
  await checkAndHandleDailyRollover();
  const orders = await getOrders();
  return calculateTodayToken(orders);
};

/**
 * Returns a list of unique returning customer profiles sorted by most recent order.
 */
export const getCustomerProfiles = async (): Promise<CustomerProfile[]> => {
  const orders = await getOrders();
  const profiles: CustomerProfile[] = [];
  const seen = new Set<string>();

  for (let i = orders.length - 1; i >= 0; i--) {
    const o = orders[i];
    const name = o.customerName?.trim();
    const phone = o.customerPhone?.trim();

    if (name && phone && /^[0-9]{10}$/.test(phone)) {
      const key = `${name.toLowerCase()}_${phone}`;
      if (!seen.has(key)) {
        seen.add(key);
        profiles.push({ name, phone });
      }
    }
  }

  return profiles;
};

// ==========================================
// CSV & PDF REPORT EXPORT ENGINES (DATE RANGE FILTER & LANDSCAPE A4)
// ==========================================

const escapeCsvField = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) {
    return '';
  }
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Filter orders strictly by DateRangeOption ('today', '7days', 'custom', 'all', '30days')
 */
export const filterOrdersForExport = (
  allOrders: Order[],
  rangeOption: DateRangeOption,
  customStart?: Date,
  customEnd?: Date
): {
  startDate: Date;
  endDate: Date;
  filtered: Order[];
  startFormatted: string;
  endFormatted: string;
} => {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  if (rangeOption === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (rangeOption === '7days') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getTime());
  } else if (rangeOption === '30days') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getTime());
  } else if (rangeOption === 'all') {
    startDate = new Date(0); // Epoch
    endDate = new Date(now.getTime());
  } else if (rangeOption === 'custom') {
    startDate = customStart ? new Date(customStart) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    endDate = customEnd ? new Date(customEnd) : new Date(now);
    endDate.setHours(23, 59, 59, 999);
  }

  const filtered = allOrders.filter((o) => {
    const t = new Date(o.timestamp).getTime();
    return t >= startDate.getTime() && t <= endDate.getTime();
  });

  const startFormatted = rangeOption === 'all'
    ? (filtered.length > 0 ? formatDateYYYYMMDD(new Date(filtered[filtered.length - 1].timestamp)) : formatDateYYYYMMDD(now))
    : formatDateYYYYMMDD(startDate);
  const endFormatted = formatDateYYYYMMDD(endDate);

  return { startDate, endDate, filtered, startFormatted, endFormatted };
};

export const generateCsvFromOrders = (orders: Order[]): string => {
  // Column Header Sequence: Layout Pattern A with Split Payment Breakdown
  const headers = [
    'Token',
    'Date & Time',
    'Order Type',
    'Customer Name',
    'Contact Number',
    'Dishes Ordered',
    'Payment Mode',
    'Payment Status',
    'UPI Amount',
    'Cash Amount',
    'Total Bill (INR)',
  ];

  const rows = orders.map((order) => {
    // 1. Token: Clean value (e.g., "#01", "#02")
    let tokenStr = order.token ? order.token.trim() : '';
    if (tokenStr && !tokenStr.startsWith('#')) {
      tokenStr = `#${tokenStr}`;
    }

    // 2. Date & Time: Clean formatted timestamp DD-MM-YYYY hh:mm A
    const dateTimeStr = formatDateTimeDDMMYYYY(order.timestamp);

    // 3. Order Type: Normalized 'Parcel' | 'Dine-in' | 'Car'
    const orderTypeDisplay =
      order.orderType === 'Take Away' || order.orderType === 'Parcel'
        ? 'Parcel'
        : order.orderType || 'Dine-in';

    // 4. Customer Name: Individual separated column
    const customerName = order.customerName ? order.customerName.trim() : '';

    // 5. Contact Number: ="9876543210" formula so Excel never formats as scientific notation (e.g. 9.93E+09)
    const cleanPhone = order.customerPhone ? order.customerPhone.replace(/\D/g, '') : '';
    const phoneStr = cleanPhone ? `="${cleanPhone}"` : '';

    // 6. Dishes Ordered: Single line joined with " | " so Excel row heights stay uniform
    const dishesFormatted = order.items
      .map((item) => {
        const linePrice = item.price * item.quantity;
        let line = `${item.quantity}x ${item.name} (₹${linePrice})`;
        if (item.status === 'cancelled') {
          line += ' [Cancelled]';
        }
        return line;
      })
      .join(' | ');
    const dishesCell = escapeCsvField(dishesFormatted);

    // 7. Split Payment Breakdown (UPI vs Cash)
    let upiAmount = 0;
    let cashAmount = 0;
    if (Array.isArray(order.payments) && order.payments.length > 0) {
      upiAmount = order.payments
        .filter((p) => p.method === 'UPI')
        .reduce((s, p) => s + p.amount, 0);
      cashAmount = order.payments
        .filter((p) => p.method === 'Cash')
        .reduce((s, p) => s + p.amount, 0);
    } else if (order.paymentStatus === 'Completed') {
      const total = typeof order.totalAmount === 'number' ? order.totalAmount : 0;
      if (order.paymentMethod === 'UPI') {
        upiAmount = total;
      } else if (order.paymentMethod === 'Cash') {
        cashAmount = total;
      } else if (order.paymentMethod === 'UPI + Cash') {
        upiAmount = typeof order.amountPaid === 'number' ? order.amountPaid : total;
      }
    }

    let paymentMode = order.paymentMethod || (order.paymentStatus === 'Completed' ? 'Cash' : 'N/A');
    if (upiAmount > 0 && cashAmount > 0) {
      paymentMode = 'UPI + Cash';
    } else if (upiAmount > 0) {
      paymentMode = 'UPI';
    } else if (cashAmount > 0) {
      paymentMode = 'Cash';
    }

    // 8. Payment Status
    const paymentStatus = order.paymentStatus || 'Pending';

    // 9. Total Bill (INR): Raw numeric value so Excel auto-aligns right & enables SUM()
    const totalBill = typeof order.totalAmount === 'number' ? order.totalAmount : 0;

    return [
      escapeCsvField(tokenStr),
      escapeCsvField(dateTimeStr),
      escapeCsvField(orderTypeDisplay),
      escapeCsvField(customerName),
      phoneStr,
      dishesCell,
      escapeCsvField(paymentMode),
      escapeCsvField(paymentStatus),
      upiAmount,
      cashAmount,
      totalBill,
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
};

/**
 * Generates formatted HTML for a Landscape A4 PDF Report
 */
export const generatePdfHtmlFromOrders = (orders: Order[], periodLabel: string): string => {
  let totalUpi = 0;
  let totalCash = 0;
  let totalRevenue = 0;

  const rowsHtml = orders.map((order) => {
    let tokenStr = order.token ? order.token.trim() : '';
    if (tokenStr && !tokenStr.startsWith('#')) {
      tokenStr = `#${tokenStr}`;
    }
    const dateTimeStr = formatDateTimeDDMMYYYY(order.timestamp);
    const orderTypeDisplay =
      order.orderType === 'Take Away' || order.orderType === 'Parcel'
        ? 'Parcel'
        : order.orderType || 'Dine-in';
    const customerName = order.customerName?.trim() || 'Walk-in';
    const cleanPhone = order.customerPhone ? order.customerPhone.replace(/\D/g, '') : '';
    const phoneDisplay = cleanPhone || '-';

    const dishesHtml = order.items
      .map((item) => {
        const linePrice = item.price * item.quantity;
        let line = `${item.quantity}x ${item.name} (₹${linePrice})`;
        if (item.status === 'cancelled') {
          line += ' [Cancelled]';
        }
        return escapeHtml(line);
      })
      .join('<br/>');

    let upiAmount = 0;
    let cashAmount = 0;
    if (Array.isArray(order.payments) && order.payments.length > 0) {
      upiAmount = order.payments
        .filter((p) => p.method === 'UPI')
        .reduce((s, p) => s + p.amount, 0);
      cashAmount = order.payments
        .filter((p) => p.method === 'Cash')
        .reduce((s, p) => s + p.amount, 0);
    } else if (order.paymentStatus === 'Completed') {
      const total = typeof order.totalAmount === 'number' ? order.totalAmount : 0;
      if (order.paymentMethod === 'UPI') {
        upiAmount = total;
      } else if (order.paymentMethod === 'Cash') {
        cashAmount = total;
      } else if (order.paymentMethod === 'UPI + Cash') {
        upiAmount = typeof order.amountPaid === 'number' ? order.amountPaid : total;
      }
    }

    let paymentMode = order.paymentMethod || (order.paymentStatus === 'Completed' ? 'Cash' : 'Pending');
    if (upiAmount > 0 && cashAmount > 0) {
      paymentMode = 'UPI + Cash';
    } else if (upiAmount > 0) {
      paymentMode = 'UPI';
    } else if (cashAmount > 0) {
      paymentMode = 'Cash';
    }

    const totalBill = typeof order.totalAmount === 'number' ? order.totalAmount : 0;

    totalUpi += upiAmount;
    totalCash += cashAmount;
    totalRevenue += totalBill;

    let badgeClass = 'payment-pending';
    if (paymentMode === 'UPI') badgeClass = 'payment-upi';
    else if (paymentMode === 'Cash') badgeClass = 'payment-cash';
    else if (paymentMode === 'UPI + Cash') badgeClass = 'payment-split';

    return `
      <tr>
        <td class="center"><span class="token-badge">${tokenStr}</span></td>
        <td class="nowrap">
          <div>${dateTimeStr}</div>
          <span style="display: inline-block; margin-top: 3px; padding: 1px 6px; font-size: 8px; font-weight: 700; border-radius: 3px; background: #EDF2EC; color: #0D381E; border: 1px solid #C8D9CB;">${escapeHtml(orderTypeDisplay)}</span>
        </td>
        <td><strong>${escapeHtml(customerName)}</strong></td>
        <td class="center nowrap">${phoneDisplay}</td>
        <td class="dish-col">${dishesHtml}</td>
        <td class="center"><span class="badge ${badgeClass}">${paymentMode}</span></td>
        <td class="right">${upiAmount > 0 ? '₹' + upiAmount.toLocaleString('en-IN') : '₹0'}</td>
        <td class="right">${cashAmount > 0 ? '₹' + cashAmount.toLocaleString('en-IN') : '₹0'}</td>
        <td class="right"><strong>₹${totalBill.toLocaleString('en-IN')}</strong></td>
      </tr>
    `;
  }).join('');

  const nowFormatted = formatDateTimeDDMMYYYY(new Date());

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kōji Sales Report - ${escapeHtml(periodLabel)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #1A201C;
      background: #FFFFFF;
      font-size: 10px;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2.5px solid #0D381E;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .brand-group h1 {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 4px;
      color: #0D381E;
      margin: 0;
      line-height: 1;
    }
    .brand-group p {
      font-size: 11px;
      color: #5C7063;
      margin: 4px 0 0 0;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }
    .report-meta {
      text-align: right;
    }
    .report-meta .period-tag {
      font-size: 13px;
      font-weight: 700;
      color: #0D381E;
      margin: 0 0 3px 0;
    }
    .report-meta .gen-time {
      font-size: 10px;
      color: #8C9E91;
      margin: 0;
    }
    .summary-boxes {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
    }
    .summary-card {
      flex: 1;
      background: #F8F9F5;
      border: 1.2px solid #C8D9CB;
      border-radius: 8px;
      padding: 8px 12px;
      text-align: center;
    }
    .summary-card.highlight {
      background: #EDF2EC;
      border-color: #0D381E;
    }
    .summary-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #5C7063;
      margin-bottom: 2px;
    }
    .summary-value {
      font-size: 17px;
      font-weight: 800;
      color: #0D381E;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    th {
      background-color: #0D381E;
      color: #FFFFFF;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #0D381E;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 9px;
    }
    th.right, td.right { text-align: right; }
    th.center, td.center { text-align: center; }
    td {
      padding: 6px 8px;
      border: 1px solid #DDE6DF;
      color: #1A201C;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background-color: #F8F9F5;
    }
    tr.totals-row td {
      background-color: #EDF2EC;
      font-weight: 800;
      color: #0D381E;
      border-top: 2px solid #0D381E;
      font-size: 10.5px;
    }
    .token-badge {
      display: inline-block;
      background: #FBF4EB;
      border: 1px solid #E5C39E;
      color: #D78B30;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 700;
    }
    .payment-upi { background: #E8F5E9; color: #1B5E20; }
    .payment-cash { background: #E3F2FD; color: #0D47A1; }
    .payment-split { background: #FFF3E0; color: #E65100; }
    .payment-pending { background: #FFEBEE; color: #B71C1C; }
    .dish-col {
      max-width: 320px;
      line-height: 1.5;
      padding: 8px 10px;
      vertical-align: top;
      color: #2D3748;
    }
    .nowrap {
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="brand-group">
      <h1>K Ō J I</h1>
      <p>Asian Crafted Fusion — Sales & Orders Report</p>
    </div>
    <div class="report-meta">
      <div class="period-tag">Period: ${escapeHtml(periodLabel)}</div>
      <div class="gen-time">Generated on: ${nowFormatted}</div>
    </div>
  </div>

  <div class="summary-boxes">
    <div class="summary-card">
      <div class="summary-title">Total Orders</div>
      <div class="summary-value">${orders.length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-title">UPI Revenue</div>
      <div class="summary-value">₹${totalUpi.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-card">
      <div class="summary-title">Cash Revenue</div>
      <div class="summary-value">₹${totalCash.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-card highlight">
      <div class="summary-title">Total Revenue</div>
      <div class="summary-value">₹${totalRevenue.toLocaleString('en-IN')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width: 55px;">Token</th>
        <th style="width: 130px;">Date & Time</th>
        <th style="width: 110px;">Customer</th>
        <th class="center" style="width: 90px;">Phone</th>
        <th>Dishes Ordered</th>
        <th class="center" style="width: 85px;">Payment Mode</th>
        <th class="right" style="width: 75px;">UPI (₹)</th>
        <th class="right" style="width: 75px;">Cash (₹)</th>
        <th class="right" style="width: 85px;">Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="totals-row">
        <td colspan="6" style="text-align: right; padding-right: 14px;">GRAND TOTALS (${orders.length} Orders)</td>
        <td class="right">₹${totalUpi.toLocaleString('en-IN')}</td>
        <td class="right">₹${totalCash.toLocaleString('en-IN')}</td>
        <td class="right">₹${totalRevenue.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
};

/**
 * Filtered Landscape A4 PDF Report Export supporting Today, Last 7 Days, Custom Range, and All Time.
 * Uses expo-print to generate a formatted PDF and expo-sharing to share.
 */
export const exportOrdersReportPdf = async (
  rangeOption: DateRangeOption,
  customStart?: Date,
  customEnd?: Date
): Promise<void> => {
  const allOrders = await getOrders();
  if (allOrders.length === 0) {
    throw new Error('No orders found for the selected period.');
  }

  const { filtered, startFormatted, endFormatted } = filterOrdersForExport(
    allOrders,
    rangeOption,
    customStart,
    customEnd
  );

  if (filtered.length === 0) {
    throw new Error('No orders found for the selected period.');
  }

  const periodLabel = rangeOption === 'all'
    ? 'All Time'
    : `${startFormatted} to ${endFormatted}`;

  const html = generatePdfHtmlFromOrders(filtered, periodLabel);

  const { base64 } = await Print.printToFileAsync({
    html,
    width: 842,
    height: 595,
    base64: true,
  });

  if (!base64) {
    throw new Error('Failed to generate PDF data');
  }

  const dateLabel = rangeOption === 'all'
    ? 'all-time'
    : `${startFormatted}-to-${endFormatted}`;

  const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const fileUri = `${docDir}koji-sales-report-${dateLabel}.pdf`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Export Kōji Sales Report',
    UTI: 'com.adobe.pdf',
  });
};

/**
 * Filtered CSV Report Export supporting Today, Last 7 Days, Custom Range, and All Time.
 * Generates an RFC 4180 compliant CSV file with UTF-8 BOM encoding and Excel formula-safe phone numbers.
 * Saves file named `koji-report-[startDate]-to-[endDate].csv`.
 */
export const exportOrdersReport = async (
  rangeOption: DateRangeOption,
  customStart?: Date,
  customEnd?: Date
): Promise<void> => {
  const allOrders = await getOrders();
  if (allOrders.length === 0) {
    throw new Error('No orders found for the selected period.');
  }

  const { filtered, startFormatted, endFormatted } = filterOrdersForExport(
    allOrders,
    rangeOption,
    customStart,
    customEnd
  );

  if (filtered.length === 0) {
    throw new Error('No orders found for the selected period.');
  }

  const fileName = `koji-report-${startFormatted}-to-${endFormatted}.csv`;
  const fileContent = generateCsvFromOrders(filtered);

  const cacheDir = FileSystem.cacheDirectory || '';
  const fileUri = `${cacheDir}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, fileContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: `Export Kōji Report (${startFormatted} to ${endFormatted})`,
    UTI: 'public.comma-separated-values-text',
  });
};

/**
 * Backward compatibility alias for exportOrdersReport
 */
export const exportOrdersReportCsv = exportOrdersReport;

/**
 * Deduplicated Customer Directory & vCard 3.0 (.vcf) Export
 */
export interface CustomerRecord {
  phone: string;       // Clean 10-digit mobile number
  name: string;        // Latest non-empty customer name
  visitCount: number;  // Total orders placed
  lastVisit: string;   // Most recent order ISO timestamp
}

export const HOLIDAY_ANNOUNCEMENT_MSG =
  "Hey there! 🍣 Kōji is taking a short break and will be closed Today.\nWe’ll be back rolling fresh sushi and serving your favorites from tomorrow at our usual evening hours. See you soon!";

export const extractUniqueCustomers = (ordersList: Order[]): CustomerRecord[] => {
  const customerMap = new Map<string, CustomerRecord>();

  // Sort chronologically so later orders update customer name & last visit
  const sortedOrders = [...ordersList].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const ord of sortedOrders) {
    if (!ord.customerPhone) continue;
    const cleanPhone = ord.customerPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) continue;

    const trimmedName = ord.customerName?.trim() || '';
    const existing = customerMap.get(cleanPhone);

    if (existing) {
      existing.visitCount += 1;
      existing.lastVisit = ord.timestamp;
      if (trimmedName) {
        existing.name = trimmedName;
      }
    } else {
      customerMap.set(cleanPhone, {
        phone: cleanPhone,
        name: trimmedName || 'Guest',
        visitCount: 1,
        lastVisit: ord.timestamp,
      });
    }
  }

  // Return sorted by visitCount descending
  return Array.from(customerMap.values()).sort(
    (a, b) =>
      b.visitCount - a.visitCount ||
      new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
  );
};

export const exportCustomerContactsVcf = async (
  customers: CustomerRecord[]
): Promise<void> => {
  if (customers.length === 0) {
    throw new Error('No customers found in order history to export.');
  }

  const vcardEntries = customers.map((c) => {
    const formattedPhone = c.phone.startsWith('+91')
      ? c.phone
      : `+91${c.phone}`;
    const displayName =
      c.name && c.name !== 'Guest'
        ? `Koji - ${c.name}`
        : `Koji - Customer ${c.phone.slice(-4)}`;
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${displayName}`,
      `TEL;TYPE=CELL:${formattedPhone}`,
      'END:VCARD',
    ].join('\n');
  });

  const vcfContent = vcardEntries.join('\n\n') + '\n';
  const now = new Date();
  const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `koji_customers_${dateStamp}.vcf`;

  const cacheDir = FileSystem.cacheDirectory || '';
  const fileUri = `${cacheDir}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, vcfContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/vcard',
    dialogTitle: 'Export Kōji Customer Contacts (.vcf)',
    UTI: 'public.vcard',
  });
};

export interface ContactSyncResult {
  addedCount: number;
  skippedCount: number;
  totalUnique: number;
}

export const syncCustomerContactsToPhone = async (
  customers: CustomerRecord[]
): Promise<ContactSyncResult> => {
  if (customers.length === 0) {
    return { addedCount: 0, skippedCount: 0, totalUnique: 0 };
  }

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Contacts permission denied. Please grant Contacts permission in device settings.');
  }

  const { data: existingContacts } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const existingNumbersSet = new Set<string>();
  if (existingContacts && existingContacts.length > 0) {
    for (const c of existingContacts) {
      if (c.phoneNumbers) {
        for (const p of c.phoneNumbers) {
          if (p.number) {
            const clean = p.number.replace(/\D/g, '').slice(-10);
            if (clean.length === 10) {
              existingNumbersSet.add(clean);
            }
          }
        }
      }
    }
  }

  let addedCount = 0;
  let skippedCount = 0;

  for (const cust of customers) {
    const cleanPhone = cust.phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) continue;

    if (existingNumbersSet.has(cleanPhone)) {
      skippedCount++;
    } else {
      const displayName =
        cust.name && cust.name !== 'Guest'
          ? cust.name.trim()
          : `Customer ${cleanPhone.slice(-4)}`;

      await Contacts.addContactAsync({
        contactType: Contacts.ContactTypes.Person,
        firstName: `Koji - ${displayName}`,
        name: `Koji - ${displayName}`,
        phoneNumbers: [
          {
            label: 'mobile',
            number: `+91${cleanPhone}`,
          },
        ],
      });
      existingNumbersSet.add(cleanPhone);
      addedCount++;
    }
  }

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}

  return {
    addedCount,
    skippedCount,
    totalUnique: customers.length,
  };
};

export const HOLIDAY_SENT_STORAGE_PREFIX = '@koji_holiday_sent_';

export const getHolidaySentPhones = async (dateKey: string): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(`${HOLIDAY_SENT_STORAGE_PREFIX}${dateKey}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
};

export const markHolidaySentPhone = async (
  dateKey: string,
  phone: string
): Promise<string[]> => {
  try {
    const current = await getHolidaySentPhones(dateKey);
    const updated = Array.from(new Set([...current, phone]));
    await AsyncStorage.setItem(
      `${HOLIDAY_SENT_STORAGE_PREFIX}${dateKey}`,
      JSON.stringify(updated)
    );
    return updated;
  } catch {
    return [];
  }
};


