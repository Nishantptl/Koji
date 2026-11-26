import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Modal,
  Image,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import {
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  UtensilsCrossed,
  Ban,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  Sparkles,
  Calendar as CalendarIcon,
  Clock,
  History,
  Printer,
  Receipt,
  RotateCw,
  AlertCircle,
  Smartphone,
  QrCode,
  FileText,
  MessageSquare,
  Users,
  UserPlus,
  Copy,
  Info,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { requireOptionalNativeModule } from 'expo';
import { MenuItem, DateRangeOption, Order, ItemSalesSummary } from '../types';
import { BrandHeader } from '../components/BrandHeader';
import { VegBadge } from '../components/VegBadge';
import { TokenBadge } from '../components/TokenBadge';
import { DatePickerModal } from '../components/DatePickerModal';
import { PrintOrderModal } from '../components/PrintOrderModal';
import {
  printCustomerReceipt,
  printStationKots,
  getPaperWidthPreference,
  setPaperWidthPreference,
  getAutoPrintPreference,
  setAutoPrintPreference,
} from '../services/printService';
import {
  NotificationChannel,
  getNotificationChannelPreference,
  setNotificationChannelPreference,
  openCustomerNotification,
} from '../services/whatsappService';
import {
  getMenuItems,
  addMenuItem,
  updateMenuItem,
  toggleItemAvailability,
  deleteMenuItem,
  resetMenuToDefault,
  getOrders,
  exportOrdersReport,
  exportOrdersReportPdf,
  formatDateYYYYMMDD,
  formatDateClean,
  formatDate,
  formatTime,
  isOrderFromToday,
  getItemsSoldSummary,
  getUpiConfig,
  saveUpiConfig,
  CustomerRecord,
  extractUniqueCustomers,
  syncCustomerContactsToPhone,
  getHolidaySentPhones,
  markHolidaySentPhone,
  HOLIDAY_ANNOUNCEMENT_MSG,
} from '../services/storage';
import { KojiConfirmModal, KojiConfirmModalProps } from '../components/KojiConfirmModal';
import { COLORS, FONTS, SPACING } from '../constants/theme';

const STANDARD_CATEGORIES = [
  'Sushi',
  'Wok & Crisp',
  'Rice & Noodles',
  'Mocktail',
];

type AdminView =
  | 'hub'
  | 'dish_tally'
  | 'menu_manage'
  | 'customer_directory'
  | 'export'
  | 'all_orders'
  | 'upi_setup'
  | 'printer_settings'
  | 'notification_settings';

interface AdminScreenProps {
  onMenuChanged?: () => void;
}

interface HistoryOrderCardProps {
  order: Order;
  onPrintCustomerBill: (order: Order) => void;
  onPrintStationKots: (order: Order) => void;
}

const HistoryOrderCard = React.memo<HistoryOrderCardProps>(
  ({ order, onPrintCustomerBill, onPrintStationKots }) => {
    const isCompleted = order.status === 'completed';
    const isPreparing = order.status === 'preparing';

    return (
      <View style={styles.historyCard}>
        {/* Top Row: Tall Token Badge spanning Time + Date stacked left; Total Amount + Done status pill stacked right */}
        <View style={styles.historyCardTopRow}>
          <View style={styles.historyCardTopLeft}>
            <TokenBadge
              token={order.token}
              variant="apricot"
              size="md"
              style={styles.historyTallTokenBadge}
              textStyle={styles.historyTallTokenText}
            />
            <View style={styles.historyCardDateTimeStack}>
              <Text style={styles.historyCardTimeText}>
                {formatTime(order.timestamp)}
              </Text>
              <Text style={styles.historyCardDateText}>
                {formatDate(order.timestamp)} •{' '}
                {order.orderType === 'Take Away' || order.orderType === 'Parcel'
                  ? 'Parcel'
                  : order.orderType || 'Dine-in'}
              </Text>
            </View>
          </View>

          <View style={styles.historyCardTopRight}>
            <Text style={styles.historyCardTotalAmountText}>
              ₹{order.totalAmount}
            </Text>
            <View
              style={[
                styles.historyStatusBadge,
                isCompleted
                  ? styles.historyStatusBadgeCompleted
                  : isPreparing
                    ? styles.historyStatusBadgePreparing
                    : styles.historyStatusBadgeCancelled,
              ]}
            >
              <Text
                style={[
                  styles.historyStatusBadgeText,
                  isCompleted
                    ? styles.historyStatusBadgeTextCompleted
                    : isPreparing
                      ? styles.historyStatusBadgeTextPreparing
                      : styles.historyStatusBadgeTextCancelled,
                ]}
              >
                {isCompleted ? 'Done' : isPreparing ? 'Preparing' : 'Cancelled'}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Row: Left [ 👤 Name 📞 Phone ], Right [ Payment Badge ] */}
        <View style={styles.historyCustomerRow}>
          <Text style={styles.historyCustomerText} numberOfLines={1}>
            👤 {order.customerName?.trim() || 'Walk-in'}
            {order.customerPhone?.trim() ? `  📞 ${order.customerPhone.trim()}` : ''}
          </Text>

          <View
            style={[
              styles.historyPaymentBadge,
              order.paymentStatus === 'Completed'
                ? styles.historyPaymentBadgeCompleted
                : styles.historyPaymentBadgePending,
            ]}
          >
            <Text
              style={[
                styles.historyPaymentBadgeText,
                order.paymentStatus === 'Completed'
                  ? styles.historyPaymentBadgeTextCompleted
                  : styles.historyPaymentBadgeTextPending,
              ]}
            >
              {order.paymentStatus === 'Completed'
                ? `✓ ${order.paymentMethod || 'UPI'}`
                : order.paymentStatus === 'Partial'
                  ? `Due: ₹${order.balanceDue || 0}`
                  : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Itemized Dish Rows */}
        <View style={styles.historyCardDishesBox}>
          {order.items.map((dish, dIdx) => (
            <View key={dish.id || dIdx} style={styles.historyDishRow}>
              <View style={styles.historyDishLeft}>
                <VegBadge isVeg={dish.isVeg} size={11} />
                <Text style={styles.historyDishQtyText}>{dish.quantity}x</Text>
                <Text style={styles.historyDishNameText} numberOfLines={1}>
                  {dish.name}
                  {dish.isAddon && (
                    <Text style={styles.historyDishAddonTag}> (Add-on)</Text>
                  )}
                </Text>
              </View>
              <Text style={styles.historyDishPriceText}>
                ₹{dish.price * dish.quantity}
              </Text>
            </View>
          ))}

          {order.notes ? (
            <Text style={styles.historyCardNote}>
              Note: {order.notes}
            </Text>
          ) : null}
        </View>

        {/* Bottom Dual Action Buttons: [ 🧾 Print Customer Bill ] & [ 🖨️ Print Station KOTs ] */}
        <View style={styles.historyCardActionsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPrintCustomerBill(order)}
            style={styles.historyBtnBill}
          >
            <Receipt size={14} color={COLORS.forest} strokeWidth={2.2} />
            <Text style={styles.historyBtnBillText}>Print Customer Bill</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPrintStationKots(order)}
            style={styles.historyBtnKot}
          >
            <Printer size={14} color={COLORS.cream} strokeWidth={2.2} />
            <Text style={styles.historyBtnKotText}>Print Station KOTs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.order.id === nextProps.order.id &&
      prevProps.order.status === nextProps.order.status &&
      prevProps.order.paymentStatus === nextProps.order.paymentStatus &&
      prevProps.order.totalAmount === nextProps.order.totalAmount &&
      prevProps.order.amountPaid === nextProps.order.amountPaid &&
      prevProps.order.balanceDue === nextProps.order.balanceDue &&
      prevProps.order.items.length === nextProps.order.items.length
    );
  }
);
HistoryOrderCard.displayName = 'HistoryOrderCard';

