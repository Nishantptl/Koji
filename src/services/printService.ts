import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order, CartItem } from '../types';
import { formatTime } from './storage';

export const AUTOPRINT_STORAGE_KEY = '@koji_autoprint_kot';
export const PAPER_WIDTH_STORAGE_KEY = '@koji_paper_width';
export const ROLL_WIDTH = 48; // Standard 80mm thermal printer monospace width (48 columns)

/**
 * Posiflow KP307-UEWB / ESC-POS Hardware Auto-Cutter Command:
 * \n\n\n feeds 3 lines so printed content clears the cutter blade,
 * followed by standard GS V 66 0 (\x1D\x56\x42\x00) partial/full hardware cut.
 */
export const ESCPOS_AUTO_CUT = '\n\n\n\x1D\x56\x42\x00';

export async function getPaperWidthPreference(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(PAPER_WIDTH_STORAGE_KEY);
    if (val === '32') return 32;
    return 48; // Default 80mm
  } catch {
    return 48;
  }
}

export async function setPaperWidthPreference(width: 48 | 32): Promise<void> {
  try {
    await AsyncStorage.setItem(PAPER_WIDTH_STORAGE_KEY, String(width));
  } catch {}
}

export interface StationKot {
  stationTitle: string;
  stationKey: 'veg_sushi' | 'non_veg_sushi' | 'wok_kitchen';
  items: CartItem[];
}

/**
 * 1. Station Partitioning Logic:
 * Inspects order items and partitions into up to 3 station buckets:
 * - Bucket 1: "VEG SUSHI KOT" -> category === 'Sushi' && isVeg === true
 * - Bucket 2: "NON-VEG SUSHI KOT" -> category === 'Sushi' && isVeg === false
 * - Bucket 3: "WOK & KITCHEN KOT" -> category !== 'Sushi' (Wok & Crisp, Rice & Noodles, Mocktail, etc.)
 * Skips any section with zero active items.
 */
export function getOrderStationKots(order: Order, itemsOverride?: CartItem[]): StationKot[] {
  // Only non-cancelled items are eligible for KOT
  const sourceItems = itemsOverride || order.items;
  const activeItems = sourceItems.filter(
    (item) => item.status !== 'cancelled' && item.quantity > 0
  );

  const vegSushi = activeItems.filter(
    (item) => item.category === 'Sushi' && item.isVeg === true
  );

  const nonVegSushi = activeItems.filter(
    (item) => item.category === 'Sushi' && item.isVeg === false
  );

  const wokKitchen = activeItems.filter(
    (item) => item.category !== 'Sushi'
  );

  const stations: StationKot[] = [];

  if (vegSushi.length > 0) {
    stations.push({
      stationTitle: 'VEG SUSHI KOT',
      stationKey: 'veg_sushi',
      items: vegSushi,
    });
  }

  if (nonVegSushi.length > 0) {
    stations.push({
      stationTitle: 'NON-VEG SUSHI KOT',
      stationKey: 'non_veg_sushi',
      items: nonVegSushi,
    });
  }

  if (wokKitchen.length > 0) {
    stations.push({
      stationTitle: 'WOK & KITCHEN KOT',
      stationKey: 'wok_kitchen',
      items: wokKitchen,
    });
  }

  return stations;
}

/**
 * Strict Monospace Thermal String Formatting Helpers
 * Guarantees output NEVER exceeds `width` characters so RawBT never wraps mid-line.
 */
export function padCenter(text: string, width = ROLL_WIDTH): string {
  const clean = text.trim();
  if (clean.length >= width) return clean.slice(0, width);
  const leftPadding = Math.floor((width - clean.length) / 2);
  const rightPadding = width - clean.length - leftPadding;
  return (' '.repeat(leftPadding) + clean + ' '.repeat(rightPadding)).slice(0, width);
}

