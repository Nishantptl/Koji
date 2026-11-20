import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { X, Printer, Scissors } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface ThermalReceiptPreviewModalProps {
  visible: boolean;
  title?: string;
  rawContent: string;
  onClose: () => void;
  onPrint: () => void;
}

export const ThermalReceiptPreviewModal: React.FC<ThermalReceiptPreviewModalProps> = ({
  visible,
  title = '80mm Thermal Preview',
  rawContent,
  onClose,
  onPrint,
}) => {
  if (!visible) return null;

  const handlePrint = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onPrint();
  };

  // Strip non-printable ESC/POS control bytes (\x1D\x56\x42\x00) and replace with visual auto-cut divider
  const normalizedContent = (rawContent || '')
    .replace(/\r/g, '')
    .replace(/\n*\x1D\x56\x42\x00\n*/g, '\n[AUTO_CUT_MARKER]\n')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  const lines = normalizedContent.split('\n');

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
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{title}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.closeBtn}
                  accessibilityLabel="Close preview"
                >
                  <X size={18} color={COLORS.ivory} />
                </TouchableOpacity>
              </View>

              {/* Thermal Paper Slip (Fixed 340dp Width with Horizontal Fallback) */}
              <View style={styles.paperWrapper}>
                <View style={styles.paperPaper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScrollContent}
                  >
                    <ScrollView
                      style={styles.paperScroll}
                      contentContainerStyle={styles.paperScrollContent}
                      showsVerticalScrollIndicator={true}
                    >
                      {lines.map((line, idx) => {
                        const trimmed = line.trim();

                        // 1. Hardware auto-cut / tear guideline check
                        if (
                          trimmed === '[AUTO_CUT_MARKER]' ||
                          trimmed.includes('---- TEAR HERE ----') ||
                          trimmed.includes('AUTO-CUT')
                        ) {
                          return (
                            <View key={`cut_${idx}`} style={styles.tearContainer}>
                              <View style={styles.tearDashedLine} />
                              <View style={styles.tearBadge}>
                                <Scissors size={10} color="#555" />
                                <Text style={styles.tearBadgeText}>✂ AUTO-CUT</Text>
                              </View>
                              <View style={styles.tearDashedLine} />
                            </View>
                          );
                        }

                        // 2. Empty spacer line
                        if (!trimmed) {
                          return <View key={`empty_${idx}`} style={styles.emptyLine} />;
                        }

                        // Clean text by stripping any leftover bracket tags (zero literal tags)
                        const cleanText = line
                          .replace(/\[\/?(C|L|R|B|H|I|W)\]/gi, '');

                        const isDivider = /^[-=]{10,}$/.test(trimmed);
                        const isHeader = cleanText.includes('***') || cleanText.trim() === 'K O J I';
                        const isQtyHeader = cleanText.trim().startsWith('QTY');

                        // 3. Exact 48-column Monospace text line
                        return (
                          <Text
                            key={`line_${idx}`}
                            allowFontScaling={false}
                            style={[
                              styles.monoText,
                              (isHeader || isQtyHeader) && styles.textBold,
                              isDivider && styles.textDivider,
                            ]}
                          >
                            {cleanText}
                          </Text>
                        );
                      })}
                    </ScrollView>
                  </ScrollView>
                </View>
              </View>

              {/* Print Now Action Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePrint}
                style={styles.printNowBtn}
              >
                <Printer size={18} color={COLORS.cream} strokeWidth={2.4} />
                <Text style={styles.printNowBtnText}>Print Now (via RawBT)</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const MONO_FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 56, 30, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  modalHeader: {
    width: 340,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  modalTitle: {
    fontSize: 13.5,
    color: COLORS.cream,
    ...FONTS.bold,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paperWrapper: {
    width: 340,
    alignItems: 'center',
  },
  paperPaper: {
    width: 340,
    backgroundColor: '#FFFDF7', // Off-white thermal paper
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E8E3D5',
    maxHeight: 460,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  horizontalScrollContent: {
    minWidth: 338,
  },
  paperScroll: {
    width: '100%',
  },
  paperScrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  monoText: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    lineHeight: 14.5,
    color: '#1A1A1A',
  },
  textCenter: {
    textAlign: 'center',
  },
  textBold: {
    fontWeight: '700',
    color: '#000000',
  },
  textDivider: {
    color: '#888888',
  },
  textDoubleHeight: {
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '800',
    color: '#000000',
    marginVertical: 1,
  },
  textLarge: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#000000',
  },
  invertedBanner: {
    backgroundColor: '#000000',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderRadius: 2,
  },
  invertedBannerText: {
    fontFamily: MONO_FONT,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  receiptDivider: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#999999',
    borderStyle: 'dashed',
    marginVertical: 5,
  },
  emptyLine: {
    height: 5,
  },
  tearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 4,
  },
  tearDashedLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#888888',
    borderStyle: 'dashed',
  },
  tearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0ECE1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  tearBadgeText: {
    fontFamily: MONO_FONT,
    fontSize: 8.5,
    color: '#555555',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  printNowBtn: {
    width: 340,
    backgroundColor: COLORS.organic,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  printNowBtnText: {
    fontSize: 13.5,
    color: COLORS.cream,
    ...FONTS.bold,
  },
});
