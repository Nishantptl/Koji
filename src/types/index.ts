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
  addedAt?: string; // ISO timestamp if added live to an existing ticket
  isAddon?: boolean; // True if this item was added as an independent add-on batch
  isPrinted?: boolean; // True if this item has been printed on a KOT slip
  printedAt?: string; // ISO timestamp when dispatched to printer
  notified?: boolean; // True if customer has been notified via WhatsApp for this dish
  notifiedAt?: string; // ISO timestamp when WhatsApp notification was dispatched
}

export type OrderStatus = 'preparing' | 'completed';

export type OrderType = 'Dine-in' | 'Parcel' | 'Car' | 'Take Away';

export type PaymentMethod = 'UPI' | 'Cash' | 'UPI + Cash';

export type PaymentStatus = 'Pending' | 'Partial' | 'Completed';

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
  payments?: PaymentRecord[]; // Split payment tracking (e.g. initial UPI + add-on Cash)
  notes?: string;
  items: CartItem[];
  subtotal?: number;      // Bill subtotal before discount
  discount?: number;      // Live discount amount in INR
  discountPercent?: number; // Discount percentage (e.g. 10 for 10%)
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
  activeOrders: number;
  completedOrders: number;
}

export interface CustomerProfile {
  name: string;
  phone: string;
}

export type DateRangeOption = 'today' | '7days' | 'custom' | 'all' | '30days';