export function padLeftRight(left: string, right: string, width = ROLL_WIDTH): string {
  const cleanRight = right.trim().slice(0, width);
  const cleanLeft = left.trim();
  const maxLeftLen = width - cleanRight.length - 1;

  if (maxLeftLen <= 0) {
    return (cleanLeft.slice(0, Math.max(0, width - cleanRight.length)) + cleanRight).slice(0, width);
  }

  const safeLeft = cleanLeft.length > maxLeftLen ? cleanLeft.slice(0, maxLeftLen) : cleanLeft;
  const spaces = Math.max(1, width - safeLeft.length - cleanRight.length);
  return (safeLeft + ' '.repeat(spaces) + cleanRight).slice(0, width);
}

export const padLine = padLeftRight;

export function divider(char = '-', width = ROLL_WIDTH): string {
  return char.repeat(width).slice(0, width);
}

/**
 * Word-wraps a dish item line cleanly across `width` monospace columns.
 * Indents subsequent lines by 5 spaces under the dish name column.
 * Strict guarantee: every returned string is sliced to <= `width`.
 */
export function wrapItemLine(qty: number, name: string, width = ROLL_WIDTH): string[] {
  const prefix = `${qty}x   `;
  const indent = '     ';
  const availableFirst = Math.max(1, width - prefix.length);
  const availableRest = Math.max(1, width - indent.length);

  const trimmedName = name.trim();
  if (prefix.length + trimmedName.length <= width) {
    return [(prefix + trimmedName).slice(0, width)];
  }

  const words = trimmedName.split(/\s+/);
  const resultLines: string[] = [];
  let currentLine = '';
  let isFirstLine = true;

  for (const word of words) {
    const limit = isFirstLine ? availableFirst : availableRest;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= limit) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        resultLines.push(((isFirstLine ? prefix : indent) + currentLine).slice(0, width));
        isFirstLine = false;
        currentLine = word;
      } else {
        resultLines.push(((isFirstLine ? prefix : indent) + word.slice(0, limit)).slice(0, width));
        isFirstLine = false;
        currentLine = word.slice(limit);
      }
    }
  }
  if (currentLine) {
    resultLines.push(((isFirstLine ? prefix : indent) + currentLine).slice(0, width));
  }
  return resultLines;
}

/**
 * 2. Thermal Monospace Formatter: Station KOT Slip
 * Clean plain-text layout (zero bracket tags).
 * Strict width enforcement (default: 48 columns for 80mm).
 * Renders prominent kitchen prep notes right below dishes list and above Total Station Items.
 */
