export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isVeg: boolean;
  description?: string;
  imageUrl?: string;
  isAvailable?: boolean;
}

export type ItemStatus = 'pending' | 'completed' | 'cancelled';

export interface CartItem extends MenuItem {
  quantity: number;
  servedQuantity?: number; // Count of dishes served (0 to quantity)
  status?: ItemStatus;
  notes?: string; // Per-dish preparation notes (e.g. "Less spicy", "No onion")
  addedAt?: string; // ISO timestamp if added live to an existing ticket
  isAddon?: boolean; // True if this item was added as an independent add-on batch
  isPrinted?: boolean; // True if this item has been printed on a KOT slip
  printedAt?: string; // ISO timestamp when dispatched to printer
  notified?: boolean; // True if customer has been notified via WhatsApp for this dish
  notifiedAt?: string; // ISO timestamp when WhatsApp notification was dispatched
}

export type OrderStatus = 'preparing' | 'completed' | 'cancelled' | 'Cancelled';

export type OrderType = 'Dine-in' | 'Parcel' | 'Car' | 'Take Away';

export type PaymentMethod = 'UPI' | 'Cash' | 'Split' | 'UPI + Cash';

export type PaymentStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Completed' | 'Pending' | 'Refunded';

export interface PaymentRecord {
  method: 'UPI' | 'Cash';
  amount: number;
  paidAt: string; // ISO string
}

export interface UpiConfig {
  upiId: string;
  merchantName: string;
}

export interface Order {
  id: string;
  token: string;          // Sequential format: "#01", "#02", etc.
  timestamp: string;      // ISO string
  status: OrderStatus;
  completedAt?: string;   // ISO string when marked completed
  customerName?: string;
  customerPhone?: string;
  orderType?: OrderType;  // 'Dine-in' | 'Parcel' | 'Car'
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  upiPaid?: number;       // Amount paid via UPI (INR)
  cashPaid?: number;      // Amount paid via Cash (INR)
  refundedUpi?: number;   // Amount refunded via UPI (INR)
  refundedCash?: number;  // Amount refunded via Cash (INR)
  cancelReason?: string;  // Reason for item/order cancellation or refund
  payments?: PaymentRecord[]; // Split payment tracking (e.g. initial UPI + add-on Cash)
  notes?: string;
  items: CartItem[];
  subtotal?: number;      // Bill subtotal before discount
  discount?: number;      // Live discount amount in INR
  discountPercent?: number; // Discount percentage (e.g. 10 for 10%)
  grandTotal?: number;    // True full bill total (initial items + all add-on items after discount)
  totalAmount: number;    // Cumulative sum of all items in the ticket (after discount)
  amountPaid?: number;    // Actual money collected so far
  paidAmount?: number;    // Alias for amountPaid
  balanceDue?: number;    // Outstanding dues: totalAmount - amountPaid
  isPaid?: boolean;       // True if fully paid with zero balance due
  notified?: boolean;     // True if customer has been notified via WhatsApp for the whole order
  notifiedAt?: string;    // ISO timestamp when whole order WhatsApp notification was dispatched
}

export type OrderInput = Omit<Order, 'id' | 'token' | 'timestamp' | 'status' | 'completedAt'> & {
  status?: OrderStatus;
};

export interface DailyMetrics {
  totalOrders: number;
  totalRevenue: number;
  totalUpiRevenue?: number;
  totalCashRevenue?: number;
  totalRefundRevenue?: number;
  activeOrders: number;
  completedOrders: number;
}

export interface CustomerProfile {
  name: string;
  phone: string;
}

export interface ItemSalesSummary {
  id: string;
  name: string;
  category: string;
  isVeg: boolean;
  price: number;
  quantitySold: number;
  itemRevenue: number;
}

export type DateRangeOption = 'today' | '7days' | 'custom' | 'all' | '30days';

export interface SushiWaitEstimate {
  pendingSushiCount: number;
  rawMinutes: number;
  manualOffsetMins: number;
  totalMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  formattedRange: string;
  compactRange: string;
  urgencyLevel: 'low' | 'medium' | 'high';
}

export interface SushiWaitOptions {
  manualOffsetMins?: number;
  additionalSushiQty?: number;
  ordersOverride?: Order[];
  menuItemsOverride?: MenuItem[];
}

export interface KitchenWaitEstimate {
  pendingKitchenCount: number;
  rawMinutes: number;
  manualOffsetMins: number;
  totalMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  formattedRange: string;
  compactRange: string;
  urgencyLevel: 'low' | 'medium' | 'high';
}

export interface KitchenWaitOptions {
  manualOffsetMins?: number;
  additionalKitchenQty?: number;
  ordersOverride?: Order[];
  menuItemsOverride?: MenuItem[];
}
