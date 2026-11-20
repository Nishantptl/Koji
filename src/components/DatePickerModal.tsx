import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { formatDateYYYYMMDD, formatDateClean } from '../services/storage';

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  initialDate: string; // YYYY-MM-DD
  onSelectDate: (dateYYYYMMDD: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DatePickerContentProps {
  title: string;
  initialDate: string;
  onSelectDate: (dateYYYYMMDD: string) => void;
  onClose: () => void;
}

const DatePickerContent: React.FC<DatePickerContentProps> = ({
  title,
  initialDate,
  onSelectDate,
  onClose,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    try {
      const parts = initialDate.split('-').map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    } catch {}
    return new Date();
  });

  const [viewYear, setViewYear] = useState<number>(() => {
    try {
      const parts = initialDate.split('-').map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]).getFullYear();
      }
    } catch {}
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    try {
      const parts = initialDate.split('-').map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]).getMonth();
      }
    } catch {}
    return new Date().getMonth();
  });

  const handlePrevMonth = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayPress = (day: number) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const newDate = new Date(viewYear, viewMonth, day);
    setSelectedDate(newDate);
  };

  const handleSelectToday = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const today = new Date();
    setSelectedDate(today);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const handleConfirm = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onSelectDate(formatDateYYYYMMDD(selectedDate));
    onClose();
  };

  // Calendar matrix calculations
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const blanks = Array.from({ length: firstDayIndex }, (_, i) => null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return [...blanks, ...days];
  }, [viewYear, viewMonth]);

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  const isSelected = (day: number) => {
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <CalendarIcon size={18} color={COLORS.apricot} />
                <Text style={styles.titleText}>{title}</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeBtn}
              >
                <X size={18} color={COLORS.organic} />
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigator */}
            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.navArrowBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft size={20} color={COLORS.organic} />
              </TouchableOpacity>

              <Text style={styles.navMonthYearText}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.navArrowBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronRight size={20} color={COLORS.organic} />
              </TouchableOpacity>
            </View>

            {/* Days of Week Header */}
            <View style={styles.daysOfWeekRow}>
              {DAYS_OF_WEEK.map((d, idx) => (
                <Text
                  key={d}
                  style={[
                    styles.dayOfWeekText,
                    (idx === 0 || idx === 6) && styles.dayOfWeekWeekend,
                  ]}
                >
                  {d}
                </Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.gridContainer}>
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`blank_${index}`} style={styles.dayCell} />;
                }

                const selected = isSelected(day);
                const today = isToday(day);

                return (
                  <TouchableOpacity
                    key={`day_${day}`}
                    onPress={() => handleDayPress(day)}
                    activeOpacity={0.7}
                    style={[
                      styles.dayCell,
                      styles.dayButton,
                      selected && styles.dayButtonSelected,
                      today && !selected && styles.dayButtonToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        today && !selected && styles.dayTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selection Summary Pill */}
            <View style={styles.selectedDateBanner}>
              <Text style={styles.selectedDateLabel}>Selected Date:</Text>
              <Text style={styles.selectedDateValue}>
                {formatDateClean(selectedDate)}
              </Text>
            </View>

            {/* Footer Actions */}
            <View style={styles.footerRow}>
              <TouchableOpacity
                onPress={handleSelectToday}
                style={styles.todayBtn}
                activeOpacity={0.75}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>

              <View style={styles.footerRightButtons}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.cancelBtn}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirm}
                  style={styles.confirmBtn}
                  activeOpacity={0.85}
                >
                  <Check size={16} color={COLORS.ivory} strokeWidth={2.6} />
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
};

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  title,
  initialDate,
  onSelectDate,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <DatePickerContent
        key={`${title}_${initialDate}`}
        title={title}
        initialDate={initialDate}
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 56, 30, 0.6)', // Tinted with Forest Green #0D381E
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    padding: SPACING.lg,
    shadowColor: COLORS.organic,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 15,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  closeBtn: {
    padding: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navMonthYearText: {
    fontSize: 15,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    marginBottom: 4,
  },
  dayOfWeekText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.natural,
    ...FONTS.bold,
  },
  dayOfWeekWeekend: {
    color: COLORS.apricot,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  dayCell: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayButton: {
    borderRadius: 19,
  },
  dayButtonSelected: {
    backgroundColor: COLORS.apricot,
  },
  dayButtonToday: {
    borderWidth: 1.5,
    borderColor: COLORS.apricot,
    backgroundColor: '#FAF2DE',
  },
  dayText: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.medium,
  },
  dayTextSelected: {
    color: COLORS.ivory,
    ...FONTS.heavy,
  },
  dayTextToday: {
    color: COLORS.organic,
    ...FONTS.bold,
  },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF2DE',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: 7,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  selectedDateLabel: {
    fontSize: 11,
    color: COLORS.natural,
    ...FONTS.medium,
  },
  selectedDateValue: {
    fontSize: 13,
    color: COLORS.organic,
    ...FONTS.bold,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  todayBtnText: {
    fontSize: 12,
    color: COLORS.organic,
    ...FONTS.semibold,
  },
  footerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    fontSize: 12,
    color: COLORS.natural,
    ...FONTS.medium,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.organic,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 12,
    color: COLORS.ivory,
    ...FONTS.bold,
  },
});