export function formatSingleKotSlip(
  order: Order,
  kot: StationKot,
  options?: { isAddon?: boolean; addonTimeStr?: string },
  width = ROLL_WIDTH
): string {
  const lines: string[] = [];
  const isAddon = Boolean(options?.isAddon);
  const timeStr = formatTime(order.timestamp);
  const addonTime = options?.addonTimeStr || formatTime(new Date().toISOString());
  const token = order.token.startsWith('#') ? order.token : `#${order.token}`;

  // 1. Center Brand Header
  lines.push(padCenter('K O J I', width));
  lines.push(padCenter('Asian Crafted Fusion', width));
  lines.push(divider('=', width));

  // 2. Station title banner
  const bannerTitle = isAddon
    ? `*** ${kot.stationTitle.replace(' KOT', '')} (ADD-ON) ***`
    : `*** ${kot.stationTitle} ***`;
  lines.push(padCenter(bannerTitle, width));
  lines.push(divider('=', width));

  // 3. Token & Time Row
  if (isAddon) {
    lines.push(padLeftRight(`Ref Token: ${token}`, `Add-on: ${addonTime}`, width));
  } else {
    lines.push(padLeftRight(`Token: ${token}`, `Time: ${timeStr}`, width));
  }
  const orderTypeDisplay =
    order.orderType === 'Take Away' || order.orderType === 'Parcel'
      ? 'Parcel'
      : order.orderType === 'Car'
      ? 'Car'
      : 'Dine-in';
  lines.push(padLeftRight(`Order Type: ${orderTypeDisplay}`, '', width).trimEnd());

  // 4. Customer Details Row (if present)
  if (order.customerName || order.customerPhone) {
    const custParts: string[] = [];
    if (order.customerName) custParts.push(order.customerName);
    if (order.customerPhone) custParts.push(`(${order.customerPhone})`);
    const fullCustStr = `Customer: ${custParts.join(' ')}`;
    if (fullCustStr.length <= width) {
      lines.push(fullCustStr);
    } else {
      lines.push(`Customer: ${order.customerName || ''}`.slice(0, width));
      if (order.customerPhone) {
        lines.push(`  (${order.customerPhone})`.slice(0, width));
      }
    }
  }

  lines.push(divider('-', width));

  // 5. QTY & ITEM Header
  lines.push(padLeftRight('QTY   ITEM', '', width).trimEnd());
  lines.push(divider('-', width));

  // 6. Dishes rows formatted cleanly without markup
  kot.items.forEach((item) => {
    const itemLines = wrapItemLine(item.quantity, item.name, width);
    itemLines.forEach((l) => lines.push(l));

    // Per-dish preparation notes (indented under dish line)
    if (item.notes && item.notes.trim()) {
      const noteClean = `* Note: ${item.notes.trim()}`;
      if (noteClean.length + 5 <= width) {
        lines.push(`     ${noteClean}`.slice(0, width));
      } else {
        const words = noteClean.split(/\s+/);
        let cur = '     ';
        for (const w of words) {
          if ((cur + ' ' + w).length <= width) {
            cur += (cur.trim() ? ' ' : '') + w;
          } else {
            lines.push(cur.slice(0, width));
            cur = '     ' + w;
          }
        }
        if (cur.trim()) lines.push(cur.slice(0, width));
      }
    }
  });

  // 7. Prominent Kitchen Prep Notes section right below dishes list (and above Total Station Items)
  if (order.notes && order.notes.trim()) {
    lines.push(divider('-', width));
    const noteContent = `NOTES: ${order.notes.trim()}`;
    if (noteContent.length <= width) {
      lines.push(noteContent);
    } else {
      const words = noteContent.split(/\s+/);
      let curLine = '';
      for (const word of words) {
        if (!curLine) {
          curLine = word;
        } else if ((curLine + ' ' + word).length <= width) {
          curLine += ' ' + word;
        } else {
          lines.push(curLine.slice(0, width));
          curLine = word;
        }
      }
      if (curLine) lines.push(curLine.slice(0, width));
    }
  }

  lines.push(divider('-', width));
  const totalStationQty = kot.items.reduce((acc, i) => acc + i.quantity, 0);
  lines.push(padCenter(`Total Station Items: ${totalStationQty}`, width));
  lines.push(divider('=', width));

  return lines.join('\n');
}

/**
 * Formats all split station KOT slips with hardware auto-cut command between slips
 * so Posiflow KP307-UEWB cleanly cuts each station ticket independently.
 */
export function formatAllStationKots(
  order: Order,
  itemsOverride?: CartItem[],
  options?: { isAddon?: boolean; addonTimeStr?: string },
  width = ROLL_WIDTH
): string {
  const stations = getOrderStationKots(order, itemsOverride);
  if (stations.length === 0) return '';

  const formattedSlips = stations.map((st) =>
    formatSingleKotSlip(order, st, options, width)
  );

  // Each split station KOT ends with the hardware auto-cut command
  return formattedSlips.join(ESCPOS_AUTO_CUT) + ESCPOS_AUTO_CUT;
}

/**
 * Strict DD-MM-YYYY Date Formatter
 */
export function formatDDMMYYYY(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return '';
  }
}

/**
 * Strict hh:mm A Time Formatter
 */