export const AdminScreen: React.FC<AdminScreenProps> = ({ onMenuChanged }) => {
  const [currentView, setCurrentView] = useState<AdminView>('hub');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Menu Search & Category Filter (Menu Management)
  const [menuSearch, setMenuSearch] = useState('');
  const [menuManageCategory, setMenuManageCategory] = useState<string>('All');

  // Unified Dish Modal State (For Both Add New Dish & Edit Dish)
  const [dishModalVisible, setDishModalVisible] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishCategory, setDishCategory] = useState('Sushi');
  const [dishCustomCategory, setDishCustomCategory] = useState('');
  const [dishIsVeg, setDishIsVeg] = useState(true);
  const [dishDescription, setDishDescription] = useState('');
  const [dishImageUrl, setDishImageUrl] = useState('');
  const [dishIsAvailable, setDishIsAvailable] = useState(true);
  const [isSubmittingDish, setIsSubmittingDish] = useState(false);

  // Customer Directory State
  const [customerSearch, setCustomerSearch] = useState('');
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [sentHolidayPhones, setSentHolidayPhones] = useState<string[]>([]);

  // Dish Tally State
  const [dishTallySearch, setDishTallySearch] = useState('');

  const itemsSoldToday: ItemSalesSummary[] = useMemo(() => {
    const todayOrders = orders.filter((o) => isOrderFromToday(o.timestamp));
    return getItemsSoldSummary(todayOrders);
  }, [orders]);

  const filteredDishTally = useMemo(() => {
    if (!dishTallySearch.trim()) return itemsSoldToday;
    const q = dishTallySearch.trim().toLowerCase();
    return itemsSoldToday.filter((item) =>
      item.name.toLowerCase().includes(q)
    );
  }, [itemsSoldToday, dishTallySearch]);

  const uniqueCustomers: CustomerRecord[] = useMemo(() => {
    return extractUniqueCustomers(orders);
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return uniqueCustomers;
    const q = customerSearch.trim().toLowerCase();
    return uniqueCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [uniqueCustomers, customerSearch]);

  // Export State
  const [rangeOption, setRangeOption] = useState<DateRangeOption>('today');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateYYYYMMDD(d);
  });
  const [customEnd, setCustomEnd] = useState(() => formatDateYYYYMMDD(new Date()));
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | 'history'>('start');

  // All Orders History View State
  const [historyDateFilter, setHistoryDateFilter] = useState<
    'all' | 'today' | 'yesterday' | 'custom'
  >('all');
  const [historyCustomDate, setHistoryCustomDate] = useState<string>(() =>
    formatDateYYYYMMDD(new Date())
  );
  const [historySearch, setHistorySearch] = useState('');
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);

  // UPI Configuration State
  const [upiId, setUpiId] = useState('');
  const [merchantName, setMerchantName] = useState('Kōji');
  const [isUpiSaved, setIsUpiSaved] = useState(false);

  // Printer Settings State
  const [paperWidth, setPaperWidth] = useState<number>(48);
  const [autoPrintKot, setAutoPrintKot] = useState<boolean>(true);

  // Notification Channel Settings State
  const [notifyChannel, setNotifyChannel] = useState<NotificationChannel>('whatsapp_business');
  const [confirmModal, setConfirmModal] = useState<KojiConfirmModalProps | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Suppress developer menu floating gear button on Android dev builds
    try {
      const devMenu = requireOptionalNativeModule('DevMenuPreferences');
      devMenu?.setPreferencesAsync?.({ showFloatingActionButton: false });
    } catch {}

    const todayKey = formatDateYYYYMMDD(new Date());

    Promise.all([
      getMenuItems(),
      getOrders(),
      getUpiConfig(),
      getPaperWidthPreference(),
      getAutoPrintPreference(),
      getNotificationChannelPreference(),
      getHolidaySentPhones(todayKey),
    ])
      .then(([items, allOrders, upiCfg, pWidth, autoPrint, nChannel, sentPhones]) => {
        if (isMounted) {
          setMenuItems(items);
          setOrders(allOrders);
          setUpiId(upiCfg.upiId || '');
          setMerchantName(upiCfg.merchantName || 'Kōji');
          setPaperWidth(pWidth);
          setAutoPrintKot(autoPrint);
          setNotifyChannel(nChannel);
          setSentHolidayPhones(sentPhones);
        }
      })
      .catch(() => { });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshMenu = async () => {
    try {
      const items = await getMenuItems();
      setMenuItems(items);
    } catch { }
  };

  const refreshOrders = useCallback(async () => {
    try {
      const allOrders = await getOrders();
      setOrders(allOrders);
    } catch { }
  }, []);

  const navigateTo = (view: AdminView) => {
    try {
      Haptics.selectionAsync();
    } catch { }
    if (view === 'all_orders') {
      refreshOrders();
    }
    setCurrentView(view);
  };

  // Hook into native Android system hardware/gesture back button:
  // When inside an Admin sub-view, return to main Hub; on Hub, let default back behavior proceed.
  useEffect(() => {
    const onHardwareBackPress = () => {
      if (currentView !== 'hub') {
        try {
          Haptics.selectionAsync();
        } catch { }
        setCurrentView('hub');
        return true;
      }
      return false;
    };

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );

    return () => {
      backSubscription.remove();
    };
  }, [currentView]);

  const handlePrintCustomerBill = useCallback(async (order: Order) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { }
    await printCustomerReceipt(order, paperWidth);
  }, [paperWidth]);

  const handlePrintStationKots = useCallback(async (order: Order) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { }
    await printStationKots(order, paperWidth);
  }, [paperWidth]);

  const handleSaveUpiConfig = async () => {
    try {
      await saveUpiConfig({
        upiId: upiId.trim(),
        merchantName: merchantName.trim() || 'Kōji',
      });
      setIsUpiSaved(true);
      setConfirmModal({
        visible: true,
        variant: 'forest',
        badgeLabel: 'UPI Settings',
        title: 'UPI Settings Saved! 🎉',
        message: upiId.trim()
          ? `Dynamic QR payments are now linked to "${upiId.trim()}" (${merchantName.trim() || 'Kōji'}).`
          : 'UPI ID cleared. Cash payments remain enabled.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      setTimeout(() => setIsUpiSaved(false), 3000);
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Save Failed',
        title: 'Save Failed',
        message: err?.message || 'Could not save UPI configuration.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    }
  };

  const handleSelectPaperWidth = async (width: 48 | 32) => {
    try {
      Haptics.selectionAsync();
    } catch { }
    setPaperWidth(width);
    await setPaperWidthPreference(width);
    setConfirmModal({
      visible: true,
      variant: 'amber',
      badgeLabel: 'Printer / Service Notice',
      title: 'Paper Width Updated',
      message: `Thermal print formatting set to ${width === 48 ? '80mm (48 columns)' : '58mm (32 columns)'}.`,
      primaryLabel: 'OK',
      cancelLabel: '',
      onPrimaryPress: () => setConfirmModal(null),
      onClose: () => setConfirmModal(null),
    });
  };

  const handleToggleAutoPrint = async () => {
    try {
      Haptics.selectionAsync();
    } catch { }
    const newVal = !autoPrintKot;
    setAutoPrintKot(newVal);
    await setAutoPrintPreference(newVal);
  };

  const handleSelectNotificationChannel = async (channel: NotificationChannel) => {
    try {
      Haptics.selectionAsync();
    } catch { }
    setNotifyChannel(channel);
    await setNotificationChannelPreference(channel);
    const labels: Record<NotificationChannel, string> = {
      whatsapp_business: 'WhatsApp Business',
      whatsapp: 'Standard WhatsApp',
      sms: 'SMS (Offline)',
    };
    setConfirmModal({
      visible: true,
      variant: 'amber',
      badgeLabel: 'Printer / Service Notice',
      title: 'Notification Channel Updated',
      message: `Customer pickup alerts will now be dispatched via ${labels[channel]}.`,
      primaryLabel: 'OK',
      cancelLabel: '',
      onPrimaryPress: () => setConfirmModal(null),
      onClose: () => setConfirmModal(null),
    });
  };

  // Unified Dish Modal Openers & Handlers
  const handleOpenCreateDish = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }
    setEditingDish(null);
    setDishName('');
    setDishPrice('');
    setDishCategory('Sushi');
    setDishCustomCategory('');
    setDishIsVeg(true);
    setDishDescription('');
    setDishImageUrl('');
    setDishIsAvailable(true);
    setDishModalVisible(true);
  };

  const handleOpenEdit = (dish: MenuItem) => {
    try {
      Haptics.selectionAsync();
    } catch { }
    setEditingDish(dish);
    setDishName(dish.name);
    setDishPrice(String(dish.price));
    setDishCategory(STANDARD_CATEGORIES.includes(dish.category) ? dish.category : 'Sushi');
    setDishCustomCategory(STANDARD_CATEGORIES.includes(dish.category) ? '' : dish.category);
    setDishIsVeg(dish.isVeg);
    setDishDescription(dish.description || '');
    setDishImageUrl(dish.imageUrl || '');
    setDishIsAvailable(dish.isAvailable ?? true);
    setDishModalVisible(true);
  };

  const handleSaveDish = async () => {
    if (!dishName.trim()) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Missing Details',
        title: 'Required Field',
        message: 'Please enter a dish name.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }
    const numPrice = parseFloat(dishPrice.trim());
    if (isNaN(numPrice) || numPrice <= 0) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Missing Details',
        title: 'Required Field',
        message: 'Please enter a valid price in ₹.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    const finalCategory = dishCustomCategory.trim() || dishCategory.trim();
    if (!finalCategory) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Missing Details',
        title: 'Required Field',
        message: 'Category is strictly mandatory. Please select or enter a category.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    if (!editingDish && !dishDescription.trim()) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Missing Details',
        title: 'Required Field',
        message: 'Description is strictly mandatory. Please provide a brief description.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    setIsSubmittingDish(true);
    try {
      if (editingDish) {
        const updatedDish: MenuItem = {
          ...editingDish,
          name: dishName.trim(),
          price: numPrice,
          category: finalCategory,
          isVeg: dishIsVeg,
          description: dishDescription.trim() || editingDish.description,
          imageUrl: dishImageUrl.trim() || undefined,
          isAvailable: dishIsAvailable,
        };
        await updateMenuItem(updatedDish);
        setDishModalVisible(false);
        setEditingDish(null);
        await refreshMenu();
        onMenuChanged?.();
        setConfirmModal({
          visible: true,
          variant: 'forest',
          badgeLabel: 'Dish Updated',
          title: 'Dish Updated! 🎉',
          message: `"${updatedDish.name}" updated successfully.`,
          primaryLabel: 'OK',
          cancelLabel: '',
          onPrimaryPress: () => setConfirmModal(null),
          onClose: () => setConfirmModal(null),
        });
      } else {
        await addMenuItem({
          name: dishName.trim(),
          price: numPrice,
          category: finalCategory,
          isVeg: dishIsVeg,
          imageUrl: dishImageUrl.trim() || undefined,
          description: dishDescription.trim(),
          isAvailable: dishIsAvailable,
        });
        setDishModalVisible(false);
        await refreshMenu();
        onMenuChanged?.();
        setConfirmModal({
          visible: true,
          variant: 'forest',
          badgeLabel: 'Dish Published',
          title: 'Dish Published! 🎉',
          message: `"${dishName.trim()}" is now available in the cart POS menu under "${finalCategory}".`,
          primaryLabel: 'OK',
          cancelLabel: '',
          onPrimaryPress: () => setConfirmModal(null),
          onClose: () => setConfirmModal(null),
        });
      }
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: editingDish ? 'Update Failed' : 'Add Failed',
        title: editingDish ? 'Update Failed' : 'Add Failed',
        message: err?.message || 'Could not save dish.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    } finally {
      setIsSubmittingDish(false);
    }
  };

  const handleSyncPhoneContacts = async () => {
    if (uniqueCustomers.length === 0) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Customer Directory',
        title: 'No Customers Found',
        message: 'There are no customer contacts with phone numbers in the order history yet.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    try {
      setIsSyncingContacts(true);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
      const result = await syncCustomerContactsToPhone(uniqueCustomers);
      setConfirmModal({
        visible: true,
        variant: 'forest',
        badgeLabel: 'Contacts Synced',
        title: 'Contacts Synced! 📇',
        message: `Synced ${result.addedCount} new customer(s) to Phone Contacts (${result.skippedCount} already saved). Open WhatsApp Business -> New Broadcast -> search "Koji -" to message everyone at once!`,
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Sync Failed',
        title: 'Contacts Sync Error',
        message: err?.message || 'Could not sync contacts to phone.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const handleSendHolidayMessage = async (cust: CustomerRecord) => {
    try {
      try {
        Haptics.selectionAsync();
      } catch { }
      const greetingName =
        cust.name && cust.name.trim() && cust.name.trim() !== 'Guest'
          ? cust.name.trim()
          : 'there';
      const personalizedMsg = `Hey ${greetingName}! 🍣 Kōji is taking a short break and will be closed Today.\nWe’ll be back rolling fresh sushi and serving your favorites from tomorrow at our usual evening hours. See you soon!`;

      await openCustomerNotification(cust.phone, personalizedMsg);

      const todayKey = formatDateYYYYMMDD(new Date());
      const updated = await markHolidaySentPhone(todayKey, cust.phone);
      setSentHolidayPhones(updated);
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Dispatch Notice',
        title: 'Could Not Open WhatsApp',
        message: err?.message || 'Failed to open messaging app for this customer.',
        primaryLabel: 'Got It',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    }
  };

  const handleCopyHolidayMessage = async () => {
    try {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
      await Clipboard.setStringAsync(HOLIDAY_ANNOUNCEMENT_MSG);
      setConfirmModal({
        visible: true,
        variant: 'forest',
        badgeLabel: 'Holiday Broadcast',
        title: 'Message Copied! 📋',
        message: 'The official Kōji holiday closure announcement has been copied to your clipboard. Paste it into WhatsApp Broadcast or SMS.',
        highlightText: HOLIDAY_ANNOUNCEMENT_MSG,
        primaryLabel: 'Done',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Copy Failed',
        title: 'Clipboard Error',
        message: err?.message || 'Could not copy message to clipboard.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    }
  };

  // Toggle Availability
  const handleToggleAvailability = async (id: string) => {
    try {
      const updated = await toggleItemAvailability(id);
      setMenuItems(updated);
      onMenuChanged?.();
    } catch { }
  };

  // Delete Dish
  const handleDeleteDish = (dish: MenuItem) => {
    setConfirmModal({
      visible: true,
      variant: 'danger',
      badgeLabel: 'Delete Dish',
      title: 'Delete Dish?',
      message: 'Are you sure you want to delete this dish from the menu? Existing shift orders will not be affected.',
      highlightText: `${dish.name} (₹${dish.price})`,
      primaryLabel: 'Yes, Delete Dish',
      cancelLabel: 'Keep Dish',
      onPrimaryPress: async () => {
        setConfirmModal(null);
        const updated = await deleteMenuItem(dish.id);
        setMenuItems(updated);
        onMenuChanged?.();
      },
      onClose: () => setConfirmModal(null),
    });
  };

  // Reset Menu to Default Kōji Seed Items
  const handleResetMenu = () => {
    setConfirmModal({
      visible: true,
      variant: 'danger',
      badgeLabel: 'Reset Menu',
      title: 'Reset Menu to Default?',
      message:
        'This will restore all default Kōji items and wipe any custom dishes. Are you sure you want to reset?',
      primaryLabel: 'Yes, Reset Menu',
      cancelLabel: 'Keep Current Menu',
      onPrimaryPress: async () => {
        setConfirmModal(null);
        const resetItems = await resetMenuToDefault();
        setMenuItems(resetItems);
        onMenuChanged?.();
      },
      onClose: () => setConfirmModal(null),
    });
  };

  // Compute orders count for preview in Export Section
  const exportPreviewCount = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (rangeOption === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (rangeOption === '7days') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
    } else if (rangeOption === '30days') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
    } else if (rangeOption === 'all') {
      start = new Date(0);
      end = new Date(now.getTime());
    } else if (rangeOption === 'custom') {
      start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    }

    const filtered = orders.filter((o) => {
      const t = new Date(o.timestamp).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });

    const total = filtered.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { count: filtered.length, total };
  }, [orders, rangeOption, customStart, customEnd]);

  // Export Filtered PDF (Landscape A4 Table)
  const handleExportPdf = useCallback(async () => {
    if (exportPreviewCount.count === 0) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'No Orders',
        title: 'No Orders Found',
        message: 'No orders found for the selected period.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    setIsExportingPdf(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { }

    try {
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (rangeOption === 'custom') {
        const partsStart = customStart.split('-').map(Number);
        const partsEnd = customEnd.split('-').map(Number);
        if (partsStart.length === 3) {
          startDate = new Date(partsStart[0], partsStart[1] - 1, partsStart[2]);
        }
        if (partsEnd.length === 3) {
          endDate = new Date(partsEnd[0], partsEnd[1] - 1, partsEnd[2]);
        }
      }

      await exportOrdersReportPdf(rangeOption, startDate, endDate);
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Export Failed',
        title: 'PDF Export Failed',
        message: err?.message || 'Could not export PDF report.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    } finally {
      setIsExportingPdf(false);
    }
  }, [exportPreviewCount.count, rangeOption, customStart, customEnd]);

  // Export Filtered CSV (Excel-Compatible)
  const handleExportCsv = useCallback(async () => {
    if (exportPreviewCount.count === 0) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'No Orders',
        title: 'No Orders Found',
        message: 'No orders found for the selected period.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
      return;
    }

    setIsExportingCsv(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { }

    try {
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (rangeOption === 'custom') {
        const partsStart = customStart.split('-').map(Number);
        const partsEnd = customEnd.split('-').map(Number);
        if (partsStart.length === 3) {
          startDate = new Date(partsStart[0], partsStart[1] - 1, partsStart[2]);
        }
        if (partsEnd.length === 3) {
          endDate = new Date(partsEnd[0], partsEnd[1] - 1, partsEnd[2]);
        }
      }

      await exportOrdersReport(rangeOption, startDate, endDate);
    } catch (err: any) {
      setConfirmModal({
        visible: true,
        variant: 'amber',
        badgeLabel: 'Export Failed',
        title: 'CSV Export Failed',
        message: err?.message || 'Could not export CSV report.',
        primaryLabel: 'OK',
        cancelLabel: '',
        onPrimaryPress: () => setConfirmModal(null),
        onClose: () => setConfirmModal(null),
      });
    } finally {
      setIsExportingCsv(false);
    }
  }, [exportPreviewCount.count, rangeOption, customStart, customEnd]);

  // Filtered menu items for Menu Management (category pills + search)
  const filteredMenuItems = useMemo(() => {
    let list = menuItems;
    if (menuManageCategory !== 'All') {
      list = list.filter((m) => m.category === menuManageCategory);
    }
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [menuItems, menuManageCategory, menuSearch]);

  // Filtered orders for All Orders History View
  const filteredHistoryOrders = useMemo(() => {
    let list = [...orders];

    // 1. Date filter
    if (historyDateFilter === 'today') {
      list = list.filter((o) => isOrderFromToday(o.timestamp));
    } else if (historyDateFilter === 'yesterday') {
      list = list.filter((o) => {
        try {
          const d = new Date(o.timestamp);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          return (
            d.getFullYear() === yesterday.getFullYear() &&
            d.getMonth() === yesterday.getMonth() &&
            d.getDate() === yesterday.getDate()
          );
        } catch {
          return false;
        }
      });
    } else if (historyDateFilter === 'custom') {
      list = list.filter((o) => {
        try {
          const d = new Date(o.timestamp);
          return formatDateYYYYMMDD(d) === historyCustomDate;
        } catch {
          return false;
        }
      });
    }

    // 2. Search query filter (Token, Customer, Phone, Dish)
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter((o) => {
        const matchToken = o.token?.toLowerCase().includes(q);
        const matchName = o.customerName?.toLowerCase().includes(q);
        const matchPhone = o.customerPhone?.toLowerCase().includes(q);
        const matchDish = o.items.some((item) =>
          item.name.toLowerCase().includes(q)
        );
        return matchToken || matchName || matchPhone || matchDish;
      });
    }

    // 3. Sort newest first
    list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return list;
  }, [orders, historyDateFilter, historyCustomDate, historySearch]);

  const { filteredOrdersCount, filteredRevenue } = useMemo(() => {
    const totalCount = filteredHistoryOrders.length;
    const totalRevenue = filteredHistoryOrders.reduce((sum, order) => {
      const activeItemsTotal = (order.items || [])
        .filter((i) => i.status !== 'cancelled')
        .reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
      return sum + (activeItemsTotal || order.totalAmount || 0);
    }, 0);
    return { filteredOrdersCount: totalCount, filteredRevenue: totalRevenue };
  }, [filteredHistoryOrders]);

  const renderHistoryItem = useCallback(
    ({ item }: { item: Order }) => (
      <HistoryOrderCard
        order={item}
        onPrintCustomerBill={handlePrintCustomerBill}
        onPrintStationKots={handlePrintStationKots}
      />
    ),
    [handlePrintCustomerBill, handlePrintStationKots]
  );

  const historyKeyExtractor = useCallback((item: Order) => item.id, []);

  const historyHeader = useMemo(() => (
    <View style={styles.historyHeaderComponent}>
      {/* Search Bar */}
      <View style={styles.historySearchBar}>
        <Search size={16} color={COLORS.natural} />
        <TextInput
          style={styles.historySearchInput}
          placeholder="Search by token, customer, phone, dish..."
          placeholderTextColor={COLORS.natural}
          value={historySearch}
          onChangeText={setHistorySearch}
        />
        {historySearch.length > 0 && (
          <TouchableOpacity
            onPress={() => setHistorySearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={15} color={COLORS.natural} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date Filter Pills Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.historyDatePillsRow}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setHistoryDateFilter('all')}
          style={[
            styles.historyDatePill,
            historyDateFilter === 'all' && styles.historyDatePillActive,
          ]}
        >
          <Text
            style={[
              styles.historyDatePillText,
              historyDateFilter === 'all' && styles.historyDatePillTextActive,
            ]}
          >
            All Time
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setHistoryDateFilter('today')}
          style={[
            styles.historyDatePill,
            historyDateFilter === 'today' && styles.historyDatePillActive,
          ]}
        >
          <Text
            style={[
              styles.historyDatePillText,
              historyDateFilter === 'today' && styles.historyDatePillTextActive,
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setHistoryDateFilter('yesterday')}
          style={[
            styles.historyDatePill,
            historyDateFilter === 'yesterday' && styles.historyDatePillActive,
          ]}
        >
          <Text
            style={[
              styles.historyDatePillText,
              historyDateFilter === 'yesterday' && styles.historyDatePillTextActive,
            ]}
          >
            Yesterday
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            setDatePickerTarget('history');
            setIsDatePickerOpen(true);
          }}
          style={[
            styles.historyDatePill,
            historyDateFilter === 'custom' && styles.historyDatePillActive,
          ]}
        >
          <CalendarIcon
            size={12}
            color={
              historyDateFilter === 'custom' ? COLORS.cream : COLORS.forestGreen
            }
          />
          <Text
            style={[
              styles.historyDatePillText,
              historyDateFilter === 'custom' && styles.historyDatePillTextActive,
            ]}
          >
            {historyDateFilter === 'custom'
              ? historyCustomDate
              : 'Custom Date'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Summary Stats Card (Two Distinct Lines) */}
      <View style={styles.historySummaryBanner}>
        <View style={styles.historySummaryTextContainer}>
          <Text style={styles.historySummaryLine}>
            <Text style={styles.historySummaryLabel}>Total Orders : </Text>
            <Text style={styles.historySummaryValue}>{filteredOrdersCount}</Text>
          </Text>
          <Text style={styles.historySummaryLine}>
            <Text style={styles.historySummaryLabel}>Total Revenue : </Text>
            <Text style={styles.historySummaryValue}>
              ₹{filteredRevenue.toLocaleString('en-IN')}
            </Text>
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={refreshOrders}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.historyRefreshBtn}
        >
          <RotateCw size={13} color={COLORS.forestGreen} />
          <Text style={styles.historyRefreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [historySearch, historyDateFilter, historyCustomDate, filteredOrdersCount, filteredRevenue, refreshOrders]);

  const historyEmpty = useMemo(() => (
    <View style={styles.historyEmptyCard}>
      <Clock size={36} color={COLORS.natural} strokeWidth={1.5} />
      <Text style={styles.historyEmptyTitle}>No Orders Found</Text>
      <Text style={styles.historyEmptySubtitle}>
        {historySearch
          ? `No orders matching "${historySearch}"`
          : 'No orders recorded for this date filter.'}
      </Text>
    </View>
  ), [historySearch]);

  return (
    <View style={styles.container}>
      {/* Brand Header */}
      <BrandHeader subtitle="Cart Management Hub" />

      {/* Sub-view Header if inside sub-screens */}
      {currentView !== 'hub' && (
        <View style={styles.subviewNavHeader}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              try {
                Haptics.selectionAsync();
              } catch {}
              setCurrentView('hub');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.subviewBackBtn}
          >
            <ChevronLeft size={20} color={COLORS.forestGreen} strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.subviewNavTitle}>
            {currentView === 'dish_tally'
              ? 'Dish Tally'
              : currentView === 'menu_manage'
                ? 'Menu Management'
                : currentView === 'customer_directory'
                  ? 'Customer Directory'
                  : currentView === 'export'
                    ? 'Export Reports'
                    : currentView === 'all_orders'
                      ? 'Orders History'
                      : currentView === 'upi_setup'
                        ? 'UPI & QR Setup'
                        : currentView === 'printer_settings'
                          ? 'Printer Settings'
                          : 'Notification Settings'}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoider}
      >
        {currentView === 'all_orders' ? (
          <FlatList
            data={filteredHistoryOrders}
            keyExtractor={historyKeyExtractor}
            renderItem={renderHistoryItem}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            updateCellsBatchingPeriod={50}
            ListHeaderComponent={historyHeader}
            ListEmptyComponent={historyEmpty}
            style={styles.historyFlatList}
            contentContainerStyle={styles.historyFlatListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ========================================================= */}
            {/* VIEW 1: ADMIN HUB (ELEVATED DARK CARD-BASED HUB)          */}
            {/* ========================================================= */}
            {currentView === 'hub' && (
              <View style={styles.hubContainer}>
                <View style={styles.hubWelcomeBanner}>
                  <View>
                    <Text style={styles.hubWelcomeTitle}>Restaurant Operations</Text>
                    <Text style={styles.hubWelcomeSubtitle}>
                      {menuItems.length} active menu dishes • {orders.length} total orders recorded
                    </Text>
                  </View>


                  <Sparkles size={24} color={COLORS.apricot} />
                </View>



                {/* Feature Tile 1: UPI & QR Code Setup */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigateTo('upi_setup')}
                  style={styles.elevatedDarkCard}
                >
                  <View style={styles.cardLeftContent}>
                    <View style={styles.cardIconBadge}>
                      <Smartphone size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardMainTitle}>UPI & QR Code Setup</Text>
                      <Text style={styles.cardSubtitle}>
                        Manage UPI ID & dynamic payment QR
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={COLORS.forestGreen} strokeWidth={2.2} />
                </TouchableOpacity>

                {/* Feature Tile 2: Dish Tally */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigateTo('dish_tally')}
                  style={styles.elevatedDarkCard}
                >
                  <View style={styles.cardLeftContent}>
                    <View style={styles.cardIconBadge}>
                      <UtensilsCrossed size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardMainTitle}>Dish Tally</Text>
                      <Text style={styles.cardSubtitle}>
                        Shift item counts & quantities sold
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={COLORS.forestGreen} strokeWidth={2.2} />
                </TouchableOpacity>

                {/* Feature Tile 3: Menu Management */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigateTo('menu_manage')}
                  style={styles.elevatedDarkCard}
                >
                  <View style={styles.cardLeftContent}>
                    <View style={styles.cardIconBadge}>
                      <UtensilsCrossed size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardMainTitle}>Menu Management</Text>
                      <Text style={styles.cardSubtitle}>
                        View, edit prices, or toggle availability
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={COLORS.forestGreen} strokeWidth={2.2} />
                </TouchableOpacity>

                {/* Feature Tile 4: Customer Directory */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigateTo('customer_directory')}
                  style={styles.elevatedDarkCard}
                >
                  <View style={styles.cardLeftContent}>
                    <View style={styles.cardIconBadge}>
                      <Users size={22} color={COLORS.forest} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardMainTitle}>Customer Directory</Text>
                      <Text style={styles.cardSubtitle}>
                        Sync phone contacts & send holiday updates
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={COLORS.forestGreen} strokeWidth={2.2} />
                </TouchableOpacity>

                {/* Feature Tile 5: Export Report */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigateTo('export')}
                  style={styles.elevatedDarkCard}
                >
                  <View style={styles.cardLeftContent}>
                    <View style={styles.cardIconBadge}>
                      <FileSpreadsheet size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardMainTitle}>Export Report</Text>
                      <Text style={styles.cardSubtitle}>
                        Download order history PDF & CSV
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={COLORS.forestGreen} strokeWidth={2.2} />
                </TouchableOpacity>

                {/* Feature Tile 6: Order History */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigateTo('all_orders')}
                  style={styles.elevatedDarkCard}
                >
                  <View style={styles.cardLeftContent}>
                    <View style={styles.cardIconBadge}>
                      <History size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardMainTitle}>Order History</Text>
                      <Text style={styles.cardSubtitle}>
                        Full shift history, dates & receipts
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={COLORS.forestGreen} strokeWidth={2.2} />
                </TouchableOpacity>

                {/* Feature Tile 7: Printer Settings */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigateTo('printer_settings')}
                  style={styles.elevatedDarkCard}
                >
                  <View style={styles.cardLeftContent}>
                    <View style={styles.cardIconBadge}>
                      <Printer size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardMainTitle}>Printer Settings</Text>
                      <Text style={styles.cardSubtitle}>
                        Paper width (80mm / 58mm) & RawBT setup
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={COLORS.forestGreen} strokeWidth={2.2} />
                </TouchableOpacity>

                {/* Feature Tile 8: Notification Channel */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigateTo('notification_settings')}
                  style={styles.elevatedDarkCard}
                >
                  <View style={styles.cardLeftContent}>
                    <View style={styles.cardIconBadge}>
                      <MessageSquare size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardMainTitle}>Notification Channel</Text>
                      <Text style={styles.cardSubtitle}>
                        {notifyChannel === 'whatsapp_business'
                          ? 'WhatsApp Business (Default / Cart SIM)'
                          : notifyChannel === 'whatsapp'
                            ? 'Standard WhatsApp'
                            : 'SMS (Offline Text Messaging)'}
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={20} color={COLORS.forestGreen} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* VIEW: DISH TALLY SUB-SCREEN                                */}
            {/* ========================================================= */}
            {currentView === 'dish_tally' && (
              <View style={styles.dishTallyContainer}>
                {/* Live Shift Summary Note Banner */}
                <View style={styles.dishTallySummaryBanner}>
                  <View style={styles.dishTallySummaryHeaderRow}>
                    <Info size={15} color={COLORS.forestGreen} strokeWidth={2.4} />
                    <Text style={styles.dishTallySummaryTitle}>Today&apos;s Shift Summary</Text>
                  </View>
                  <Text style={styles.dishTallySummaryText}>
                    Real-time tally of all items ordered and prepared during today&apos;s service, ranked descending by quantity sold.
                  </Text>
                </View>

                {/* Top Search Bar */}
                <View style={styles.dishTallySearchBar}>
                  <Search size={16} color={COLORS.natural} />
                  <TextInput
                    style={styles.dishTallySearchInput}
                    placeholder="Search dishes (e.g. Crispy Chicken)..."
                    placeholderTextColor={COLORS.textMuted}
                    value={dishTallySearch}
                    onChangeText={setDishTallySearch}
                  />
                  {dishTallySearch.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setDishTallySearch('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={14} color={COLORS.slate} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* 3-Column Minimal Table: Sr. No. | Dish Name | Count */}
                <View style={styles.dishTallyTable}>
                  <View style={styles.dishTallyTableHeader}>
                    <Text style={styles.dishTallyColSrHeader}>Sr. No.</Text>
                    <Text style={styles.dishTallyColNameHeader}>Dish Name</Text>
                    <Text style={styles.dishTallyColCountHeader}>Count</Text>
                  </View>

                  {filteredDishTally.length > 0 ? (
                    filteredDishTally.map((dish, idx) => {
                      const isLast = idx === filteredDishTally.length - 1;
                      return (
                        <View
                          key={dish.id || dish.name}
                          style={[
                            styles.dishTallyTableRow,
                            isLast && styles.dishTallyTableRowLast,
                            idx % 2 === 1 && styles.dishTallyTableRowAlt,
                          ]}
                        >
                          <Text style={styles.dishTallyColSr}>{idx + 1}</Text>
                          <Text style={styles.dishTallyColName}>
                            {dish.name}
                          </Text>
                          <View style={styles.dishTallyCountBadge}>
                            <Text style={styles.dishTallyColCount}>{dish.quantitySold}</Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.dishTallyEmptyBox}>
                      <Text style={styles.dishTallyEmptyText}>
                        {dishTallySearch
                          ? `No dishes matching "${dishTallySearch}"`
                          : 'No dishes sold yet today in this shift.'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* VIEW 2: MENU MANAGEMENT SUB-SCREEN                        */}
            {/* ========================================================= */}
            {currentView === 'menu_manage' && (
              <View>
                {/* Top Action & Search Bar */}
                <View style={styles.menuManageHeaderRow}>
                  <View style={styles.menuSearchBar}>
                    <Search size={16} color={COLORS.natural} />
                    <TextInput
                      style={styles.menuSearchInput}
                      placeholder="Search dishes by name or category..."
                      placeholderTextColor={COLORS.natural}
                      value={menuSearch}
                      onChangeText={setMenuSearch}
                    />
                  </View>



                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleResetMenu}
                    style={styles.resetMenuBtn}
                  >
                    <RotateCw size={14} color={COLORS.danger} strokeWidth={2.4} />
                    <Text style={styles.resetMenuBtnText}>Reset</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleOpenCreateDish}
                    style={styles.primaryNewDishBtn}
                  >
                    <Plus size={15} color={COLORS.canvas} strokeWidth={2.6} />
                    <Text style={styles.primaryNewDishBtnText}>New</Text>
                  </TouchableOpacity>
                </View>



                {/* Menu Category Filter Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.manageCategoryPillsRow}
                >
                  {['All', ...STANDARD_CATEGORIES].map((cat) => {
                    const isSelected = menuManageCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        activeOpacity={0.8}
                        onPress={() => {
                          try {
                            Haptics.selectionAsync();
                          } catch { }
                          setMenuManageCategory(cat);
                        }}
                        style={[
                          styles.manageCategoryPill,
                          isSelected && styles.manageCategoryPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.manageCategoryPillText,
                            isSelected && styles.manageCategoryPillTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Dishes List */}
                {filteredMenuItems.map((dish) => {
                  const isAvailable = dish.isAvailable ?? true;
                  return (
                    <View key={dish.id} style={styles.manageDishCard}>
                      <View style={styles.manageDishLeft}>
                        <View style={styles.manageDishThumbWrapper}>
                          {dish.imageUrl ? (
                            <Image
                              source={{ uri: dish.imageUrl }}
                              style={styles.manageDishThumb}
                              resizeMode="cover"
                            />
                          ) : (
                            <UtensilsCrossed size={20} color={COLORS.natural} />
                          )}
                          {!isAvailable && (
                            <View style={styles.soldOutOverlayBadge}>
                              <Text style={styles.soldOutOverlayText}>OUT</Text>
                            </View>


                          )}
                        </View>



                        <View style={styles.manageDishInfo}>
                          <View style={styles.manageDishBadgeRow}>
                            <VegBadge isVeg={dish.isVeg} size={12} />
                            <Text style={styles.manageDishCat}>{dish.category}</Text>
                          </View>


                          <Text
                            style={[
                              styles.manageDishName,
                              !isAvailable && styles.textLineThrough,
                            ]}
                            numberOfLines={1}
                          >
                            {dish.name}
                          </Text>
                          <Text style={styles.manageDishPrice}>₹{dish.price}</Text>
                        </View>


                      </View>



                      <View style={styles.manageDishRightActions}>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleToggleAvailability(dish.id)}
                          style={[
                            styles.stockToggleBtn,
                            isAvailable ? styles.stockIn : styles.stockOut,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stockToggleBtnText,
                              isAvailable ? styles.stockInText : styles.stockOutText,
                            ]}
                          >
                            {isAvailable ? 'In Stock' : 'Sold Out'}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.dishIconButtonsGroup}>
                          <TouchableOpacity
                            onPress={() => handleOpenEdit(dish)}
                            style={styles.actionIconPill}
                          >
                            <Edit2 size={14} color={COLORS.organic} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDeleteDish(dish)}
                            style={styles.actionIconPill}
                          >
                            <Trash2 size={14} color={COLORS.danger} />
                          </TouchableOpacity>
                        </View>


                      </View>


                    </View>


                  );
                })}
              </View>
            )}

            {/* ========================================================= */}
            {/* VIEW 3: CUSTOMER DIRECTORY & PHONE SYNC SUB-SCREEN        */}
            {/* ========================================================= */}
            {currentView === 'customer_directory' && (
              <View style={styles.customerContainer}>
                {/* Hero Summary & Action Buttons Card */}
                <View style={styles.customerHeroCard}>
                  <View style={styles.customerHeroHeader}>
                    <View style={styles.cardIconBadge}>
                      <Users size={20} color={COLORS.forest} strokeWidth={2.2} />
                    </View>
                    <View style={styles.customerHeroTitleStack}>
                      <Text style={styles.customerHeroTitle}>Deduplicated Directory</Text>
                      <Text style={styles.customerHeroSubtitle}>
                        Compiled from active shift & saved orders
                      </Text>
                    </View>
                  </View>

                  {/* Dual Action Buttons: Sync Contacts & Copy Text */}
                  <View style={styles.customerHeroActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleSyncPhoneContacts}
                      disabled={isSyncingContacts || uniqueCustomers.length === 0}
                      style={[
                        styles.customerHeroPrimaryBtn,
                        (isSyncingContacts || uniqueCustomers.length === 0) && styles.btnDisabled,
                      ]}
                    >
                      <UserPlus size={16} color={COLORS.white} strokeWidth={2.2} />
                      <Text style={styles.customerHeroPrimaryBtnText} numberOfLines={1}>
                        {isSyncingContacts ? 'Syncing...' : 'Sync Contacts'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleCopyHolidayMessage}
                      style={styles.customerHeroSecondaryBtn}
                    >
                      <Copy size={16} color={COLORS.forest} strokeWidth={2.2} />
                      <Text style={styles.customerHeroSecondaryBtnText} numberOfLines={1}>
                        Copy Text
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Search Bar */}
                <View style={styles.customerSearchBar}>
                  <Search size={16} color={COLORS.slate} strokeWidth={2.2} />
                  <TextInput
                    style={styles.customerSearchInput}
                    placeholder="Search by customer name or 10-digit phone..."
                    placeholderTextColor={COLORS.slate}
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    clearButtonMode="while-editing"
                  />
                  {customerSearch.length > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setCustomerSearch('')}
                      style={styles.customerSearchClearBtn}
                    >
                      <X size={14} color={COLORS.slate} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Section Header with Count Hint */}
                <View style={styles.customerListHeaderRow}>
                  <Text style={styles.customerListSectionTitle}>
                    CUSTOMER LIST ({filteredCustomers.length})
                  </Text>
                  <Text style={styles.customerListCountHint}>
                    Sorted by visit frequency
                  </Text>
                </View>

                {/* Customer List */}
                {filteredCustomers.length === 0 ? (
                  <View style={styles.customerEmptyCard}>
                    <Users size={32} color={COLORS.slate} strokeWidth={1.8} />
                    <Text style={styles.customerEmptyTitle}>No Customers Found</Text>
                    <Text style={styles.customerEmptySubtitle}>
                      {customerSearch
                        ? `No match found for "${customerSearch}". Try a different name or phone number.`
                        : 'No saved orders with customer phone numbers recorded yet.'}
                    </Text>
                  </View>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isSent = sentHolidayPhones.includes(cust.phone);
                    const initial =
                      cust.name && cust.name !== 'Guest'
                        ? cust.name.charAt(0).toUpperCase()
                        : 'G';
                    return (
                      <View key={cust.phone} style={styles.customerRowCard}>
                        {/* Left Section: Avatar + Name & Phone Stack */}
                        <View style={styles.customerRowLeft}>
                          <View style={styles.customerAvatar}>
                            <Text style={styles.customerAvatarText}>{initial}</Text>
                          </View>
                          <View style={styles.customerInfoCol}>
                            <Text style={styles.customerNameText} numberOfLines={1}>
                              {cust.name}
                            </Text>
                            <Text
                              style={styles.customerPhoneText}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.85}
                            >
                              +91 {cust.phone}
                            </Text>
                          </View>
                        </View>

                        {/* Right Section: Compact Order Count Pill & WhatsApp Send/Sent Button */}
                        <View style={styles.customerRowRight}>
                          <View style={styles.customerVisitBadge}>
                            <Text style={styles.customerVisitBadgeText} numberOfLines={1}>
                              {cust.visitCount} {cust.visitCount === 1 ? 'Order' : 'Orders'}
                            </Text>
                          </View>

                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => handleSendHolidayMessage(cust)}
                            style={[
                              styles.customerSendBtn,
                              isSent && styles.customerSendBtnSent,
                            ]}
                          >
                            {isSent ? (
                              <>
                                <Check size={12} color={COLORS.forest} strokeWidth={2.4} />
                                <Text style={styles.customerSendBtnTextSent} numberOfLines={1}>
                                  Sent
                                </Text>
                              </>
                            ) : (
                              <>
                                <MessageSquare size={12} color={COLORS.forest} strokeWidth={2.2} />
                                <Text style={styles.customerSendBtnText} numberOfLines={1}>
                                  Send
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ========================================================= */}
            {/* VIEW 4: EXPORT REPORTS SUB-SCREEN                         */}
            {/* ========================================================= */}
            {currentView === 'export' && (
              <View style={styles.cardSurface}>
                <View style={styles.cardSurfaceHeader}>
                  <View style={styles.cardHeaderLeftGroup}>
                    <FileSpreadsheet size={18} color={COLORS.apricot} />
                    <Text style={styles.cardSurfaceTitle}>EXPORT SALES DATA</Text>
                  </View>
                </View>

                <Text style={styles.exportDesc}>
                  Generate a formatted Landscape A4 PDF table or an Excel-compatible CSV report of your sales orders.
                </Text>

                {/* Date Range Selector */}
                <Text style={styles.fieldLabel}>Select Report Date Range</Text>
                <View style={styles.rangeOptionsGrid}>
                  {(['today', '7days', 'custom', 'all'] as DateRangeOption[]).map((opt) => {
                    const isSelected = rangeOption === opt;
                    const labels: Record<DateRangeOption, string> = {
                      today: 'Today',
                      '7days': 'Last 7 Days',
                      custom: 'Custom Range',
                      all: 'All Time',
                      '30days': 'Last 30 Days',
                    };

                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => {
                          try {
                            Haptics.selectionAsync();
                          } catch { }
                          setRangeOption(opt);
                        }}
                        style={[
                          styles.rangeChip,
                          isSelected && styles.rangeChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.rangeChipText,
                            isSelected && styles.rangeChipTextSelected,
                          ]}
                        >
                          {labels[opt]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Range Date Pickers */}
                {rangeOption === 'custom' && (
                  <View style={styles.customDateWrapper}>
                    <View style={styles.rowTwoCols}>
                      <View style={styles.colFlex}>
                        <Text style={styles.fieldLabel}>Start Date</Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setDatePickerTarget('start');
                            setIsDatePickerOpen(true);
                          }}
                          style={styles.datePickerTriggerBtn}
                        >
                          <CalendarIcon size={15} color={COLORS.apricot} />
                          <Text style={styles.datePickerTriggerText}>
                            {formatDateClean(customStart)}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.colFlex}>
                        <Text style={styles.fieldLabel}>End Date</Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setDatePickerTarget('end');
                            setIsDatePickerOpen(true);
                          }}
                          style={styles.datePickerTriggerBtn}
                        >
                          <CalendarIcon size={15} color={COLORS.apricot} />
                          <Text style={styles.datePickerTriggerText}>
                            {formatDateClean(customEnd)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {/* Report Summary Preview */}
                <View style={styles.exportPreviewBox}>
                  <View style={styles.previewMetricItem}>
                    <Text style={styles.previewMetricLabel}>Matching Orders</Text>
                    <Text style={styles.previewMetricValue}>{exportPreviewCount.count}</Text>
                  </View>

                  <View style={styles.previewDivider} />

                  <View style={styles.previewMetricItem}>
                    <Text style={styles.previewMetricLabel}>Total Revenue</Text>
                    <Text style={styles.previewMetricValueHighlight}>
                      ₹{exportPreviewCount.total}
                    </Text>
                  </View>
                </View>

                {/* Empty State Banner when 0 matching orders */}
                {exportPreviewCount.count === 0 && (
                  <View style={styles.exportEmptyBanner}>
                    <AlertCircle size={16} color={COLORS.natural} strokeWidth={2} />
                    <Text style={styles.exportEmptyBannerText}>
                      No orders found for the selected period.
                    </Text>
                  </View>
                )}

                {/* Export Action Buttons: PDF (Primary) & CSV (Secondary Outlined) */}
                <View style={styles.exportActionButtonsRow}>
                  {/* Primary Forest Green: Export PDF */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleExportPdf}
                    disabled={isExportingPdf || exportPreviewCount.count === 0}
                    style={[
                      styles.primaryPdfExportBtn,
                      (isExportingPdf || exportPreviewCount.count === 0) && styles.btnDisabled,
                    ]}
                  >
                    <FileText size={18} color={COLORS.cream} strokeWidth={2.4} />
                    <Text style={styles.primaryPdfExportBtnText}>
                      {isExportingPdf ? 'Generating PDF...' : 'Export PDF'}
                    </Text>
                  </TouchableOpacity>

                  {/* Secondary Outlined: Export CSV */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleExportCsv}
                    disabled={isExportingCsv || exportPreviewCount.count === 0}
                    style={[
                      styles.secondaryCsvExportBtn,
                      (isExportingCsv || exportPreviewCount.count === 0) && styles.btnDisabled,
                    ]}
                  >
                    <FileSpreadsheet size={18} color={COLORS.forestGreen} strokeWidth={2.2} />
                    <Text style={styles.secondaryCsvExportBtnText}>
                      {isExportingCsv ? 'Generating CSV...' : 'Export CSV'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* VIEW 5: UPI & QR PAYMENT SETUP SUB-SCREEN                 */}
            {/* ========================================================= */}
            {currentView === 'upi_setup' && (
              <View style={styles.subviewCardContainer}>
                <View style={styles.upiConfigCard}>
                  <View style={styles.upiCardHeader}>
                    <View style={styles.cardIconBadge}>
                      <Smartphone size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>
                    <View style={styles.upiCardHeaderTextGroup}>
                      <Text style={styles.cardMainTitle}>UPI & QR Payment Setup</Text>
                      <Text style={styles.cardSubtitle}>
                        Configure VPA for dynamic checkout QR codes
                      </Text>
                    </View>
                  </View>

                  <View style={styles.upiFormContent}>
                    {/* Merchant Name Input */}
                    <View style={styles.upiInputGroup}>
                      <Text style={styles.upiInputLabel}>MERCHANT DISPLAY NAME</Text>
                      <TextInput
                        style={styles.upiInput}
                        placeholder="Kōji"
                        placeholderTextColor={COLORS.natural}
                        value={merchantName}
                        onChangeText={setMerchantName}
                      />
                    </View>

                    {/* UPI ID (VPA) Input */}
                    <View style={styles.upiInputGroup}>
                      <Text style={styles.upiInputLabel}>UPI ID (VPA)</Text>
                      <TextInput
                        style={styles.upiInput}
                        placeholder="e.g. koji@okicici or 9876543210@paytm"
                        placeholderTextColor={COLORS.natural}
                        value={upiId}
                        onChangeText={setUpiId}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                      />
                    </View>

                    {/* Live Miniature Test QR Preview */}
                    <View style={styles.upiPreviewContainer}>
                      <View style={styles.upiPreviewLeft}>
                        {upiId.trim() ? (
                          <View style={styles.miniQrBox}>
                            <QRCode
                              value={`upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(merchantName.trim() || 'Kōji')}&cu=INR`}
                              size={76}
                              color={COLORS.organic}
                              backgroundColor={COLORS.white}
                            />
                          </View>
                        ) : (
                          <View style={styles.miniQrPlaceholder}>
                            <QrCode size={26} color={COLORS.natural} />
                            <Text style={styles.miniQrPlaceholderText}>Enter VPA</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.upiPreviewRight}>
                        <Text style={styles.upiPreviewTitle}>Live Test QR Preview</Text>
                        <Text style={styles.upiPreviewSubtitle}>
                          {upiId.trim()
                            ? `Scannable VPA: ${upiId.trim()}\nName: ${merchantName.trim() || 'Kōji'}`
                            : 'Enter your UPI ID above to verify and test dynamic QR generation.'}
                        </Text>
                        {upiId.trim() ? (
                          <View style={styles.upiVerifiedBadge}>
                            <CheckCircle2 size={11} color={COLORS.veg} />
                            <Text style={styles.upiVerifiedBadgeText}>QR Ready</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleSaveUpiConfig}
                      style={[
                        styles.upiSaveBtn,
                        isUpiSaved && styles.upiSaveBtnSuccess,
                      ]}
                    >
                      <CheckCircle2 size={16} color={COLORS.cream} strokeWidth={2.4} />
                      <Text style={styles.upiSaveBtnText}>
                        {isUpiSaved ? 'UPI Settings Saved! ✓' : 'Save UPI Settings'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* VIEW 6: PRINTER SETTINGS SUB-SCREEN                       */}
            {/* ========================================================= */}
            {currentView === 'printer_settings' && (
              <View style={styles.subviewCardContainer}>
                <View style={styles.upiConfigCard}>
                  <View style={styles.upiCardHeader}>
                    <View style={styles.cardIconBadge}>
                      <Printer size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>
                    <View style={styles.upiCardHeaderTextGroup}>
                      <Text style={styles.cardMainTitle}>Thermal Printer Settings</Text>
                      <Text style={styles.cardSubtitle}>
                        Configure receipt & station KOT paper formatting
                      </Text>
                    </View>
                  </View>

                  <View style={styles.printerSettingsBody}>
                    {/* Section 1: Paper Width Selector */}
                    <View style={styles.printerSettingSection}>
                      <Text style={styles.printerSectionLabel}>THERMAL PAPER WIDTH</Text>
                      <Text style={styles.printerSectionSub}>
                        Select your Bluetooth/USB POS printer paper size:
                      </Text>

                      <View style={styles.paperWidthOptionsRow}>
                        {/* 80mm Option */}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleSelectPaperWidth(48)}
                          style={[
                            styles.paperWidthOptionCard,
                            paperWidth === 48 && styles.paperWidthOptionCardActive,
                          ]}
                        >
                          <View style={styles.paperWidthCardTop}>
                            <Text
                              style={[
                                styles.paperWidthOptionTitle,
                                paperWidth === 48 && styles.paperWidthOptionTitleActive,
                              ]}
                            >
                              80 mm
                            </Text>
                            <View style={styles.paperWidthDefaultBadge}>
                              <Text style={styles.paperWidthDefaultBadgeText}>Recommended</Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.paperWidthOptionDesc,
                              paperWidth === 48 && styles.paperWidthOptionDescActive,
                            ]}
                          >
                            48 columns width • Full dish names & clean tabular spacing
                          </Text>
                          {paperWidth === 48 && (
                            <View style={styles.paperWidthCheckCircle}>
                              <Check size={14} color={COLORS.white} strokeWidth={2.6} />
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* 58mm Option */}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleSelectPaperWidth(32)}
                          style={[
                            styles.paperWidthOptionCard,
                            paperWidth === 32 && styles.paperWidthOptionCardActive,
                          ]}
                        >
                          <View style={styles.paperWidthCardTop}>
                            <Text
                              style={[
                                styles.paperWidthOptionTitle,
                                paperWidth === 32 && styles.paperWidthOptionTitleActive,
                              ]}
                            >
                              58 mm
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.paperWidthOptionDesc,
                              paperWidth === 32 && styles.paperWidthOptionDescActive,
                            ]}
                          >
                            32 columns width • Compact pocket printers
                          </Text>
                          {paperWidth === 32 && (
                            <View style={styles.paperWidthCheckCircle}>
                              <Check size={14} color={COLORS.white} strokeWidth={2.6} />
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Section 2: RawBT App Configuration Helper */}
                    <View style={styles.rawbtHelperBox}>
                      <View style={styles.rawbtHelperHeader}>
                        <AlertCircle size={16} color={COLORS.forestGreen} />
                        <Text style={styles.rawbtHelperTitle}>RawBT Configuration Tip</Text>
                      </View>
                      <Text style={styles.rawbtHelperText}>
                        {paperWidth === 48
                          ? 'Ensure RawBT App -> Settings -> Paper Width is set to 80mm (576px).'
                          : 'Ensure RawBT App -> Settings -> Paper Width is set to 58mm (384px).'}
                      </Text>
                      <Text style={styles.rawbtHelperSubText}>
                        This guarantees zero mid-line word wraps and crisp edge-to-edge printing.
                      </Text>
                    </View>

                    {/* Section 3: Auto-Print Station KOTs Toggle */}
                    <View style={styles.autoPrintRow}>
                      <View style={styles.autoPrintTextGroup}>
                        <Text style={styles.autoPrintTitle}>Auto-Print Station KOTs</Text>
                        <Text style={styles.autoPrintSubtitle}>
                          Dispatch station slips via RawBT automatically when placing an order
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleToggleAutoPrint}
                        style={[
                          styles.autoPrintToggleTrack,
                          autoPrintKot && styles.autoPrintToggleTrackActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.autoPrintToggleThumb,
                            autoPrintKot && styles.autoPrintToggleThumbActive,
                          ]}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* VIEW 7: NOTIFICATION SETTINGS SUB-SCREEN                  */}
            {/* ========================================================= */}
            {currentView === 'notification_settings' && (
              <View style={styles.subviewCardContainer}>
                <View style={styles.upiConfigCard}>
                  <View style={styles.upiCardHeader}>
                    <View style={styles.cardIconBadge}>
                      <MessageSquare size={22} color={COLORS.forestGreen} strokeWidth={2.2} />
                    </View>
                    <View style={styles.upiCardHeaderTextGroup}>
                      <Text style={styles.cardMainTitle}>Customer Notifications</Text>
                      <Text style={styles.cardSubtitle}>
                        Configure how order ready & pickup alerts are dispatched
                      </Text>
                    </View>
                  </View>

                  <View style={styles.printerSettingsBody}>
                    {/* Section 1: Default Notification Channel Selector */}
                    <View style={styles.printerSettingSection}>
                      <Text style={styles.printerSectionLabel}>DEFAULT DISPATCH CHANNEL</Text>
                      <Text style={styles.printerSectionSub}>
                        Select your preferred app for sending customer order alerts:
                      </Text>

                      <View style={styles.paperWidthOptionsRow}>
                        {/* Option 1: WhatsApp Business */}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleSelectNotificationChannel('whatsapp_business')}
                          style={[
                            styles.paperWidthOptionCard,
                            notifyChannel === 'whatsapp_business' && styles.paperWidthOptionCardActive,
                          ]}
                        >
                          <View style={styles.paperWidthCardTop}>
                            <Text
                              style={[
                                styles.paperWidthOptionTitle,
                                notifyChannel === 'whatsapp_business' && styles.paperWidthOptionTitleActive,
                              ]}
                            >
                              WhatsApp Business
                            </Text>
                            <View style={styles.paperWidthDefaultBadge}>
                              <Text style={styles.paperWidthDefaultBadgeText}>Recommended</Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.paperWidthOptionDesc,
                              notifyChannel === 'whatsapp_business' && styles.paperWidthOptionDescActive,
                            ]}
                          >
                            Direct Android Intent launch via com.whatsapp.w4b • Bypasses system app chooser for fast single-tap customer messaging on the cart device.
                          </Text>
                          {notifyChannel === 'whatsapp_business' && (
                            <View style={styles.paperWidthCheckCircle}>
                              <Check size={14} color={COLORS.white} strokeWidth={2.6} />
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Option 2: Standard WhatsApp */}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleSelectNotificationChannel('whatsapp')}
                          style={[
                            styles.paperWidthOptionCard,
                            notifyChannel === 'whatsapp' && styles.paperWidthOptionCardActive,
                          ]}
                        >
                          <View style={styles.paperWidthCardTop}>
                            <Text
                              style={[
                                styles.paperWidthOptionTitle,
                                notifyChannel === 'whatsapp' && styles.paperWidthOptionTitleActive,
                              ]}
                            >
                              Standard WhatsApp
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.paperWidthOptionDesc,
                              notifyChannel === 'whatsapp' && styles.paperWidthOptionDescActive,
                            ]}
                          >
                            Direct Android Intent launch via com.whatsapp • For operators using regular personal WhatsApp on the tablet or phone.
                          </Text>
                          {notifyChannel === 'whatsapp' && (
                            <View style={styles.paperWidthCheckCircle}>
                              <Check size={14} color={COLORS.white} strokeWidth={2.6} />
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Option 3: SMS (Offline) */}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleSelectNotificationChannel('sms')}
                          style={[
                            styles.paperWidthOptionCard,
                            notifyChannel === 'sms' && styles.paperWidthOptionCardActive,
                          ]}
                        >
                          <View style={styles.paperWidthCardTop}>
                            <Text
                              style={[
                                styles.paperWidthOptionTitle,
                                notifyChannel === 'sms' && styles.paperWidthOptionTitleActive,
                              ]}
                            >
                              SMS (Offline Text)
                            </Text>
                            <View style={[styles.paperWidthDefaultBadge, { backgroundColor: COLORS.sage }]}>
                              <Text style={[styles.paperWidthDefaultBadgeText, { color: COLORS.slate }]}>
                                No Internet
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.paperWidthOptionDesc,
                              notifyChannel === 'sms' && styles.paperWidthOptionDescActive,
                            ]}
                          >
                            Opens device SMS messenger with pre-composed order pickup text • Works offline without data connectivity.
                          </Text>
                          {notifyChannel === 'sms' && (
                            <View style={styles.paperWidthCheckCircle}>
                              <Check size={14} color={COLORS.white} strokeWidth={2.6} />
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Section 2: Fallback Assurance Helper Box */}
                    <View style={styles.rawbtHelperBox}>
                      <View style={styles.rawbtHelperHeader}>
                        <AlertCircle size={16} color={COLORS.forestGreen} />
                        <Text style={styles.rawbtHelperTitle}>Automatic Fallback Protection</Text>
                      </View>
                      <Text style={styles.rawbtHelperText}>
                        If WhatsApp Business is not installed or unreachable, Kōji automatically falls back to Standard WhatsApp, and offers an instant one-tap SMS alert so no customer is ever missed.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Unified Add / Edit Dish Modal */}
      <Modal
        visible={dishModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setDishModalVisible(false);
          setEditingDish(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoider}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingDish ? 'Edit Dish' : 'Add New Dish'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setDishModalVisible(false);
                    setEditingDish(null);
                  }}
                >
                  <X size={20} color={COLORS.forest} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Dish Name */}
                <Text style={styles.fieldLabel}>Dish Name *</Text>
                <TextInput
                  style={styles.textInputHeightMatched}
                  placeholder="e.g. Schezwan Crispy Tofu Wok"
                  placeholderTextColor={COLORS.slate}
                  value={dishName}
                  onChangeText={setDishName}
                />

                {/* Price & Veg Toggle Row */}
                <View style={styles.rowTwoCols}>
                  <View style={styles.colFlex}>
                    <Text style={styles.fieldLabel}>Price (₹) *</Text>
                    <TextInput
                      style={styles.textInputHeightMatched}
                      placeholder="250"
                      placeholderTextColor={COLORS.slate}
                      value={dishPrice}
                      onChangeText={setDishPrice}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.colFlex}>
                    <Text style={styles.fieldLabel}>Food Classification *</Text>
                    <View style={styles.vegToggleRow}>
                      <TouchableOpacity
                        onPress={() => setDishIsVeg(true)}
                        style={[styles.vegOptionBtn, dishIsVeg && styles.vegOptionBtnActive]}
                      >
                        <VegBadge isVeg={true} size={12} />
                        <Text style={[styles.vegOptionText, dishIsVeg && styles.vegOptionTextActive]}>
                          Veg
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setDishIsVeg(false)}
                        style={[styles.vegOptionBtn, !dishIsVeg && styles.nonVegOptionBtnActive]}
                      >
                        <VegBadge isVeg={false} size={12} />
                        <Text style={[styles.vegOptionText, !dishIsVeg && styles.nonVegOptionTextActive]}>
                          Non-Veg
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Category Selector Chips + Custom Category */}
                <Text style={styles.fieldLabel}>Category *</Text>
                <View style={styles.categoryPillsGroup}>
                  {STANDARD_CATEGORIES.map((cat) => {
                    const isSelected = dishCategory === cat && !dishCustomCategory;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => {
                          setDishCategory(cat);
                          setDishCustomCategory('');
                        }}
                        style={[styles.catChip, isSelected && styles.catChipSelected]}
                      >
                        <Text style={[styles.catChipText, isSelected && styles.catChipTextSelected]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={[styles.textInputHeightMatched, { marginTop: 6 }]}
                  placeholder="Or type custom category (e.g. Dim Sum)..."
                  placeholderTextColor={COLORS.slate}
                  value={dishCustomCategory}
                  onChangeText={setDishCustomCategory}
                />

                {/* Description */}
                <Text style={styles.fieldLabel}>
                  Description {editingDish ? '(Optional)' : '*'}
                </Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  placeholder="Key ingredients, flavor profile, and cooking style..."
                  placeholderTextColor={COLORS.slate}
                  value={dishDescription}
                  onChangeText={setDishDescription}
                  multiline
                  numberOfLines={2}
                />

                {/* Thumbnail Image URL (Optional) */}
                <Text style={styles.fieldLabel}>Thumbnail Image URL (Optional)</Text>
                <TextInput
                  style={styles.textInputHeightMatched}
                  placeholder="https://images.unsplash.com/..."
                  placeholderTextColor={COLORS.slate}
                  value={dishImageUrl}
                  onChangeText={setDishImageUrl}
                  autoCapitalize="none"
                />

                {/* Availability Toggle */}
                <Text style={styles.fieldLabel}>Availability</Text>
                <View style={styles.vegToggleRow}>
                  <TouchableOpacity
                    onPress={() => setDishIsAvailable(true)}
                    style={[styles.vegOptionBtn, dishIsAvailable && styles.vegOptionBtnActive]}
                  >
                    <Check size={13} color={COLORS.success} />
                    <Text style={[styles.vegOptionText, dishIsAvailable && styles.vegOptionTextActive]}>
                      In Stock
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDishIsAvailable(false)}
                    style={[styles.vegOptionBtn, !dishIsAvailable && styles.nonVegOptionBtnActive]}
                  >
                    <Ban size={13} color={COLORS.danger} />
                    <Text style={[styles.vegOptionText, !dishIsAvailable && styles.nonVegOptionTextActive]}>
                      Sold Out
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSaveDish}
                  disabled={isSubmittingDish}
                  style={[
                    styles.primaryActionBtn,
                    { marginTop: SPACING.lg },
                    isSubmittingDish && styles.btnDisabled,
                  ]}
                >
                  <CheckCircle2 size={18} color={COLORS.canvas} />
                  <Text style={styles.primaryActionBtnText}>
                    {isSubmittingDish
                      ? 'Saving...'
                      : editingDish
                        ? 'Save Dish Changes'
                        : 'Publish Dish to Menu'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Date Picker Modal for Custom Range & All Orders */}
      <DatePickerModal
        visible={isDatePickerOpen}
        title={
          datePickerTarget === 'start'
            ? 'Select Start Date'
            : datePickerTarget === 'end'
              ? 'Select End Date'
              : 'Select Custom History Date'
        }
        initialDate={
          datePickerTarget === 'start'
            ? customStart
            : datePickerTarget === 'end'
              ? customEnd
              : historyCustomDate
        }
        onSelectDate={(selectedYYYYMMDD) => {
          if (datePickerTarget === 'start') {
            setCustomStart(selectedYYYYMMDD);
          } else if (datePickerTarget === 'end') {
            setCustomEnd(selectedYYYYMMDD);
          } else {
            setHistoryCustomDate(selectedYYYYMMDD);
            setHistoryDateFilter('custom');
          }
        }}
        onClose={() => setIsDatePickerOpen(false)}
      />

      {/* Re-print Station KOT / Customer Receipt Modal */}
      <PrintOrderModal
        visible={!!selectedOrderForPrint}
        order={selectedOrderForPrint}
        onClose={() => setSelectedOrderForPrint(null)}
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
  keyboardAvoider: {
    flex: 1,
  },
  manageCategoryPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: SPACING.md,
  },
  manageCategoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.2,
    borderColor: COLORS.borderLight,
  },
  manageCategoryPillActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  manageCategoryPillText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.semibold,
  },
  manageCategoryPillTextActive: {
    color: COLORS.cream,
    ...FONTS.bold,
  },
  subviewNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.ivory,
  },
  subviewNavTitle: {
    fontSize: 15,
    color: COLORS.organic,
    ...FONTS.heavy,
    letterSpacing: 0.3,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  // HUB STYLES (Elevated Dark Cards)
  hubContainer: {
    gap: SPACING.md,
  },
  hubWelcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.xs,
  },
  hubWelcomeTitle: {
    fontSize: 16,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  hubWelcomeSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    ...FONTS.medium,
    marginTop: 2,
  },
  elevatedDarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(140, 158, 145, 0.3)',
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  // DISH TALLY STYLES
  dishTallyContainer: {
    paddingTop: SPACING.xs,
  },
  dishTallySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    height: 44,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(140, 158, 145, 0.3)',
    marginBottom: SPACING.md,
  },
  dishTallySearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.organic,
    ...FONTS.medium,
    paddingVertical: 0,
  },
  dishTallyTable: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(140, 158, 145, 0.3)',
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  dishTallyTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
  },
  dishTallySummaryBanner: {
    backgroundColor: COLORS.sage,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: SPACING.md,
    gap: 3,
  },
  dishTallySummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dishTallySummaryTitle: {
    fontSize: 12.5,
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  dishTallySummaryText: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.regular,
    lineHeight: 15,
  },
  dishTallyColSrHeader: {
    width: 44,
    fontSize: 11.5,
    color: COLORS.white,
    ...FONTS.bold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dishTallyColNameHeader: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.white,
    ...FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  dishTallyColCountHeader: {
    width: 65,
    fontSize: 11.5,
    color: COLORS.white,
    ...FONTS.bold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dishTallyTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  dishTallyTableRowAlt: {
    backgroundColor: '#FAFBF8',
  },
  dishTallyTableRowLast: {
    borderBottomWidth: 0,
  },
  dishTallyColSr: {
    width: 44,
    fontSize: 12.5,
    color: COLORS.slate,
    ...FONTS.bold,
    textAlign: 'center',
  },
  dishTallyColName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.heavy,
    paddingHorizontal: 8,
    flexWrap: 'wrap',
  },
  dishTallyCountBadge: {
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishTallyColCount: {
    fontSize: 13.5,
    color: COLORS.forestGreen,
    ...FONTS.heavy,
    backgroundColor: COLORS.sage,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center',
  },
  dishTallyEmptyBox: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishTallyEmptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    ...FONTS.medium,
    textAlign: 'center',
  },
  subviewBackBtn: {
    marginRight: 8,
    padding: 2,
  },
  cardLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    paddingRight: 8,
  },
  cardIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(140, 158, 145, 0.2)',
  },
  cardTextGroup: {
    flex: 1,
  },
  cardMainTitle: {
    fontSize: 16,
    color: COLORS.forestGreen,
    ...FONTS.heavy,
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.natural,
    ...FONTS.medium,
    marginTop: 2,
  },
  // SUB-VIEW STYLES
  menuManageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  menuSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    height: 42,
  },
  menuSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.organic,
    marginLeft: 6,
    ...FONTS.regular,
  },
  resetMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.dangerTint,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  resetMenuBtnText: {
    fontSize: 12,
    color: COLORS.danger,
    ...FONTS.bold,
  },
  primaryNewDishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.organic,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    justifyContent: 'center',
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  primaryNewDishBtnText: {
    fontSize: 12,
    color: COLORS.ivory,
    ...FONTS.bold,
  },
  manageDishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
  },
  manageDishLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: SPACING.sm,
  },
  manageDishThumbWrapper: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  manageDishThumb: {
    width: 52,
    height: 52,
  },
  soldOutOverlayBadge: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(63, 66, 46, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutOverlayText: {
    color: COLORS.ivory,
    fontSize: 8,
    ...FONTS.heavy,
  },
  manageDishInfo: {
    flex: 1,
  },
  manageDishBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  manageDishCat: {
    fontSize: 9,
    color: COLORS.textMuted,
    ...FONTS.semibold,
    textTransform: 'uppercase',
  },
  manageDishName: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  textLineThrough: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  manageDishPrice: {
    fontSize: 13,
    color: COLORS.apricot,
    ...FONTS.heavy,
    marginTop: 2,
  },
  manageDishRightActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  stockToggleBtn: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stockIn: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
  },
  stockOut: {
    backgroundColor: COLORS.dangerTint,
    borderColor: COLORS.danger,
  },
  stockToggleBtnText: {
    fontSize: 10,
    ...FONTS.bold,
  },
  stockInText: {
    color: COLORS.veg,
  },
  stockOutText: {
    color: COLORS.danger,
  },
  dishIconButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIconPill: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // FORM / SURFACE STYLES
  cardSurface: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  cardSurfaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    marginBottom: SPACING.xs,
  },
  cardHeaderLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardSurfaceTitle: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.heavy,
    letterSpacing: 0.8,
  },
  liveTag: {
    fontSize: 10,
    color: COLORS.apricot,
    ...FONTS.bold,
    backgroundColor: COLORS.amberTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    ...FONTS.bold,
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.regular,
  },
  textInputHeightMatched: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: COLORS.organic,
    justifyContent: 'center',
    ...FONTS.regular,
  },
  multilineInput: {
    height: 64,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  colFlex: {
    flex: 1,
  },
  vegToggleRow: {
    flexDirection: 'row',
    gap: 6,
    height: 44,
  },
  vegOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  vegOptionBtnActive: {
    borderColor: COLORS.veg,
    backgroundColor: COLORS.successTint,
  },
  nonVegOptionBtnActive: {
    borderColor: COLORS.nonVeg,
    backgroundColor: COLORS.dangerTint,
  },
  vegOptionText: {
    fontSize: 11,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  vegOptionTextActive: {
    color: COLORS.veg,
    ...FONTS.bold,
  },
  nonVegOptionTextActive: {
    color: COLORS.nonVeg,
    ...FONTS.bold,
  },
  categoryPillsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  catChipSelected: {
    borderColor: COLORS.organic,
    backgroundColor: COLORS.organic,
  },
  catChipText: {
    fontSize: 11,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  catChipTextSelected: {
    color: COLORS.ivory,
    ...FONTS.bold,
  },
  datePickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    height: 44,
  },
  datePickerTriggerText: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.organic,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: SPACING.md,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 14,
    color: COLORS.ivory,
    ...FONTS.heavy,
  },
  exportActionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: SPACING.md,
  },
  primaryPdfExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryPdfExportBtnText: {
    fontSize: 13.5,
    color: COLORS.cream,
    ...FONTS.bold,
  },
  secondaryCsvExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.forestGreen,
    borderRadius: 12,
    paddingVertical: 13,
  },
  secondaryCsvExportBtnText: {
    fontSize: 13.5,
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  exportEmptyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: 'rgba(140, 158, 145, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: SPACING.md,
  },
  exportEmptyBannerText: {
    fontSize: 13,
    color: COLORS.natural,
    ...FONTS.medium,
    flex: 1,
  },
  exportDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    ...FONTS.regular,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  rangeOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  rangeChip: {
    flex: 1,
    minWidth: '46%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  rangeChipSelected: {
    borderColor: COLORS.organic,
    backgroundColor: COLORS.organic,
  },
  rangeChipText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.semibold,
  },
  rangeChipTextSelected: {
    color: COLORS.ivory,
    ...FONTS.bold,
  },
  customDateWrapper: {
    backgroundColor: COLORS.surfaceMuted,
    padding: SPACING.sm,
    borderRadius: 10,
    marginBottom: SPACING.sm,
  },
  exportPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  previewMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewMetricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    ...FONTS.medium,
    marginBottom: 2,
  },
  previewMetricValue: {
    fontSize: 18,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  previewMetricValueHighlight: {
    fontSize: 18,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  previewDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.borderLight,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.ivory,
    borderRadius: 18,
    padding: SPACING.lg,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    fontSize: 16,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  historyFlatList: {
    flex: 1,
  },
  historyFlatListContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  historyHeaderComponent: {
    marginBottom: 0,
  },
  historyContainer: {
    paddingBottom: SPACING.xl,
  },
  historySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
    marginBottom: SPACING.sm,
  },
  historySearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  historyDatePillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  historyDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  historyDatePillActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  historyDatePillText: {
    fontSize: 12,
    color: COLORS.forestGreen,
    ...FONTS.semibold,
  },
  historyDatePillTextActive: {
    color: COLORS.cream,
    ...FONTS.bold,
  },
  historySummaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.sage,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: SPACING.md,
    gap: 10,
  },
  historySummaryTextContainer: {
    flex: 1,
    gap: 4,
  },
  historySummaryLine: {
    fontSize: 13.5,
  },
  historySummaryLabel: {
    color: COLORS.slate,
    ...FONTS.medium,
  },
  historySummaryValue: {
    color: COLORS.forest,
    ...FONTS.bold,
  },
  historyRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyRefreshBtnText: {
    fontSize: 11,
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  historyEmptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: SPACING.md,
  },
  historyEmptyTitle: {
    fontSize: 15,
    color: COLORS.organic,
    ...FONTS.bold,
    marginTop: SPACING.sm,
  },
  historyEmptySubtitle: {
    fontSize: 12,
    color: COLORS.natural,
    ...FONTS.regular,
    textAlign: 'center',
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyCardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyTallTokenBadge: {
    alignSelf: 'stretch',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  historyTallTokenText: {
    fontSize: 16,
    ...FONTS.heavy,
  },
  historyCardDateTimeStack: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  historyCardTimeText: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  historyCardDateText: {
    fontSize: 11,
    color: COLORS.natural,
    ...FONTS.medium,
    marginTop: 1,
  },
  historyCardTopRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  historyCardTotalAmountText: {
    fontSize: 16,
    color: COLORS.organic,
    ...FONTS.heavy,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  historyStatusBadgeCompleted: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.forestGreen,
  },
  historyStatusBadgePreparing: {
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.apricot,
  },
  historyStatusBadgeCancelled: {
    backgroundColor: COLORS.dangerTint,
    borderColor: COLORS.danger,
  },
  historyStatusBadgeText: {
    fontSize: 10,
    ...FONTS.bold,
  },
  historyStatusBadgeTextCompleted: {
    color: COLORS.forestGreen,
  },
  historyStatusBadgeTextPreparing: {
    color: COLORS.apricot,
  },
  historyStatusBadgeTextCancelled: {
    color: COLORS.danger,
  },
  historyCustomerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },
  historyCustomerText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.semibold,
    flex: 1,
    marginRight: 8,
  },
  historyPaymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  historyPaymentBadgeCompleted: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.forestGreen,
  },
  historyPaymentBadgePending: {
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
  },
  historyPaymentBadgeText: {
    fontSize: 11,
    ...FONTS.bold,
  },
  historyPaymentBadgeTextCompleted: {
    color: COLORS.forestGreen,
  },
  historyPaymentBadgeTextPending: {
    color: COLORS.amber,
  },
  historyCardDishesBox: {
    backgroundColor: COLORS.canvas,
    borderRadius: 10,
    padding: 8,
    gap: 4,
    marginBottom: 10,
  },
  historyDishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  historyDishLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  historyDishQtyText: {
    fontSize: 12,
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  historyDishNameText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.medium,
    flex: 1,
  },
  historyDishAddonTag: {
    fontSize: 10,
    color: COLORS.apricot,
    ...FONTS.bold,
  },
  historyDishPriceText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  historyCardNote: {
    fontSize: 11,
    color: COLORS.apricot,
    ...FONTS.medium,
    fontStyle: 'italic',
    marginTop: 3,
  },
  historyCardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  historyBtnBill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.4,
    borderColor: COLORS.forest,
    backgroundColor: COLORS.white,
  },
  historyBtnBillText: {
    fontSize: 11.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  historyBtnKot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.forest,
  },
  historyBtnKotText: {
    fontSize: 11.5,
    color: COLORS.cream,
    ...FONTS.bold,
  },
  upiConfigCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: SPACING.lg,
    borderWidth: 1.2,
    borderColor: 'rgba(140, 158, 145, 0.35)',
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 6,
  },
  upiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
  },
  upiCardHeaderTextGroup: {
    flex: 1,
  },
  upiFormContent: {
    gap: 10,
    marginTop: 4,
  },
  upiInputGroup: {
    gap: 4,
  },
  upiInputLabel: {
    fontSize: 10.5,
    color: COLORS.apricot,
    ...FONTS.bold,
    letterSpacing: 0.8,
  },
  upiInput: {
    height: 44,
    backgroundColor: COLORS.canvas,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: COLORS.forest,
    ...FONTS.medium,
  },
  upiPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    padding: 10,
    gap: 12,
    marginVertical: 4,
  },
  upiPreviewLeft: {
    width: 86,
    height: 86,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  miniQrBox: {
    padding: 4,
    backgroundColor: COLORS.white,
  },
  miniQrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  miniQrPlaceholderText: {
    fontSize: 9.5,
    color: COLORS.natural,
    ...FONTS.medium,
  },
  upiPreviewRight: {
    flex: 1,
    gap: 2,
  },
  upiPreviewTitle: {
    fontSize: 12.5,
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  upiPreviewSubtitle: {
    fontSize: 10.5,
    color: COLORS.natural,
    ...FONTS.regular,
    lineHeight: 14,
  },
  upiVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.successTint,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  upiVerifiedBadgeText: {
    fontSize: 9.5,
    color: COLORS.veg,
    ...FONTS.bold,
  },
  upiSaveBtn: {
    backgroundColor: COLORS.organic,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    marginTop: 4,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  upiSaveBtnSuccess: {
    backgroundColor: COLORS.veg,
  },
  upiSaveBtnText: {
    fontSize: 13.5,
    color: COLORS.cream,
    ...FONTS.bold,
  },
  subviewCardContainer: {
    paddingBottom: SPACING.xl,
  },
  printerSettingsBody: {
    gap: 16,
    marginTop: 4,
  },
  printerSettingSection: {
    gap: 6,
  },
  printerSectionLabel: {
    fontSize: 10.5,
    color: COLORS.apricot,
    ...FONTS.bold,
    letterSpacing: 0.8,
  },
  printerSectionSub: {
    fontSize: 12,
    color: COLORS.natural,
    ...FONTS.regular,
  },
  paperWidthOptionsRow: {
    gap: 10,
    marginTop: 4,
  },
  paperWidthOptionCard: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
    position: 'relative',
  },
  paperWidthOptionCardActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.forestGreen,
    borderWidth: 2,
  },
  paperWidthCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  paperWidthOptionTitle: {
    fontSize: 16,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  paperWidthOptionTitleActive: {
    color: COLORS.forestGreen,
  },
  paperWidthDefaultBadge: {
    backgroundColor: COLORS.successTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paperWidthDefaultBadgeText: {
    fontSize: 10,
    color: COLORS.veg,
    ...FONTS.bold,
  },
  paperWidthOptionDesc: {
    fontSize: 12,
    color: COLORS.natural,
    ...FONTS.regular,
    paddingRight: 28,
  },
  paperWidthOptionDescActive: {
    color: COLORS.organic,
  },
  paperWidthCheckCircle: {
    position: 'absolute',
    right: 12,
    top: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rawbtHelperBox: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 4,
  },
  rawbtHelperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  rawbtHelperTitle: {
    fontSize: 12.5,
    color: COLORS.forestGreen,
    ...FONTS.bold,
  },
  rawbtHelperText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  rawbtHelperSubText: {
    fontSize: 11,
    color: COLORS.natural,
    ...FONTS.regular,
  },
  autoPrintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 12,
  },
  autoPrintTextGroup: {
    flex: 1,
  },
  autoPrintTitle: {
    fontSize: 13.5,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  autoPrintSubtitle: {
    fontSize: 11,
    color: COLORS.natural,
    ...FONTS.regular,
    marginTop: 2,
  },
  autoPrintToggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    padding: 3,
    justifyContent: 'center',
  },
  autoPrintToggleTrackActive: {
    backgroundColor: COLORS.forestGreen,
  },
  autoPrintToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  autoPrintToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  // Customer Directory Styles
  customerContainer: {
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  customerHeroCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: SPACING.md,
  },
  customerHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerHeroTitleStack: {
    flex: 1,
  },
  customerHeroTitle: {
    fontSize: 15,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  customerHeroSubtitle: {
    fontSize: 11.5,
    color: COLORS.slate,
    ...FONTS.regular,
    marginTop: 2,
  },
  customerHeroActionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  customerHeroPrimaryBtn: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.forest,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  customerHeroPrimaryBtnText: {
    fontSize: 13,
    color: COLORS.white,
    ...FONTS.bold,
  },
  customerHeroSecondaryBtn: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.sage,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  customerHeroSecondaryBtnText: {
    fontSize: 13,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  customerSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
  },
  customerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.forest,
    ...FONTS.medium,
    paddingVertical: 0,
  },
  customerSearchClearBtn: {
    padding: 4,
  },
  customerListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  customerListSectionTitle: {
    fontSize: 11.5,
    color: COLORS.slate,
    letterSpacing: 0.6,
    ...FONTS.bold,
  },
  customerListCountHint: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.regular,
  },
  customerEmptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  customerEmptyTitle: {
    fontSize: 15,
    color: COLORS.forest,
    ...FONTS.bold,
    marginTop: 4,
  },
  customerEmptySubtitle: {
    fontSize: 12,
    color: COLORS.slate,
    textAlign: 'center',
    lineHeight: 18,
    ...FONTS.regular,
  },
  customerRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customerAvatarText: {
    fontSize: 15,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  customerInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  customerNameText: {
    fontSize: 15,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  customerPhoneText: {
    fontSize: 12,
    color: COLORS.slate,
    ...FONTS.medium,
  },
  customerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerVisitBadge: {
    backgroundColor: COLORS.amberTint,
    borderWidth: 1,
    borderColor: COLORS.amber,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerVisitBadgeText: {
    fontSize: 11,
    color: COLORS.amber,
    ...FONTS.bold,
  },
  customerSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.successTint,
    borderWidth: 1,
    borderColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  customerSendBtnSent: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.border,
  },
  customerSendBtnText: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  customerSendBtnTextSent: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.bold,
  },
});
