import { describe, it, expect } from 'vitest';
import {
  calculateDynamicTimeWindows,
  isLotteryAvailableForConfig,
  type TimeWindow,
} from '../lottery-utils';
import { ConfigTypes } from '~/app/types/TeeSheetTypes';
import type { TeesheetConfig, RegularConfig, CustomConfig } from '~/app/types/TeeSheetTypes';

describe('Lottery Utilities', () => {
  // ============================================================================
  // DYNAMIC TIME WINDOW CALCULATION
  // ============================================================================

  describe('calculateDynamicTimeWindows', () => {
    it('should divide time into 4 equal windows for regular config', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '16:00', // 8 AM to 4 PM = 8 hours = 480 minutes
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result).toHaveLength(4);
      expect(result[0]?.value).toBe('MORNING');
      expect(result[1]?.value).toBe('MIDDAY');
      expect(result[2]?.value).toBe('AFTERNOON');
      expect(result[3]?.value).toBe('EVENING');
    });

    it('should calculate correct time ranges for each window', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '16:00', // 8 hours total
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      // Each window should be 2 hours (120 minutes)
      expect(result[0]?.timeRange).toBe('8:00 AM - 10:00 AM'); // MORNING
      expect(result[1]?.timeRange).toBe('10:00 AM - 12:00 PM'); // MIDDAY
      expect(result[2]?.timeRange).toBe('12:00 PM - 2:00 PM'); // AFTERNOON
      expect(result[3]?.timeRange).toBe('2:00 PM - 4:00 PM'); // EVENING
    });

    it('should include start and end minutes for each window', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '16:00',
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      // Start time = 08:00 = 480 minutes from midnight
      // End time = 16:00 = 960 minutes from midnight
      // Total duration = 480 minutes / 4 = 120 minutes per window

      expect(result[0]?.startMinutes).toBe(480); // 8:00 AM
      expect(result[0]?.endMinutes).toBe(600); // 10:00 AM
      expect(result[1]?.startMinutes).toBe(600); // 10:00 AM
      expect(result[1]?.endMinutes).toBe(720); // 12:00 PM
      expect(result[2]?.startMinutes).toBe(720); // 12:00 PM
      expect(result[2]?.endMinutes).toBe(840); // 2:00 PM
      expect(result[3]?.startMinutes).toBe(840); // 2:00 PM
      expect(result[3]?.endMinutes).toBe(960); // 4:00 PM
    });

    it('should have correct labels for each window', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '16:00',
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result[0]?.label).toBe('Morning');
      expect(result[1]?.label).toBe('Midday');
      expect(result[2]?.label).toBe('Afternoon');
      expect(result[3]?.label).toBe('Evening');
    });

    it('should have icons for each window', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '16:00',
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result[0]?.icon).toBe('☀️'); // Morning
      expect(result[1]?.icon).toBe('🌞'); // Midday
      expect(result[2]?.icon).toBe('🌤️'); // Afternoon
      expect(result[3]?.icon).toBe('🌅'); // Evening
    });

    it('should handle different start and end times', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '06:00',
        endTime: '18:00', // 12 hours total = 3 hours per window
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result).toHaveLength(4);
      expect(result[0]?.timeRange).toBe('6:00 AM - 9:00 AM');
      expect(result[1]?.timeRange).toBe('9:00 AM - 12:00 PM');
      expect(result[2]?.timeRange).toBe('12:00 PM - 3:00 PM');
      expect(result[3]?.timeRange).toBe('3:00 PM - 6:00 PM');
    });

    it('should handle times crossing noon boundary', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '10:00',
        endTime: '14:00', // 4 hours total = 1 hour per window
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result).toHaveLength(4);
      expect(result[0]?.timeRange).toBe('10:00 AM - 11:00 AM');
      expect(result[1]?.timeRange).toBe('11:00 AM - 12:00 PM');
      expect(result[2]?.timeRange).toBe('12:00 PM - 1:00 PM');
      expect(result[3]?.timeRange).toBe('1:00 PM - 2:00 PM');
    });

    it('should return empty array for custom config', () => {
      const config: CustomConfig = {
        type: ConfigTypes.CUSTOM,
        customTimes: ['08:00', '10:00', '12:00'],
      };

      const result = calculateDynamicTimeWindows(config as any);

      expect(result).toEqual([]);
    });

    it('should return empty array for invalid start time', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '', // Invalid
        endTime: '16:00',
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result).toEqual([]);
    });

    it('should return empty array for invalid end time', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '', // Invalid
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result).toEqual([]);
    });

    it('should handle early morning start times', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '05:00',
        endTime: '09:00', // 4 hours total = 1 hour per window
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result).toHaveLength(4);
      expect(result[0]?.timeRange).toBe('5:00 AM - 6:00 AM');
      expect(result[3]?.timeRange).toBe('8:00 AM - 9:00 AM');
    });

    it('should handle late evening times', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '16:00',
        endTime: '20:00', // 4 hours total = 1 hour per window
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result).toHaveLength(4);
      expect(result[0]?.timeRange).toBe('4:00 PM - 5:00 PM');
      expect(result[3]?.timeRange).toBe('7:00 PM - 8:00 PM');
    });

    it('should handle uneven division (floor division)', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '17:00', // 9 hours = 540 minutes / 4 = 135 minutes per window (2h 15m)
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result).toHaveLength(4);
      // Each window should be 135 minutes (2 hours 15 minutes)
      expect(result[0]?.startMinutes).toBe(480); // 8:00
      expect(result[0]?.endMinutes).toBe(615); // 10:15
      expect(result[1]?.startMinutes).toBe(615); // 10:15
      expect(result[1]?.endMinutes).toBe(750); // 12:30
    });
  });

  // ============================================================================
  // LOTTERY AVAILABILITY
  // ============================================================================

  describe('isLotteryAvailableForConfig', () => {
    it('should return true for REGULAR config', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '16:00',
        interval: 10,
      };

      const result = isLotteryAvailableForConfig(config);

      expect(result).toBe(true);
    });

    it('should return false for CUSTOM config', () => {
      const config: CustomConfig = {
        type: ConfigTypes.CUSTOM,
        customTimes: ['08:00', '10:00', '12:00'],
      };

      const result = isLotteryAvailableForConfig(config as any);

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // TIME FORMATTING HELPERS
  // ============================================================================

  describe('formatMinutesToTime (through calculateDynamicTimeWindows)', () => {
    it('should format midnight correctly', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '00:00',
        endTime: '04:00', // 4 hours = 1 hour per window
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result[0]?.timeRange).toBe('12:00 AM - 1:00 AM');
    });

    it('should format noon correctly', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '11:00',
        endTime: '15:00', // Crosses noon
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      // Should contain 12:00 PM for noon
      const hasnoon = result.some(window => window.timeRange.includes('12:00 PM'));
      expect(hasnoon).toBe(true);
    });

    it('should format single-digit hours without leading zero', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '09:00',
        endTime: '13:00',
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      // Should format as "9:00 AM" not "09:00 AM"
      expect(result[0]?.timeRange).toContain('9:00 AM');
    });

    it('should handle times with non-zero minutes', () => {
      const config: RegularConfig = {
        type: ConfigTypes.REGULAR,
        startTime: '08:30',
        endTime: '12:30', // 4 hours = 1 hour per window
        interval: 10,
      };

      const result = calculateDynamicTimeWindows(config);

      expect(result[0]?.timeRange).toBe('8:30 AM - 9:30 AM');
      expect(result[3]?.timeRange).toBe('11:30 AM - 12:30 PM');
    });
  });
});
