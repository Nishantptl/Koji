import { Linking, Alert, Platform } from 'react-native';
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
    Alert.alert(
      'Missing Phone Number',
      'Please ensure the customer has a valid phone number recorded for SMS notifications.'
    );
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
      Alert.alert(
        'SMS Failed',
        err?.message || 'Could not open native SMS application on this device.'
      );
      return false;
    }
  }
}

/**
 * Prompts user to send via SMS when WhatsApp is unavailable.
 */
function promptSmsFallback(phone: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'WhatsApp Unavailable',
      'WhatsApp Business / WhatsApp is not installed or could not be opened. Would you like to send this pickup alert via SMS instead?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Send via SMS',
          style: 'default',
          onPress: async () => {
            const smsSent = await sendSmsNotification(phone, message);
            resolve(smsSent);
          },
        },
      ]
    );
  });
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
    Alert.alert(
      'Missing Phone Number',
      'Please ensure the customer has a valid 10-digit phone number recorded for notifications.'
    );
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
 * Format:
 * "Hi [CustomerName]! Your *[qty]x [DishName]* (Token #[token]) is hot and ready at *Kōji*! Please collect it from the counter. 🍣"
 */
export async function sendDishReadyNotification(
  order: Order,
  item: CartItem
): Promise<boolean> {
  if (!order.customerPhone) {
    Alert.alert(
      'No Contact Number',
      'This order does not have a customer phone number recorded.'
    );
    return false;
  }

  const customerName = order.customerName?.trim() || 'there';
  const token = order.token.startsWith('#') ? order.token : `#${order.token}`;
  const message = `Hi ${customerName}! Your *${item.quantity}x ${item.name}* (Token ${token}) is hot and ready at *Kōji*! Please collect it from the counter. 🍣`;

  return openCustomerNotification(order.customerPhone, message);
}

/**
 * Option B: Complete Order Ready Pickup Notification
 * Format:
 * "Hi [CustomerName]! Your complete order *(Token #[token])* is ready for pickup at *Kōji*! 🥢
 * • [qty]x [Dish 1]
 * • [qty]x [Dish 2]
 * Please collect it from the counter!"
 */
export async function sendOrderReadyNotification(
  order: Order
): Promise<boolean> {
  if (!order.customerPhone) {
    Alert.alert(
      'No Contact Number',
      'This order does not have a customer phone number recorded.'
    );
    return false;
  }

  const customerName = order.customerName?.trim() || 'there';
  const token = order.token.startsWith('#') ? order.token : `#${order.token}`;

  const activeItems = order.items.filter(
    (i) => i.status !== 'cancelled' && i.quantity > 0
  );

  const itemList =
    activeItems.length > 0
      ? activeItems.map((i) => `• ${i.quantity}x ${i.name}`).join('\n')
      : `• ${order.items.length} dishes`;

  const message = `Hi ${customerName}! Your complete order *(Token ${token})* is ready for pickup at *Kōji*! 🥢\n${itemList}\nPlease collect it from the counter!`;

  return openCustomerNotification(order.customerPhone, message);
}

/**
 * Option C: Newly Added Add-on Items Ready Pickup Notification
 * Format:
 * "Hi [CustomerName]! Your newly added items *(Token #[token])* are ready for pickup at *Kōji*! 🥢
 * • [qty]x [New Dish]
 * Please collect them from the counter!"
 */
export async function sendAddonReadyNotification(
  order: Order,
  unnotifiedItems: CartItem[]
): Promise<boolean> {
  if (!order.customerPhone) {
    Alert.alert(
      'No Contact Number',
      'This order does not have a customer phone number recorded.'
    );
    return false;
  }

  const customerName = order.customerName?.trim() || 'there';
  const token = order.token.startsWith('#') ? order.token : `#${order.token}`;

  const activeUnnotified = unnotifiedItems.filter(
    (i) => i.status !== 'cancelled' && i.quantity > 0
  );

  const itemList =
    activeUnnotified.length > 0
      ? activeUnnotified.map((i) => `• ${i.quantity}x ${i.name}`).join('\n')
      : `• New add-on items`;

  const message = `Hi ${customerName}! Your newly added items *(Token ${token})* are ready for pickup at *Kōji*! 🥢\n${itemList}\nPlease collect them from the counter!`;

  return openCustomerNotification(order.customerPhone, message);
}
