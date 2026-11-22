import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import {
  Clock,
  User,
  Printer,
  Edit3,
  CreditCard,
  Check,
  X,
  MessageCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Order, CartItem } from '../types';
import { VegBadge } from './VegBadge';
import { formatTime, formatDate, isOrderFromToday } from '../services/storage';
import { FONTS } from '../constants/theme';

export interface OrderTicketCardProps {
  order: Order;
  onPrint?: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onPayment?: (order: Order) => void;
  onMarkDone?: (orderId: string) => void;
  onNotifyOrderReady?: (order: Order) => void;
  onNotifyDishReady?: (order: Order, item: CartItem, index: number) => void;
  onIncrementServed?: (orderId: string, index: number) => void;
  onCancelItem?: (orderId: string, index: number) => void;
}

export const OrderTicketCard: React.FC<OrderTicketCardProps> = ({
  order,
  onPrint,
  onEdit,
  onPayment,
  onMarkDone,
  onNotifyOrderReady,
  onNotifyDishReady,
  onIncrementServed,
  onCancelItem,
}) => {
  const isToday = isOrderFromToday(order.timestamp);
  const timeStr = formatTime(order.timestamp);
  const dateStr = formatDate(order.timestamp);
  const isPreparing = order.status === 'preparing';

  const balanceDue =
    typeof order.balanceDue === 'number'
      ? order.balanceDue
      : order.paymentStatus === 'Completed'
      ? 0
      : order.totalAmount;
  const amountPaid =
    typeof order.amountPaid === 'number'
      ? order.amountPaid
      : order.paymentStatus === 'Completed'
      ? order.totalAmount
      : 0;
  const isPaid = order.paymentStatus === 'Completed' || balanceDue <= 0;
  const isPartial =
    order.paymentStatus === 'Partial' || (amountPaid > 0 && balanceDue > 0);
  const isFullyPaid = isPaid && balanceDue <= 0;

  const orderType =
    order.orderType === 'Take Away' || order.orderType === 'Parcel'
      ? 'Parcel'
      : order.orderType === 'Car'
      ? 'Car'
      : 'Dine-in';

  const paymentLabel = isPaid
    ? order.paymentMethod === 'UPI + Cash' ||
      (Array.isArray(order.payments) &&
        order.payments.some((p) => p.method === 'UPI' && p.amount > 0) &&
        order.payments.some((p) => p.method === 'Cash' && p.amount > 0))
      ? 'UPI + Cash'
      : order.paymentMethod === 'Cash' ||
        (Array.isArray(order.payments) &&
          order.payments.some((p) => p.method === 'Cash' && p.amount > 0) &&
          !order.payments.some((p) => p.method === 'UPI' && p.amount > 0))
      ? 'Cash'
      : 'UPI'
    : isPartial
    ? `Due ₹${balanceDue}`
    : 'Payment';

  return (
    <View style={[styles.orderCard, isPreparing && styles.orderCardActive]}>
      {/* ========================================================= */}
      {/* 1. HEADER ROW: Token + Order Type + Time + Print (Left), Total (Right) */}
      {/* ========================================================= */}
      <View style={styles.cardHeader}>
        {/* Left Group: Token Badge, Order Type, Clock + Time, and Print Pill */}
        <View style={styles.cardHeaderLeft}>
          <View style={styles.tokenPill}>
            <Text style={styles.tokenPillText}>{order.token}</Text>
          </View>

          {/* Compact Order Type Badge (Dine-in / Parcel / Car) */}
          <View
            style={[
              styles.orderTypePill,
              orderType === 'Parcel'
                ? styles.orderTypeParcel
                : orderType === 'Car'
                ? styles.orderTypeCar
                : styles.orderTypeDineIn,
            ]}
          >
            <Text
              style={[
                styles.orderTypePillText,
                orderType === 'Parcel'
                  ? styles.orderTypeParcelText
                  : orderType === 'Car'
                  ? styles.orderTypeCarText
                  : styles.orderTypeDineInText,
              ]}
            >
              {orderType}
            </Text>
          </View>

          <View style={styles.timeRow}>
            <Clock size={11} color="#7A8B7E" strokeWidth={2} />
            <Text style={styles.timeText}>{timeStr}</Text>
            {!isToday && <Text style={styles.dateText}>• {dateStr}</Text>}
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onPrint?.(order)}
            style={styles.printCardBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityLabel="Print order KOT or receipt"
          >
            <Printer size={11} color="#4A5E50" strokeWidth={2.2} />
            <Text style={styles.printCardBtnText}>Print</Text>
          </TouchableOpacity>
        </View>

        {/* Right Group: Bold Total Amount (flexShrink: 0 - Never collides) */}
        <View style={styles.cardHeaderRight}>
          <Text style={styles.amountText}>₹{order.totalAmount}</Text>
          {isPartial && balanceDue > 0 && (
            <Text style={styles.amountSubDueText}>Due: ₹{balanceDue}</Text>
          )}
        </View>
      </View>

      {/* ========================================================= */}
      {/* 2. PRIMARY ACTION BAR (Fixed Equal-Width Buttons flex: 1)  */}
      {/* ========================================================= */}
      <View style={styles.statusBarRow}>
        <View style={styles.actionBarGroup}>
          {/* Left: Soft Mint-Green Fill [ ✎ Edit Order ] */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onEdit?.(order)}
            style={styles.actionBtnEdit}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <Edit3
              size={12}
              color="#0D381E"
              strokeWidth={2.2}
            />
            <Text
              style={styles.actionBtnEditText}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.85}
            >
              Edit Order
            </Text>
          </TouchableOpacity>

          {/* Center: Warm Amber (Pending) or Mint Green (Paid) [ 💳 Payment / ✓ UPI ] */}
          <TouchableOpacity
            disabled={isFullyPaid}
            activeOpacity={isFullyPaid ? 1 : 0.75}
            onPress={() => {
              if (!isFullyPaid) {
                onPayment?.(order);
              }
            }}
            style={[
              styles.actionBtnPayment,
              isPaid
                ? styles.paymentPillCompleted
                : styles.paymentPillPending,
            ]}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            {!isPaid ? (
              <CreditCard size={12} color="#D78B30" strokeWidth={2.2} />
            ) : (
              <Check
                size={12}
                color="#0D381E"
                strokeWidth={2.6}
              />
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
              {paymentLabel}
            </Text>
          </TouchableOpacity>

          {/* Right: Solid Amber [ Mark Done ] / Soft Mint [ Done Time ] */}
          {isPreparing ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onMarkDone?.(order.id)}
              style={styles.actionBtnDoneAmber}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Check size={13} color="#D78B30" strokeWidth={2.8} />
              <Text
                style={styles.actionBtnDoneAmberText}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                Mark Done
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionBtnCompletedBadge}>
              <Check
                size={12}
                color="#0D381E"
                strokeWidth={2.6}
              />
              <Text
                style={styles.actionBtnCompletedText}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                {order.completedAt ? `Done ${formatTime(order.completedAt)}` : 'Done'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ========================================================= */}
      {/* 3. CUSTOMER INFO STRIP (Single-Line Customer Info & Phone) */}
      {/* ========================================================= */}
      {(order.customerName || order.customerPhone) && (
        <View style={styles.customerStrip}>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={!order.customerPhone}
            onPress={() => {
              if (!order.customerPhone) return;
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              const clean = order.customerPhone.replace(/[^0-9+]/g, '');
              if (clean) {
                Linking.openURL(`tel:${clean}`).catch(() => {
                  Alert.alert('Unable to Call', 'Could not open phone dialer.');
                });
              }
            }}
            style={styles.customerInfoGroup}
          >
            <User size={12} color="#4A5E50" strokeWidth={2.2} style={styles.customerUserIcon} />
            <Text
              style={styles.customerCombinedText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {order.customerName ? (
                <Text style={styles.customerText}>{order.customerName}</Text>
              ) : null}
              {order.customerName && order.customerPhone ? (
                <Text style={styles.customerBullet}> • </Text>
              ) : null}
              {order.customerPhone ? (
                <Text style={styles.customerPhoneText}>{order.customerPhone}</Text>
              ) : null}
            </Text>
          </TouchableOpacity>

          {/* Right: Outlined Green-Bordered Pill [ 💬 Notify Ready ] */}
          {order.customerPhone ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onNotifyOrderReady?.(order)}
              style={[
                styles.notifyOrderPill,
                order.notified && styles.notifyOrderPillNotified,
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Send complete order ready alert via WhatsApp"
            >
              {order.notified ? (
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

      {/* ========================================================= */}
      {/* 4. ITEMIZED DISH ROWS                                      */}
      {/* ========================================================= */}
      <View style={styles.itemsContainer}>
        {order.items.map((cartItem, idx) => {
          const isItemCancelled = cartItem.status === 'cancelled';
          const isItemDone =
            cartItem.status === 'completed' ||
            (cartItem.servedQuantity ?? 0) >= cartItem.quantity;
          const servedCount =
            typeof cartItem.servedQuantity === 'number'
              ? cartItem.servedQuantity
              : isItemDone
              ? cartItem.quantity
              : 0;

          const isAddonItem = Boolean(cartItem.isAddon || cartItem.addedAt);
          const prevItem = idx > 0 ? order.items[idx - 1] : null;
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
              {/* Centered Add-on Items Divider Badge */}
              {showAddonDivider && (
                <View style={styles.addonDividerContainer}>
                  <View style={styles.addonPill}>
                    <Text style={styles.addonPillText}>
                      -- ADDED ITEMS ({formatTime(cartItem.addedAt || order.timestamp)}) --
                    </Text>
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.itemRow,
                  isItemCancelled && styles.itemRowCancelled,
                ]}
              >
                {/* Left: Veg/Non-Veg Badge + 1x + Dish Name */}
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
                  >
                    {cartItem.name}
                  </Text>
                </View>

                {/* Right-Aligned Controls: Status Toggle Pill, Cancel Pill, WhatsApp Button */}
                <View style={styles.itemRightActions}>
                  <View style={styles.itemStatusButtonGroup}>
                    {isItemCancelled ? (
                      <View style={styles.itemCancelledBadge}>
                        <Text style={styles.itemCancelledBadgeText}>Cancelled</Text>
                      </View>
                    ) : (
                      <>
                        {/* Status Toggle Pill: [ ✓ 0/1 Done ] or [ ✓ 1/1 Done ] */}
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => onIncrementServed?.(order.id, idx)}
                          style={[
                            styles.itemProgressBtn,
                            isItemDone && styles.itemDoneBadge,
                          ]}
                          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        >
                          <Check
                            size={10}
                            color={isItemDone ? '#2E7D32' : '#7A8B7E'}
                            strokeWidth={2.8}
                          />
                          <Text
                            style={[
                              styles.itemProgressText,
                              isItemDone && styles.itemDoneBadgeText,
                            ]}
                          >
                            {servedCount}/{cartItem.quantity} Done
                          </Text>
                        </TouchableOpacity>

                        {/* Cancel Pill: Soft Red-Tinted [ ✕ Cancel ] */}
                        {!isItemDone && (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => onCancelItem?.(order.id, idx)}
                            style={styles.itemCancelActionBtn}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          >
                            <X size={10} color="#E53935" strokeWidth={2.8} />
                            <Text style={styles.itemCancelActionText}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                    {/* Square Green-Tinted WhatsApp Icon Button [ 💬 ] */}
                    {!isItemCancelled && order.customerPhone ? (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => onNotifyDishReady?.(order, cartItem, idx)}
                        style={[
                          styles.itemWhatsappBtn,
                          cartItem.notified && styles.itemWhatsappBtnNotified,
                        ]}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        accessibilityLabel="Send WhatsApp pickup alert for this dish"
                      >
                        <MessageCircle
                          size={12}
                          color={cartItem.notified ? '#25D366' : '#128C7E'}
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

      {/* ========================================================= */}
      {/* 5. BOTTOM KITCHEN NOTE BANNER                             */}
      {/* ========================================================= */}
      {order.notes ? (
        <View style={styles.notesCallout}>
          <Text style={styles.notesText}>📝 {order.notes}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  orderCard: {
    backgroundColor: '#FFFFFF', // Crisp white card background
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E4ECE5', // Subtle sage border
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardActive: {
    borderColor: '#E4ECE5',
    backgroundColor: '#FFFFFF',
  },
  // 1. Header Row
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2EC',
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
    minWidth: 0,
    flexWrap: 'nowrap',
  },
  tokenPill: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1.2,
    borderColor: '#F0C995',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenPillText: {
    fontSize: 12.5,
    color: '#D78B30', // Warm amber
    ...FONTS.heavy,
    letterSpacing: 0.4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 12,
    color: '#4A5E50',
    ...FONTS.semibold,
  },
  orderTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  orderTypeDineIn: {
    backgroundColor: '#EAF2EC',
    borderColor: '#A8C5AE',
  },
  orderTypeParcel: {
    backgroundColor: '#FDF4E7',
    borderColor: '#E8B882',
  },
  orderTypeCar: {
    backgroundColor: '#EBF3FA',
    borderColor: '#9EC5E8',
  },
  orderTypePillText: {
    fontSize: 11,
    ...FONTS.bold,
    letterSpacing: 0.2,
  },
  orderTypeDineInText: {
    color: '#0D381E',
  },
  orderTypeParcelText: {
    color: '#A05A0B',
  },
  orderTypeCarText: {
    color: '#13548A',
  },
  dateText: {
    fontSize: 10.5,
    color: '#8C9E91',
    ...FONTS.regular,
  },
  printCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D3DFD5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  printCardBtnText: {
    fontSize: 11,
    color: '#4A5E50',
    ...FONTS.bold,
  },
  cardHeaderRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountText: {
    fontSize: 20,
    color: '#0D381E', // Bold total in deep forest green
    ...FONTS.heavy,
  },
  amountSubDueText: {
    fontSize: 10,
    color: '#D78B30',
    ...FONTS.bold,
    marginTop: -2,
  },
  // 2. Primary Action Bar (Fixed Equal-Width Buttons flex: 1)
  statusBarRow: {
    paddingVertical: 10,
  },
  actionBarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    height: 38,
    backgroundColor: '#E8F8EE',
    borderWidth: 1.2,
    borderColor: '#A3D9B8',
    borderRadius: 12,
  },
  actionBtnEditText: {
    fontSize: 12,
    color: '#0D381E',
    ...FONTS.bold,
  },
  actionBtnPayment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    height: 38,
    borderWidth: 1.2,
    borderRadius: 12,
  },
  paymentPillPending: {
    backgroundColor: '#FDF6EC',
    borderColor: '#D78B30',
  },
  paymentPillCompleted: {
    backgroundColor: '#E8F8EE',
    borderColor: '#A3D9B8',
  },
  actionBtnPaymentText: {
    fontSize: 12,
    ...FONTS.bold,
  },
  paymentPillTextPending: {
    color: '#D78B30',
  },
  paymentPillTextCompleted: {
    color: '#0D381E',
  },
  actionBtnDoneAmber: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    height: 38,
    backgroundColor: '#FDF6EC',
    borderColor: '#D78B30',
    borderWidth: 1.2,
    borderRadius: 12,
  },
  actionBtnDoneAmberText: {
    fontSize: 12,
    color: '#D78B30',
    ...FONTS.bold,
  },
  actionBtnCompletedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    height: 38,
    backgroundColor: '#E8F8EE',
    borderColor: '#A3D9B8',
    borderWidth: 1.2,
    borderRadius: 12,
  },
  actionBtnCompletedText: {
    fontSize: 12,
    color: '#0D381E',
    ...FONTS.bold,
  },
  // 3. Customer Info Strip
  customerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9F5', // Soft Sage Container
    borderWidth: 1,
    borderColor: '#DCE8DE',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 8,
  },
  customerInfoGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  customerUserIcon: {
    marginRight: 5,
    flexShrink: 0,
  },
  customerCombinedText: {
    flex: 1,
    fontSize: 12,
  },
  customerText: {
    fontSize: 12,
    color: '#0D381E',
    ...FONTS.bold,
  },
  customerBullet: {
    fontSize: 12,
    color: '#8C9E91',
  },
  customerPhoneText: {
    fontSize: 12,
    color: '#4A5E50',
    ...FONTS.medium,
  },
  notifyOrderPill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#34A853',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 14,
  },
  notifyOrderPillNotified: {
    backgroundColor: '#E8F5E9',
    borderColor: '#81C784',
  },
  notifyOrderPillText: {
    fontSize: 11,
    color: '#128C7E',
    ...FONTS.bold,
  },
  notifyOrderPillTextNotified: {
    fontSize: 11,
    color: '#2E7D32',
    ...FONTS.bold,
  },
  // 4. Itemized Dish Rows
  itemsContainer: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  addonDividerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  addonPill: {
    backgroundColor: '#F4F8F5',
    borderColor: '#D8E5DC',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  addonPillText: {
    fontSize: 10,
    color: '#7A8B7E',
    ...FONTS.bold,
    letterSpacing: 0.5,
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
    fontSize: 12,
    color: '#8C9E91',
    ...FONTS.semibold,
  },
  itemNameText: {
    flex: 1,
    fontSize: 12.5,
    color: '#0D381E',
    ...FONTS.semibold,
  },
  textLineThrough: {
    textDecorationLine: 'line-through',
    color: '#8C9E91',
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
  itemProgressBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF', // Neutral white
    borderColor: '#D3DFD5',
    borderWidth: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemProgressText: {
    fontSize: 10.5,
    color: '#5C7063',
    ...FONTS.semibold,
  },
  itemDoneBadge: {
    backgroundColor: '#E4F7EC', // Mint green highlight
    borderColor: '#34A853',
  },
  itemDoneBadgeText: {
    color: '#2E7D32',
    ...FONTS.bold,
  },
  itemCancelActionBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#FFF0F2', // Soft red-tinted
    borderColor: '#F8B4BE',
    borderWidth: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemCancelActionText: {
    fontSize: 10,
    color: '#E53935',
    ...FONTS.bold,
  },
  itemCancelledBadge: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F2',
    borderColor: '#F8B4BE',
    borderWidth: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemCancelledBadgeText: {
    fontSize: 10,
    color: '#E53935',
    ...FONTS.bold,
  },
  itemWhatsappBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#EAF8EF',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemWhatsappBtnNotified: {
    backgroundColor: '#DCF8C6',
    borderColor: '#25D366',
  },
  // 5. Bottom Kitchen Note Banner
  notesCallout: {
    backgroundColor: '#FFF8F0', // Warm cream
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F0D0A5', // Amber-bordered
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesText: {
    fontSize: 11.5,
    color: '#8D5B18', // Warm brown/amber
    ...FONTS.semibold,
    flex: 1,
  },
});
