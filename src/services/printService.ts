import { Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order, CartItem } from '../types';
import { formatTime, formatDate } from './storage';

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
 * Thermal Monospace Formatter: Customer Receipt
 * Strict width enforcement (48 cols for 80mm).
 * Shows strictly: Header, Token/Time/Date/Customer, Itemized Dishes & Prices, Total Amount, and Footer.
 * Zero prep notes, zero AMOUNT PAID, and zero PAYMENT: PAID status lines.
 */
export function formatCustomerReceipt(order: Order, width = ROLL_WIDTH): string {
  const lines: string[] = [];
  const timeStr = formatTime(order.timestamp);
  const dateStr = formatDate(order.timestamp);
  const token = order.token.startsWith('#') ? order.token : `#${order.token}`;

  // Header
  lines.push(padCenter('K O J I', width));
  lines.push(padCenter('Asian Crafted Fusion', width));
  lines.push(divider('=', width));
  lines.push(padCenter('*** CUSTOMER RECEIPT ***', width));
  lines.push(divider('=', width));

  // Order Details
  lines.push(padLeftRight(`Token: ${token}`, `Time: ${timeStr}`, width));
  lines.push(`Date: ${dateStr}`.slice(0, width));

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
  lines.push(padLeftRight('ITEMS', 'PRICE (Rs)', width));
  lines.push(divider('-', width));

  // Dishes List with unit and line totals
  order.items.forEach((item) => {
    if (item.status === 'cancelled') return;
    const itemTotal = item.price * item.quantity;
    const itemTitle = `${item.quantity}x ${item.name}`;
    const priceStr = `Rs.${itemTotal}`;

    if ((itemTitle + ' ' + priceStr).length <= width) {
      lines.push(padLeftRight(itemTitle, priceStr, width));
    } else {
      lines.push(itemTitle.slice(0, width));
      lines.push(padLeftRight(`  @ Rs.${item.price}`, priceStr, width));
    }
  });

  lines.push(divider('-', width));

  // Bill Total
  lines.push(padLeftRight('TOTAL AMOUNT:', `Rs.${order.totalAmount}`, width));

  lines.push(divider('=', width));
  lines.push(padCenter('Thank you for dining with us!', width));
  lines.push(padCenter('Please visit again', width));

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
    Alert.alert('Empty Print Job', 'There are no active items to print.');
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
        // RawBT is not installed on this Android device
        Alert.alert(
          'RawBT Print Service Required',
          'To print KOTs and receipts to your thermal printer, please install the RawBT Print Service app from Google Play.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Install RawBT',
              onPress: () => {
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
              },
            },
          ]
        );
        return false;
      }
    }
  } catch (err: any) {
    Alert.alert('Printing Error', err?.message || 'Could not dispatch print job to RawBT.');
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
    Alert.alert('No Items', 'No active kitchen items found for this order.');
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
