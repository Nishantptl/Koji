import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { UtensilsCrossed, ClipboardList, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TakeOrderScreen } from './src/screens/TakeOrderScreen';
import { OrderListScreen } from './src/screens/OrderListScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { CartProvider } from './src/context/CartContext';
import { getDailyMetrics, checkAndHandleDailyRollover } from './src/services/storage';
import { COLORS, FONTS, SPACING } from './src/constants/theme';

type Tab = 'take_order' | 'orders_timeline' | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('take_order');
  const [ordersRefreshTrigger, setOrdersRefreshTrigger] = useState<number>(0);
  const [menuRefreshTrigger, setMenuRefreshTrigger] = useState<number>(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);

  // Sync active order count for the tab badge
  const updateMetricsCount = useCallback(async () => {
    try {
      const metrics = await getDailyMetrics();
      setActiveOrdersCount(metrics.activeOrders);
    } catch {
      // Ignore
    }
  }, []);

  // Automatic Daily Token Reset (Midnight Rollover Safeguard)
  // Check on launch, AppState foreground transitions, and periodic interval
  useEffect(() => {
    const handleCheckRollover = async () => {
      try {
        const { isRollover } = await checkAndHandleDailyRollover();
        if (isRollover) {
          setOrdersRefreshTrigger((prev) => prev + 1);
          setMenuRefreshTrigger((prev) => prev + 1);
          updateMetricsCount();
        }
      } catch {
        // Fallback
      }
    };

    // 1. Initial launch check
    handleCheckRollover();

    // 2. Foreground transition check
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        handleCheckRollover();
        updateMetricsCount();
      }
    });

    // 3. Periodic safeguard check (every 30s) in case terminal remains awake continuously past midnight
    const interval = setInterval(handleCheckRollover, 30000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [updateMetricsCount]);

  useEffect(() => {
    let isMounted = true;
    getDailyMetrics()
      .then((metrics) => {
        if (isMounted) {
          setActiveOrdersCount(metrics.activeOrders);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [ordersRefreshTrigger]);

  const handleTabSwitch = (tab: Tab) => {
    if (tab !== activeTab) {
      try {
        Haptics.selectionAsync();
      } catch {
        // Ignore
      }
      setActiveTab(tab);
      if (tab === 'orders_timeline') {
        setOrdersRefreshTrigger((prev) => prev + 1);
      }
      if (tab === 'take_order') {
        setMenuRefreshTrigger((prev) => prev + 1);
      }
    }
  };

  const handleOrderSaved = () => {
    setOrdersRefreshTrigger((prev) => prev + 1);
    updateMetricsCount();
  };

  const handleOrdersChanged = () => {
    setOrdersRefreshTrigger((prev) => prev + 1);
    updateMetricsCount();
  };

  const handleMenuChanged = () => {
    setMenuRefreshTrigger((prev) => prev + 1);
  };

  return (
    <SafeAreaProvider>
      <CartProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar style="dark" />

          {/* Screen View */}
          <View style={styles.screenContainer}>
            {activeTab === 'take_order' ? (
              <TakeOrderScreen
                onOrderSaved={handleOrderSaved}
                menuRefreshTrigger={menuRefreshTrigger}
              />
            ) : activeTab === 'orders_timeline' ? (
              <OrderListScreen
                refreshTrigger={ordersRefreshTrigger}
                onNavigateToPOS={() => handleTabSwitch('take_order')}
                onOrdersChanged={handleOrdersChanged}
              />
            ) : (
              <AdminScreen onMenuChanged={handleMenuChanged} />
            )}
          </View>

          {/* Sleek Bottom Navigation Dock (3 Tabs) */}
          <SafeAreaView edges={['bottom']} style={styles.bottomNavWrapper}>
            <View style={styles.tabBar}>
              {/* Tab 1: Take Order */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleTabSwitch('take_order')}
                style={[
                  styles.tabItem,
                  activeTab === 'take_order' && styles.tabItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Take Order Station"
              >
                <UtensilsCrossed
                  size={18}
                  color={
                    activeTab === 'take_order' ? COLORS.ivory : COLORS.textMuted
                  }
                  strokeWidth={2.4}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'take_order'
                      ? styles.tabTextActive
                      : styles.tabTextInactive,
                  ]}
                >
                  Take Order
                </Text>
              </TouchableOpacity>

              {/* Tab 2: Orders Timeline */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleTabSwitch('orders_timeline')}
                style={[
                  styles.tabItem,
                  activeTab === 'orders_timeline' && styles.tabItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Orders Timeline"
              >
                <View style={styles.iconWithBadge}>
                  <ClipboardList
                    size={18}
                    color={
                      activeTab === 'orders_timeline'
                        ? COLORS.ivory
                        : COLORS.textMuted
                    }
                    strokeWidth={2.4}
                  />
                  {activeOrdersCount > 0 && (
                    <View style={[styles.tabBadge, styles.tabBadgeOnActive]}>
                      <Text
                        style={[
                          styles.tabBadgeText,
                          styles.tabBadgeTextOnActive,
                        ]}
                      >
                        {activeOrdersCount > 99 ? '99+' : activeOrdersCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'orders_timeline'
                      ? styles.tabTextActive
                      : styles.tabTextInactive,
                  ]}
                >
                  Timeline
                </Text>
              </TouchableOpacity>

              {/* Tab 3: Admin */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleTabSwitch('admin')}
                style={[
                  styles.tabItem,
                  activeTab === 'admin' && styles.tabItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Admin & Menu Management"
              >
                <Settings
                  size={18}
                  color={
                    activeTab === 'admin' ? COLORS.ivory : COLORS.textMuted
                  }
                  strokeWidth={2.4}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'admin'
                      ? styles.tabTextActive
                      : styles.tabTextInactive,
                  ]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </CartProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  screenContainer: {
    flex: 1,
  },
  bottomNavWrapper: {
    backgroundColor: COLORS.ivory,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: Platform.OS === 'android' ? SPACING.xs : 2,
    backgroundColor: COLORS.ivory,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  tabItemActive: {
    backgroundColor: COLORS.organic,      // Organic #3F422E background
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  iconWithBadge: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeOnActive: {
    backgroundColor: COLORS.apricot,
  },
  tabBadgeMuted: {
    backgroundColor: COLORS.textMuted,
  },
  tabBadgeOnInactive: {
    backgroundColor: COLORS.apricot,
  },
  tabBadgeText: {
    fontSize: 9,
    ...FONTS.heavy,
  },
  tabBadgeTextOnActive: {
    color: COLORS.ivory,
  },
  tabBadgeTextOnInactive: {
    color: COLORS.ivory,
  },
  tabText: {
    fontSize: 12,
  },
  tabTextActive: {
    color: COLORS.ivory,                  // Ivory #F5E6C5 text
    ...FONTS.bold,
  },
  tabTextInactive: {
    color: COLORS.organic,
    ...FONTS.medium,
  },
});