export function formatTimeHHMMA(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minStr} ${ampm}`;
  } catch {
    return '';
  }
}

/**
 * 4-column itemized row formatter for 80mm (48-column) monospace thermal paper.
 * Column 1 (ITEM): 24 chars left-aligned (wrapped if >23 chars, indenting subsequent lines with 2 spaces)
 * Column 2 (QTY): 5 chars right-aligned
 * Column 3 (RATE): 9 chars right-aligned (0.00)
 * Column 4 (AMOUNT): 10 chars right-aligned (0.00)
 * Total width: 24 + 5 + 9 + 10 = 48 columns
 */
export function formatReceiptItemRow(
  name: string,
  qty: number,
  rate: number,
  lineTotal: number,
  width = ROLL_WIDTH
): string[] {
  const lines: string[] = [];
  const rateStr = rate.toFixed(2);
  const amountStr = lineTotal.toFixed(2);

  if (width === 48) {
    const qtyCol = String(qty).padStart(5, ' ');
    const rateCol = rateStr.padStart(9, ' ');
    const amountCol = amountStr.padStart(10, ' ');
    const numCols = qtyCol + rateCol + amountCol; // exactly 24 chars

    const trimmed = name.trim();
    if (trimmed.length <= 23) {
      lines.push((trimmed.padEnd(24, ' ') + numCols).slice(0, 48));
    } else {
      // Word wrap first line up to 23 chars so numbers stay vertically aligned
      const words = trimmed.split(/\s+/);
      let firstLine = '';
      let wordIdx = 0;
      while (wordIdx < words.length) {
        const candidate = firstLine ? `${firstLine} ${words[wordIdx]}` : words[wordIdx];
        if (candidate.length <= 23) {
          firstLine = candidate;
          wordIdx++;
        } else {
          break;
        }
      }
      if (!firstLine) {
        firstLine = trimmed.slice(0, 23);
        const remainder = trimmed.slice(23).trim();
        lines.push((firstLine.padEnd(24, ' ') + numCols).slice(0, 48));
        if (remainder) {
          lines.push(`  ${remainder}`.slice(0, 48));
        }
      } else {
        const remainder = words.slice(wordIdx).join(' ').trim();
        lines.push((firstLine.padEnd(24, ' ') + numCols).slice(0, 48));
        if (remainder) {
          let rem = remainder;
          while (rem.length > 0) {
            lines.push(`  ${rem.slice(0, 46)}`.slice(0, 48));
            rem = rem.slice(46).trim();
          }
        }
      }
    }
  } else {
    // Fallback for 32 columns (58mm)
    const qtyCol = String(qty).padStart(3, ' ');
    const rateCol = rateStr.padStart(7, ' ');
    const amountCol = amountStr.padStart(8, ' ');
    const numCols = qtyCol + rateCol + amountCol;
    const nameMax = Math.max(1, width - numCols.length);

    const trimmed = name.trim();
    if (trimmed.length <= nameMax - 1) {
      lines.push((trimmed.padEnd(nameMax, ' ') + numCols).slice(0, width));
    } else {
      lines.push((trimmed.slice(0, nameMax - 1).padEnd(nameMax, ' ') + numCols).slice(0, width));
      const rem = trimmed.slice(nameMax - 1).trim();
      if (rem) {
        lines.push(`  ${rem}`.slice(0, width));
      }
    }
  }

  return lines;
}

/**
 * Thermal Monospace Formatter: Customer Receipt (Invoice Layout)
 * Strict 48-column layout for Posiflow KP307-UEWB (80mm) via RawBT.
 * Matches exact itemized invoice specifications:
 * 1. Centered Header Block (Koji brand + New Magdalla address)
 * 2. Two-column Metadata Block (Bill No, Date DD-MM-YYYY, Customer, Time hh:mm A)
 * 3. Itemized Table (ITEM 24 | QTY 5 | RATE 9 | AMOUNT 10)
 * 4. Totals & Discount Breakdown (Subtotal, optional Discount & Net Taxable Amount, GRAND TOTAL Rs.X.00)
 * 5. Payment Mode & Centered Footer + Hardware Auto-Cut command (\n\n\n\x1D\x56\x42\x00)
 */
export function formatCustomerReceipt(order: Order, width = ROLL_WIDTH): string {
  const lines: string[] = [];

  // 1. Header Block (Centered across 48 columns)
  lines.push(padCenter('Koji - Asian Crafted Fusion', width));
  lines.push(padCenter('Behind Saibaba Mandir, New Magdalla', width));
  lines.push(padCenter('Dumas Road, Surat, Gujarat, 395007', width));
  lines.push(divider('=', width));

  // 2. Metadata Block (Two-column padded to 48 chars)
  const rawToken = (order as any).tokenNumber || order.token || '01';
  const tokenNumber = String(rawToken).replace(/^#/, '');
  const formattedDate =
    formatDDMMYYYY(order.timestamp) || formatDDMMYYYY(new Date().toISOString());
  const formattedTime =
    formatTimeHHMMA(order.timestamp) || formatTime(order.timestamp);

  const billNo = `Bill No: #${tokenNumber}`;
  const dateStr = `Date: ${formattedDate}`;
  lines.push(padLeftRight(billNo, dateStr, width));

  const rawCustomer =
    order.customerName && order.customerName.trim()
      ? order.customerName.trim()
      : 'Walk-in';
  const safeCustomer =
    rawCustomer.length > 24 ? `${rawCustomer.slice(0, 21)}...` : rawCustomer;
  const customerStr = `Customer: ${safeCustomer}`;
  const timeStr = `Time: ${formattedTime}`;
  lines.push(padLeftRight(customerStr, timeStr, width));
  const orderTypeDisplay =
    order.orderType === 'Take Away' || order.orderType === 'Parcel'
      ? 'Parcel'
      : order.orderType === 'Car'
      ? 'Car'
      : 'Dine-in';
  lines.push(padLeftRight(`Order Type: ${orderTypeDisplay}`, '', width).trimEnd());
  lines.push(divider('-', width));

  // 3. Itemized Table (Strict 48-column fixed-width alignment)
  if (width === 48) {
    lines.push('ITEM                      QTY     RATE    AMOUNT');
  } else {
    lines.push(padLeftRight('ITEM', 'QTY   RATE   AMOUNT', width));
  }
  lines.push(divider('-', width));

  const activeItems = (order.items || []).filter(
    (item) => item.status !== 'cancelled' && item.quantity > 0
  );

  activeItems.forEach((item) => {
    const rate = item.price;
    const lineTotal = item.price * item.quantity;
    const itemRows = formatReceiptItemRow(
      item.name,
      item.quantity,
      rate,
      lineTotal,
      width
    );
    itemRows.forEach((r) => lines.push(r));
  });

  lines.push(divider('-', width));

  // 4. Totals & Discount Breakdown (Right-aligned to column 48)
  const subtotal = activeItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  lines.push(padLeftRight('Subtotal', subtotal.toFixed(2), width));

  const anyOrder = order as any;
  const discountVal =
    typeof anyOrder.discount === 'number'
      ? anyOrder.discount
      : typeof anyOrder.discountAmount === 'number'
      ? anyOrder.discountAmount
      : 0;
  const discountPercent =
    typeof anyOrder.discountPercent === 'number' ? anyOrder.discountPercent : 0;

  if (discountVal > 0 || discountPercent > 0) {
    const discountAmount =
      discountVal > 0 ? discountVal : (subtotal * discountPercent) / 100;
    const discountLabel =
      discountPercent > 0
        ? `${discountPercent}%`
        : anyOrder.discountReason || 'Discount';
    const netAmount = Math.max(0, subtotal - discountAmount);

    lines.push(
      padLeftRight(
        `Discount (${discountLabel})`,
        `-${discountAmount.toFixed(2)}`,
        width
      )
    );
    lines.push(padLeftRight('Net Taxable Amount', netAmount.toFixed(2), width));
  }

  lines.push(divider('=', width));
  const grandTotal =
    order.totalAmount !== undefined ? order.totalAmount : subtotal;
  lines.push(padLeftRight('GRAND TOTAL', `Rs.${grandTotal.toFixed(2)}`, width));
  lines.push(divider('=', width));

  // 5. Payment Mode & Footer
  let paymentStatusText = 'Pending (Unpaid)';
  if (order.paymentStatus === 'Completed') {
    if (order.paymentMethod === 'UPI') {
      paymentStatusText = 'UPI (Paid)';
    } else if (order.paymentMethod === 'Cash') {
      paymentStatusText = 'Cash (Paid)';
    } else if (order.paymentMethod === 'UPI + Cash') {
      paymentStatusText = 'UPI + Cash (Paid)';
    } else if (order.paymentMethod) {
      paymentStatusText = `${order.paymentMethod} (Paid)`;
    } else {
      paymentStatusText = 'Paid';
    }
  } else if (order.paymentStatus === 'Partial') {
    const due = order.balanceDue !== undefined ? order.balanceDue : 0;
    paymentStatusText = `Partial (Due: Rs.${due.toFixed(2)})`;
  }

  lines.push(`Payment Mode: ${paymentStatusText}`.slice(0, width));
  lines.push(divider('-', width));
  lines.push(padCenter('Thank you for dining with us!', width));
  lines.push(padCenter('Please Visit again.', width));

  // Hardware auto-cut command at the end of the customer receipt
  return lines.join('\n') + ESCPOS_AUTO_CUT;
}

