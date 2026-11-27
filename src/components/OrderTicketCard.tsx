import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import {
  Printer,
  Edit3,
  CreditCard,
  Check,
  X,
  MessageCircle,
  Ban,
  RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Order, CartItem } from '../types';
import { VegBadge } from './VegBadge';
import {
  formatTime,
  formatDate,
  isOrderFromToday,
  getOrderBalanceDue,
  getOrderAmountPaid,
  isOrderFullyPaid,
} from '../services/storage';
import { COLORS } from '../theme/colors';
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
  const isCancelled = order.status === 'Cancelled' || (order.status as any) === 'cancelled';
  const isRefunded = order.paymentStatus === 'Refunded';

  const balanceDue = getOrderBalanceDue(order);
  const amountPaid = getOrderAmountPaid(order);
  const isFullyPaid = isOrderFullyPaid(order);
  const isPaid = isFullyPaid;
  const isPartial =
    order.paymentStatus === 'Partial' || (amountPaid > 0 && balanceDue > 0);

  const orderType =
    order.orderType === 'Take Away' || order.orderType === 'Parcel'
      ? 'Parcel'
      : order.orderType === 'Car'
      ? 'Car'
      : 'Dine-in';

  const paymentLabel = isRefunded
    ? 'Refunded'
    : isPaid
    ? order.paymentMethod === 'Split' ||
      order.paymentMethod === 'UPI + Cash' ||
      (Array.isArray(order.payments) &&
        order.payments.some((p) => p.method === 'UPI' && p.amount > 0) &&
        order.payments.some((p) => p.method === 'Cash' && p.amount > 0))
      ? 'Split'
      : order.paymentMethod === 'Cash' ||
        (Array.isArray(order.payments) &&
          order.payments.some((p) => p.method === 'Cash' && p.amount > 0) &&
          !order.payments.some((p) => p.method === 'UPI' && p.amount > 0))
      ? 'Cash'
      : 'UPI'
    : isPartial
    ? `₹${balanceDue} Due`
    : 'Payment';

  return (
    <View style={[styles.orderCard, isPreparing && styles.orderCardActive]}>
      {/* ========================================================= */}
      {/* 1. HEADER ROW: Token + Centered (Order Type / Time) + Print Beside Amount */}
      {/* ========================================================= */}
      <View style={styles.cardHeader}>
        {/* Left Group: Token Badge + Stacked Center-Aligned (Order Type / Time) */}
        <View style={styles.cardHeaderLeft}>
          <View style={styles.tokenPill}>
            <Text style={styles.tokenPillText}>{order.token}</Text>
          </View>

          {/* Stacked column with Order Type badge centered directly above Time */}
          <View style={styles.tokenMetaStack}>
            {/* Top line: Compact Order Type pill/label */}
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

            {/* Bottom line: Plain order time string centered underneath */}
            <Text style={styles.timeText}>
              {timeStr}
              {!isToday ? ` • ${dateStr}` : ''}
            </Text>
          </View>
        </View>

        {/* Right Group: [ 🖨 Print ] button directly in front of right-aligned ₹Amount */}
        <View style={styles.cardHeaderRight}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onPrint?.(order)}
            style={styles.printCardBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityLabel="Print order KOT or receipt"
          >
            <Printer size={11} color={COLORS.slate} strokeWidth={2.2} />
            <Text style={styles.printCardBtnText}>Print</Text>
          </TouchableOpacity>

          <View style={styles.amountCol}>
            <Text style={styles.amountText}>₹{order.totalAmount}</Text>
            {isPartial && balanceDue > 0 && (
              <Text style={styles.amountSubDueText}>Due: ₹{balanceDue}</Text>
            )}
          </View>
        </View>
      </View>

      {/* ========================================================= */}
      {/* 2. PRIMARY ACTION BAR (Fixed Equal-Width Buttons flex: 1)  */}
      {/* ========================================================= */}
      <View style={styles.statusBarRow}>
        <View style={styles.actionBarGroup}>
          {/* Left: Soft Mint-Green Fill [ ✎ Edit Order ] */}
          {isCancelled ? (
            <View style={[styles.actionBtnEdit, styles.actionBtnDisabled]}>
              <Edit3
                size={12}
                color={COLORS.slate}
                strokeWidth={2.2}
              />
              <Text
                style={[styles.actionBtnEditText, styles.actionBtnTextDisabled]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                Edit Order
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onEdit?.(order)}
              style={styles.actionBtnEdit}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Edit3
                size={12}
                color={COLORS.forest}
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
          )}

          {/* Center: Warm Amber (Pending) or Mint Green (Paid) or Soft Red (Refunded) */}
          {isRefunded ? (
            <View style={[styles.actionBtnPayment, styles.paymentPillRefunded]}>
              <RotateCcw size={12} color={COLORS.danger} strokeWidth={2.4} />
              <Text
                style={[styles.actionBtnPaymentText, styles.paymentPillTextRefunded]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                Refunded
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              disabled={isFullyPaid || isCancelled}
              activeOpacity={isFullyPaid || isCancelled ? 1 : 0.75}
              onPress={() => {
                if (!isFullyPaid && !isCancelled) {
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
                <CreditCard size={12} color={COLORS.amber} strokeWidth={2.2} />
              ) : (
                <Check
                  size={12}
                  color={COLORS.forest}
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
          )}

          {/* Right: Solid Amber [ Mark Done ] / Soft Mint [ Done Time ] / Muted Red [ CANCELLED ] */}
          {isCancelled ? (
            <View style={styles.actionBtnCancelledBadge}>
              <Ban size={12} color={COLORS.danger} strokeWidth={2.4} />
              <Text
                style={styles.actionBtnCancelledText}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                CANCELLED
              </Text>
            </View>
          ) : isPreparing ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onMarkDone?.(order.id)}
              style={styles.actionBtnDoneAmber}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Check size={13} color={COLORS.amber} strokeWidth={2.8} />
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
                color={COLORS.forest}
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
                Linking.openURL(`tel:${clean}`).catch((err) => {
                  console.warn('Could not open phone dialer:', err);
                });
              }
            }}
            style={styles.customerInfoGroup}
          >
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
                  <Check size={11} color={COLORS.success} strokeWidth={2.8} />
                  <Text style={styles.notifyOrderPillTextNotified}>Notified</Text>
                </>
              ) : (
                <>
                  <MessageCircle size={11} color={COLORS.forest} strokeWidth={2.4} />
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
          const cancellableQty = Math.max(0, cartItem.quantity - (cartItem.servedQuantity || 0));

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
                {/* Left: Veg/Non-Veg Badge + Dish Name & Per-Dish Note */}
                <View style={styles.itemLeft}>
                  <VegBadge isVeg={cartItem.isVeg} size={15} />
                  <View style={styles.itemNameAndNoteCol}>
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
                    {Boolean(cartItem.notes) && (
                      <Text style={styles.itemNoteSubText} numberOfLines={1}>
                        📝 {cartItem.notes}
                      </Text>
                    )}
                  </View>
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
                            color={isItemDone ? COLORS.success : COLORS.slate}
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

                        {/* Cancel Pill: Soft Red-Tinted [ ✕ Cancel ] (Capped to unserved units) */}
                        {!isItemCancelled && cancellableQty > 0 && (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => onCancelItem?.(order.id, idx)}
                            style={styles.itemCancelActionBtn}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          >
                            <X size={10} color={COLORS.danger} strokeWidth={2.8} />
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
                          color={cartItem.notified ? COLORS.success : COLORS.forest}
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
    backgroundColor: COLORS.white, // Crisp white card background
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border, // Subtle sage border
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardActive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  // 1. Header Row
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.sage,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenPill: {
    backgroundColor: COLORS.amberTint,
    borderWidth: 1.2,
    borderColor: COLORS.amber,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenPillText: {
    fontSize: 16,
    color: COLORS.amber, // Warm amber
    ...FONTS.heavy,
    letterSpacing: 0.4,
  },
  tokenMetaStack: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2.5,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.medium,
    lineHeight: 13,
    textAlign: 'center',
  },
  orderTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    alignSelf: 'center',
  },
  orderTypeDineIn: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.border,
  },
  orderTypeParcel: {
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
  },
  orderTypeCar: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.border,
  },
  orderTypePillText: {
    fontSize: 10.5,
    ...FONTS.bold,
    letterSpacing: 0.2,
    lineHeight: 12,
  },
  orderTypeDineInText: {
    color: COLORS.forest,
  },
  orderTypeParcelText: {
    color: COLORS.amber,
  },
  orderTypeCarText: {
    color: COLORS.forest,
  },
  dateText: {
    fontSize: 10,
    color: COLORS.slate,
    ...FONTS.regular,
  },
  printCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  printCardBtnText: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.bold,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountText: {
    fontSize: 20,
    color: COLORS.forest, // Bold total in deep forest green
    ...FONTS.heavy,
  },
  amountSubDueText: {
    fontSize: 10,
    color: COLORS.amber,
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
    backgroundColor: COLORS.successTint,
    borderWidth: 1.2,
    borderColor: COLORS.success,
    borderRadius: 12,
  },
  actionBtnEditText: {
    fontSize: 12,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  actionBtnDisabled: {
    backgroundColor: '#F0F3F1',
    borderColor: '#DDE3DF',
    opacity: 0.6,
  },
  actionBtnTextDisabled: {
    color: COLORS.slate,
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
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
  },
  paymentPillCompleted: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
  },
  paymentPillRefunded: {
    backgroundColor: '#FFF0ED',
    borderColor: '#E57373',
  },
  actionBtnPaymentText: {
    fontSize: 12,
    ...FONTS.bold,
  },
  paymentPillTextPending: {
    color: COLORS.amber,
  },
  paymentPillTextCompleted: {
    color: COLORS.forest,
  },
  paymentPillTextRefunded: {
    color: COLORS.danger,
  },
  actionBtnCancelledBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    height: 38,
    backgroundColor: COLORS.dangerTint,
    borderColor: COLORS.danger,
    borderWidth: 1.2,
    borderRadius: 12,
  },
  actionBtnCancelledText: {
    fontSize: 12,
    color: COLORS.danger,
    ...FONTS.bold,
  },
  actionBtnDoneAmber: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    height: 38,
    backgroundColor: COLORS.amberTint,
    borderColor: COLORS.amber,
    borderWidth: 1.2,
    borderRadius: 12,
  },
  actionBtnDoneAmberText: {
    fontSize: 12,
    color: COLORS.amber,
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
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
    borderWidth: 1.2,
    borderRadius: 12,
  },
  actionBtnCompletedText: {
    fontSize: 12,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  // 3. Customer Info Strip
  customerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.canvas, // Soft Sage Container
    borderWidth: 1,
    borderColor: COLORS.border,
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
  customerCombinedText: {
    flex: 1,
    fontSize: 14.5,
  },
  customerText: {
    fontSize: 14.5,
    color: COLORS.forest,
    ...FONTS.heavy,
  },
  customerBullet: {
    fontSize: 14,
    color: COLORS.slate,
  },
  customerPhoneText: {
    fontSize: 14,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  notifyOrderPill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1.2,
    borderColor: COLORS.success,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 14,
  },
  notifyOrderPillNotified: {
    backgroundColor: COLORS.successTint,
    borderColor: COLORS.success,
  },
  notifyOrderPillText: {
    fontSize: 11,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  notifyOrderPillTextNotified: {
    fontSize: 11,
    color: COLORS.forest,
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
    backgroundColor: COLORS.sage,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  addonPillText: {
    fontSize: 10,
    color: COLORS.slate,
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
    color: COLORS.slate,
    ...FONTS.semibold,
  },
  itemNameAndNoteCol: {
    flex: 1,
    justifyContent: 'center',
  },
  itemNameText: {
    fontSize: 12.5,
    color: COLORS.forest,
    ...FONTS.semibold,
  },
  itemNoteSubText: {
    fontSize: 10,
    color: COLORS.amber,
    ...FONTS.semibold,
    marginTop: 1,
  },
  textLineThrough: {
    textDecorationLine: 'line-through',
    color: COLORS.slate,
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
    backgroundColor: COLORS.white, // Neutral white
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemProgressText: {
    fontSize: 10.5,
    color: COLORS.slate,
    ...FONTS.semibold,
  },
  itemDoneBadge: {
    backgroundColor: COLORS.successTint, // Mint green highlight
    borderColor: COLORS.success,
  },
  itemDoneBadgeText: {
    color: COLORS.forest,
    ...FONTS.bold,
  },
  itemCancelActionBtn: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: COLORS.dangerTint, // Soft red-tinted
    borderColor: COLORS.danger,
    borderWidth: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemCancelActionText: {
    fontSize: 10,
    color: COLORS.danger,
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
    borderRadius: 6,
  },
  itemCancelledBadgeText: {
    fontSize: 10,
    color: COLORS.danger,
    ...FONTS.bold,
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
  // 5. Bottom Kitchen Note Banner
  notesCallout: {
    backgroundColor: COLORS.amberTint, // Warm cream
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.amber, // Amber-bordered
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesText: {
    fontSize: 11.5,
    color: COLORS.amber, // Warm brown/amber
    ...FONTS.semibold,
    flex: 1,
  },
});
