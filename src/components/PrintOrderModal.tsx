import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  X,
  Printer,
  Receipt,
  Layers,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Order } from '../types';
import { TokenBadge } from './TokenBadge';
import {
  getOrderStationKots,
  printStationKots,
  printCustomerReceipt,
} from '../services/printService';
import { markOrderItemsAsPrinted } from '../services/storage';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface PrintOrderModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
}

export const PrintOrderModal: React.FC<PrintOrderModalProps> = ({
  visible,
  order,
  onClose,
}) => {
  const stations = useMemo(() => {
    if (!order) return [];
    return getOrderStationKots(order);
  }, [order]);

  if (!order || !visible) return null;

  const handlePrintKots = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const sent = await printStationKots(order);
    if (sent) {
      await markOrderItemsAsPrinted(order.id);
      onClose();
    }
  };

  const handlePrintReceipt = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const sent = await printCustomerReceipt(order);
    if (sent) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <TokenBadge token={order.token} variant="apricot" size="md" />
                  <View>
                    <Text style={styles.headerTitle}>Print Station Slips</Text>
                    <Text style={styles.headerSubtitle}>
                      Thermal 80mm via RawBT Print Service
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.closeBtn}
                >
                  <X size={18} color={COLORS.forest} />
                </TouchableOpacity>
              </View>

              {/* Detected Stations Banner */}
              <View style={styles.stationsBanner}>
                <View style={styles.stationsBannerHeader}>
                  <Layers size={13} color={COLORS.forest} />
                  <Text style={styles.stationsBannerTitle}>
                    ACTIVE KITCHEN STATIONS ({stations.length})
                  </Text>
                </View>

                <View style={styles.stationPillsRow}>
                  {stations.length === 0 ? (
                    <Text style={styles.noStationsText}>No active kitchen items</Text>
                  ) : (
                    stations.map((st) => (
                      <View key={st.stationKey} style={styles.stationPill}>
                        <Text style={styles.stationPillText}>
                          {st.stationTitle.replace(' KOT', '')} (
                          {st.items.reduce((sum, i) => sum + i.quantity, 0)})
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>

              {/* Action 1: Print Split Station KOTs */}
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={handlePrintKots}
                disabled={stations.length === 0}
                style={[
                  styles.optionCard,
                  stations.length === 0 && styles.cardDisabled,
                ]}
              >
                <View style={styles.optionIconContainer}>
                  <Printer size={22} color={COLORS.forest} strokeWidth={2.2} />
                </View>
                <View style={styles.optionTextGroup}>
                  <Text style={styles.optionTitle}>
                    Print Split Station KOTs
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Prints {stations.length} station slips separated with auto-cut
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Action 2: Print Customer Bill */}
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={handlePrintReceipt}
                style={styles.optionCard}
              >
                <View style={styles.optionIconContainer}>
                  <Receipt size={22} color={COLORS.forest} strokeWidth={2.2} />
                </View>
                <View style={styles.optionTextGroup}>
                  <Text style={styles.optionTitle}>
                    Print Customer Bill
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Itemized bill • ₹{order.totalAmount} • {order.paymentStatus || 'Pending'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: COLORS.white,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.forest,
    padding: SPACING.lg,
    shadowColor: COLORS.forest,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.medium,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationsBanner: {
    backgroundColor: COLORS.sage,
    borderRadius: 12,
    padding: 10,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stationsBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  stationsBannerTitle: {
    fontSize: 10,
    color: COLORS.forest,
    ...FONTS.heavy,
    letterSpacing: 0.5,
  },
  stationPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stationPill: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.forest,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stationPillText: {
    fontSize: 10.5,
    color: COLORS.forest,
    ...FONTS.bold,
  },
  noStationsText: {
    fontSize: 11,
    color: COLORS.slate,
    fontStyle: 'italic',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.canvas,
    marginBottom: 10,
    gap: 12,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionTextGroup: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    color: COLORS.forest,
    ...FONTS.bold,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 11,
    color: COLORS.slate,
    ...FONTS.regular,
  },
});