/**
 * Pure UTF-8 safe Base64 encoder (zero-dependency).
 * Properly encodes multi-byte Unicode strings for thermal printing.
 */
export function encodeUtf8Base64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const utf8Bytes: number[] = [];

  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      utf8Bytes.push(charcode);
    } else if (charcode < 0x800) {
      utf8Bytes.push(0xc0 | (charcode >> 6));
      utf8Bytes.push(0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8Bytes.push(0xe0 | (charcode >> 12));
      utf8Bytes.push(0x80 | ((charcode >> 6) & 0x3f));
      utf8Bytes.push(0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8Bytes.push(0xf0 | (charcode >> 18));
      utf8Bytes.push(0x80 | ((charcode >> 12) & 0x3f));
      utf8Bytes.push(0x80 | ((charcode >> 6) & 0x3f));
      utf8Bytes.push(0x80 | (charcode & 0x3f));
    }
  }

  let output = '';
  let i = 0;
  while (i < utf8Bytes.length) {
    const b1 = utf8Bytes[i++];
    const b2 = i < utf8Bytes.length ? utf8Bytes[i++] : NaN;
    const b3 = i < utf8Bytes.length ? utf8Bytes[i++] : NaN;

    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
    let enc3 = ((b2 & 15) << 2) | (b3 >> 6);
    let enc4 = b3 & 63;

    if (isNaN(b2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(b3)) {
      enc4 = 64;
    }

    output +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      chars.charAt(enc3) +
      chars.charAt(enc4);
  }

  return output;
}

/**
 * 3. RawBT Android Intent Dispatcher:
 * Dispatches thermal print job via deep-linking intent:
 * `rawbt:data:text/plain;base64,${base64EncodedContent}` (plain text URI scheme)
 */
export async function sendToRawBt(formattedText: string): Promise<boolean> {
  if (!formattedText.trim()) {
    console.warn('Empty Print Job: There are no active items to print.');
    return false;
  }

  const base64Data = encodeUtf8Base64(formattedText);
  const plainTextUrl = `rawbt:data:text/plain;base64,${base64Data}`;
  const rawbtUrl = `rawbt:base64,${base64Data}`;
  const playStoreMarketUrl = 'market://details?id=ru.a402d.rawbtprinter';
  const webPlayStoreUrl = 'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter';

  try {
    const canOpenPlain = await Linking.canOpenURL(plainTextUrl);
    if (canOpenPlain) {
      await Linking.openURL(plainTextUrl);
      return true;
    }
    const canOpen = await Linking.canOpenURL(rawbtUrl);
    if (canOpen) {
      await Linking.openURL(rawbtUrl);
      return true;
    }

    // Try direct launch with plain text URI
    try {
      await Linking.openURL(plainTextUrl);
      return true;
    } catch {
      try {
        await Linking.openURL(rawbtUrl);
        return true;
      } catch {
        // RawBT is not installed on this Android device - automatically launch Play Store
        Linking.canOpenURL(playStoreMarketUrl)
          .then((canOpenMarket) => {
            if (canOpenMarket) {
              Linking.openURL(playStoreMarketUrl);
            } else {
              Linking.openURL(webPlayStoreUrl);
            }
          })
          .catch(() => {
            Linking.openURL(webPlayStoreUrl);
          });
        return false;
      }
    }
  } catch (err: any) {
    console.warn('Printing Error: Could not dispatch print job to RawBT.', err);
    return false;
  }
}

/**
 * Print Station KOTs for an order
 */
export async function printStationKots(order: Order, widthOverride?: number): Promise<boolean> {
  const width = widthOverride ?? (await getPaperWidthPreference());
  const content = formatAllStationKots(order, undefined, undefined, width);
  if (!content) {
    console.warn('No active kitchen items found for this order.');
    return false;
  }
  return sendToRawBt(content);
}

/**
 * Print Station KOTs ONLY for newly added, unprinted add-on items.
 * Banners:
 * "*** [STATION NAME] (ADD-ON) ***"
 * "Ref Token: #[token] | Add-on Time: [hh:mm AM/PM]"
 */
export async function printAddonStationKots(
  order: Order,
  unprintedAddons: CartItem[],
  widthOverride?: number
): Promise<boolean> {
  const activeUnprinted = unprintedAddons.filter(
    (i) => i.status !== 'cancelled' && i.quantity > 0
  );
  if (activeUnprinted.length === 0) {
    return false;
  }

  const width = widthOverride ?? (await getPaperWidthPreference());

  // Determine add-on timestamp from items
  const latestAddedAt =
    activeUnprinted.find((i) => i.addedAt)?.addedAt || new Date().toISOString();
  const addonTimeStr = formatTime(latestAddedAt);

  const content = formatAllStationKots(
    order,
    activeUnprinted,
    {
      isAddon: true,
      addonTimeStr,
    },
    width
  );

  if (!content) {
    return false;
  }

  return sendToRawBt(content);
}

/**
 * Formats a thermal slip for an item cancellation alert
 */
export function formatCancelledItemKot(
  order: Order,
  cancelledItem: CartItem,
  cancelledQty = 1,
  reason?: string,
  width = ROLL_WIDTH
): string {
  const lines: string[] = [];
  const timeStr = formatTime(new Date().toISOString());
  const token = order.token.startsWith('#') ? order.token : `#${order.token}`;

  lines.push(padCenter('K O J I', width));
  lines.push(padCenter('Asian Crafted Fusion', width));
  lines.push(divider('=', width));
  lines.push(padCenter('*** CANCELLED ITEM ***', width));
  lines.push(divider('=', width));

  lines.push(padLeftRight(`Token: ${token}`, `Time: ${timeStr}`, width));
  const orderTypeDisplay =
    order.orderType === 'Take Away' || order.orderType === 'Parcel'
      ? 'Parcel'
      : order.orderType === 'Car'
      ? 'Car'
      : 'Dine-in';
  lines.push(padLeftRight(`Order Type: ${orderTypeDisplay}`, '', width).trimEnd());

  if (order.customerName || order.customerPhone) {
    const custParts: string[] = [];
    if (order.customerName) custParts.push(order.customerName);
    if (order.customerPhone) custParts.push(`(${order.customerPhone})`);
    lines.push(`Customer: ${custParts.join(' ')}`.slice(0, width));
  }

  lines.push(divider('-', width));
  lines.push(padLeftRight('QTY   ITEM', '', width).trimEnd());
  lines.push(divider('-', width));

  const itemLines = wrapItemLine(cancelledQty, cancelledItem.name, width);
  itemLines.forEach((l) => lines.push(l));

  if (reason && reason.trim()) {
    lines.push(divider('-', width));
    lines.push(`Reason: ${reason.trim()}`.slice(0, width));
  }

  lines.push(divider('=', width));
  lines.push(padCenter('DO NOT PREPARE / DISCARD', width));
  lines.push(divider('=', width));

  return lines.join('\n') + ESCPOS_AUTO_CUT;
}

/**
 * Print Cancelled Item KOT Alert
 */
export async function printCancelledItemKot(
  order: Order,
  cancelledItem: CartItem,
  cancelledQty = 1,
  reason?: string,
  widthOverride?: number
): Promise<boolean> {
  const width = widthOverride ?? (await getPaperWidthPreference());
  const content = formatCancelledItemKot(order, cancelledItem, cancelledQty, reason, width);
  return sendToRawBt(content);
}

/**
 * Formats a thermal slip for a full order cancellation alert
 */
export function formatCancelledOrderKot(
  order: Order,
  reason?: string,
  width = ROLL_WIDTH
): string {
  const lines: string[] = [];
  const timeStr = formatTime(new Date().toISOString());
  const token = order.token.startsWith('#') ? order.token : `#${order.token}`;

  lines.push(padCenter('K O J I', width));
  lines.push(padCenter('Asian Crafted Fusion', width));
  lines.push(divider('=', width));
  lines.push(padCenter('*** FULL ORDER CANCELLED ***', width));
  lines.push(divider('=', width));

  lines.push(padLeftRight(`Token: ${token}`, `Time: ${timeStr}`, width));
  const orderTypeDisplay =
    order.orderType === 'Take Away' || order.orderType === 'Parcel'
      ? 'Parcel'
      : order.orderType === 'Car'
      ? 'Car'
      : 'Dine-in';
  lines.push(padLeftRight(`Order Type: ${orderTypeDisplay}`, '', width).trimEnd());

  if (order.customerName || order.customerPhone) {
    const custParts: string[] = [];
    if (order.customerName) custParts.push(order.customerName);
    if (order.customerPhone) custParts.push(`(${order.customerPhone})`);
    lines.push(`Customer: ${custParts.join(' ')}`.slice(0, width));
  }

  lines.push(divider('-', width));
  lines.push(padLeftRight('QTY   ITEM', '', width).trimEnd());
  lines.push(divider('-', width));

  order.items.forEach((item) => {
    const itemLines = wrapItemLine(item.quantity, item.name, width);
    itemLines.forEach((l) => lines.push(l));
  });

  if (reason && reason.trim()) {
    lines.push(divider('-', width));
    lines.push(`Reason: ${reason.trim()}`.slice(0, width));
  }

  lines.push(divider('=', width));
  lines.push(padCenter('STOP ALL PREPARATION', width));
  lines.push(divider('=', width));

  return lines.join('\n') + ESCPOS_AUTO_CUT;
}

/**
 * Print Cancelled Order KOT Alert
 */
export async function printCancelledOrderKot(
  order: Order,
  reason?: string,
  widthOverride?: number
): Promise<boolean> {
  const width = widthOverride ?? (await getPaperWidthPreference());
  const content = formatCancelledOrderKot(order, reason, width);
  return sendToRawBt(content);
}

/**
 * Print Customer Receipt for an order
 */
export async function printCustomerReceipt(order: Order, widthOverride?: number): Promise<boolean> {
  const width = widthOverride ?? (await getPaperWidthPreference());
  const content = formatCustomerReceipt(order, width);
  return sendToRawBt(content);
}

/**
 * Auto-print preference persistence
 */
export async function getAutoPrintPreference(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(AUTOPRINT_STORAGE_KEY);
    return val === null ? true : val === 'true'; // Default: enabled
  } catch {
    return true;
  }
}

export async function setAutoPrintPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTOPRINT_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {}
}
