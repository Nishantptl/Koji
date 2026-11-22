import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import { Order, CartItem } from '../types';

export type NotificationChannel = 'whatsapp_business' | 'whatsapp' | 'sms';

export const NOTIFY_CHANNEL_STORAGE_KEY = '@koji_notify_channel';

/**
 * Retrieves the preferred notification channel (defaults to 'whatsapp_business').
 */
export async function getNotificationChannelPreference(): Promise<NotificationChannel> {
  try {
    const val = await AsyncStorage.getItem(NOTIFY_CHANNEL_STORAGE_KEY);
    if (val === 'whatsapp_business' || val === 'whatsapp' || val === 'sms') {
      return val;
    }
  } catch {}
  return 'whatsapp_business';
}

/**
 * Persists the preferred notification channel.
 */
export async function setNotificationChannelPreference(
  channel: NotificationChannel
): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFY_CHANNEL_STORAGE_KEY, channel);
  } catch {}
}

/**
 * Sanitizes customer phone: strips non-digits; if 10 digits, prepends '91'.
 */
export function sanitizeWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

/**
 * Sends a native text SMS to the customer with fallback URL schemes.
 */
export async function sendSmsNotification(
  phone: string,
  message: string
): Promise<boolean> {
  const sanitized = sanitizeWhatsAppPhone(phone);
  if (!sanitized || sanitized.length < 10) {
    console.warn('Missing Phone Number: Customer does not have a valid phone number recorded for SMS.');
    return false;
  }

  const encodedBody = encodeURIComponent(message);
  const smsUrl = `sms:${sanitized}?body=${encodedBody}`;

  try {
    await Linking.openURL(smsUrl);
    return true;
  } catch (err: any) {
    try {
      await Linking.openURL(`sms:+${sanitized}?body=${encodedBody}`);
      return true;
    } catch {
      console.warn('SMS Failed:', err?.message || 'Could not open native SMS application on this device.');
      return false;
    }
  }
}

/**
 * Prompts user to send via SMS when WhatsApp is unavailable.
 */
function promptSmsFallback(phone: string, message: string): Promise<boolean> {
  console.warn('WhatsApp is unavailable, attempting automatic fallback to native SMS.');
  return sendSmsNotification(phone, message);
}

/**
 * Dispatches notification to customer via preferred channel:
 * - On Android: uses expo-intent-launcher to open WhatsApp Business (com.whatsapp.w4b) or WhatsApp (com.whatsapp) directly
 * - Clean try/catch fallback chain to standard WhatsApp or SMS alert
 */
export async function openCustomerNotification(
  phone: string,
  message: string,
  channelOverride?: NotificationChannel
): Promise<boolean> {
  const sanitized = sanitizeWhatsAppPhone(phone);
  if (!sanitized || sanitized.length < 10) {
    console.warn('Missing Phone Number: Customer does not have a valid 10-digit phone number recorded for notifications.');
    return false;
  }

  const channel = channelOverride || (await getNotificationChannelPreference());

  if (channel === 'sms') {
    return sendSmsNotification(phone, message);
  }

  const encodedText = encodeURIComponent(message);
  const waUrl = `https://api.whatsapp.com/send?phone=${sanitized}&text=${encodedText}`;
  const waUniversalUrl = `https://wa.me/${sanitized}?text=${encodedText}`;
  const waSchemeUrl = `whatsapp://send?phone=${sanitized}&text=${encodedText}`;

  if (Platform.OS === 'android') {
    const primaryPackage =
      channel === 'whatsapp_business' ? 'com.whatsapp.w4b' : 'com.whatsapp';
    const fallbackPackage =
      channel === 'whatsapp_business' ? 'com.whatsapp' : 'com.whatsapp.w4b';

    // 1. Try primary selected package via direct Android Intent
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: waUrl,
        packageName: primaryPackage,
      });
      return true;
    } catch {
      // 2. Try secondary fallback package via Android Intent
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: waUrl,
          packageName: fallbackPackage,
        });
        return true;
      } catch {
        // 3. Try standard Linking openURL
        try {
          await Linking.openURL(waUniversalUrl);
          return true;
        } catch {
          // 4. Prompt SMS fallback
          return promptSmsFallback(phone, message);
        }
      }
    }
  } else {
    // iOS / other platforms
    try {
      const canOpenScheme = await Linking.canOpenURL(waSchemeUrl);
      if (canOpenScheme) {
        await Linking.openURL(waSchemeUrl);
        return true;
      }
      await Linking.openURL(waUniversalUrl);
      return true;
    } catch {
      return promptSmsFallback(phone, message);
    }
  }
}

/**
 * Universal wrapper maintaining backward compatibility.
 */
export async function openWhatsAppMessage(
  phone: string,
  message: string
): Promise<boolean> {
  return openCustomerNotification(phone, message);
}

/**
 * Option A: Single Dish Ready Pickup Notification
 */
export async function sendDishReadyNotification(
  order: Order,
  item: CartItem
): Promise<boolean> {
  if (!order.customerPhone) {
    console.warn('No Contact Number: This order does not have a customer phone number recorded.');
    return false;
  }

  const customerName = order.customerName?.trim() || 'there';
  const cleanToken = order.token.replace(/^#+/, '');
  const message = `Hi ${customerName}! 🥢 Your added items for (Token #${cleanToken}) are ready for pickup at Kōji:\n\n- ${item.quantity}x ${item.name}\n\nPlease collect them from the counter!`;

  return openCustomerNotification(order.customerPhone, message);
}

/**
 * Option B: Complete Order Ready Pickup Notification
 */
export async function sendOrderReadyNotification(
  order: Order
): Promise<boolean> {
  if (!order.customerPhone) {
    console.warn('No Contact Number: This order does not have a customer phone number recorded.');
    return false;
  }

  const customerName = order.customerName?.trim() || 'there';
  const cleanToken = order.token.replace(/^#+/, '');

  const activeItems = order.items.filter(
    (i) => i.status !== 'cancelled' && i.quantity > 0
  );

  const itemList =
    activeItems.length > 0
      ? activeItems.map((i) => `- ${i.quantity}x ${i.name}`).join('\n')
      : `- ${order.items.length} dishes`;

  const message = `Hi ${customerName}! 🍣 Your order (Token #${cleanToken}) at Kōji is freshly prepared and ready for pickup at the counter:\n\n${itemList}\n\nBest enjoyed fresh—see you at the counter!`;

  return openCustomerNotification(order.customerPhone, message);
}

/**
 * Option C: Newly Added Add-on Items Ready Pickup Notification
 */
export async function sendAddonReadyNotification(
  order: Order,
  unnotifiedItems: CartItem[]
): Promise<boolean> {
  if (!order.customerPhone) {
    console.warn('No Contact Number: This order does not have a customer phone number recorded.');
    return false;
  }

  const customerName = order.customerName?.trim() || 'there';
  const cleanToken = order.token.replace(/^#+/, '');

  const activeUnnotified = unnotifiedItems.filter(
    (i) => i.status !== 'cancelled' && i.quantity > 0
  );

  const itemList =
    activeUnnotified.length > 0
      ? activeUnnotified.map((i) => `- ${i.quantity}x ${i.name}`).join('\n')
      : `- Added items`;

  const message = `Hi ${customerName}! 🥢 Your added items for (Token #${cleanToken}) are ready for pickup at Kōji:\n\n${itemList}\n\nPlease collect them from the counter!`;

  return openCustomerNotification(order.customerPhone, message);
}
