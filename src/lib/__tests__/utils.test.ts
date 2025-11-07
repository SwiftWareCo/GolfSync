import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  formatDisplayTime,
  formatDisplayDate,
  formatTimeStringTo12Hour,
  formatDaysOfWeek,
  checkTimeBlockInPast,
  getMemberClassStyling,
  generateTimeBlocks,
  formatCalendarDate,
  formatDateStringToWords,
  preserveDate,
} from '../utils';

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      const result = cn('class1', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', false && 'conditional', true && 'included');
      expect(result).toBe('base included');
    });

    it('should merge Tailwind classes correctly', () => {
      const result = cn('px-2', 'px-4');
      // tailwind-merge should keep only px-4
      expect(result).toBe('px-4');
    });

    it('should handle undefined and null', () => {
      const result = cn('class1', undefined, null, 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });
  });

  // ============================================================================
  // TIME FORMATTING
  // ============================================================================

  describe('formatDisplayTime', () => {
    it('should format morning time to 12-hour format', () => {
      const result = formatDisplayTime('09:30');
      expect(result).toMatch(/9:30 (am|AM)/);
    });

    it('should format afternoon time to 12-hour format', () => {
      const result = formatDisplayTime('14:30');
      expect(result).toMatch(/2:30 (pm|PM)/);
    });

    it('should format midnight correctly', () => {
      const result = formatDisplayTime('00:00');
      expect(result).toMatch(/12:00 (am|AM)/);
    });

    it('should format noon correctly', () => {
      const result = formatDisplayTime('12:00');
      expect(result).toMatch(/12:00 (pm|PM)/);
    });

    it('should format 1 AM correctly', () => {
      const result = formatDisplayTime('01:00');
      expect(result).toMatch(/1:00 (am|AM)/);
    });

    it('should format 1 PM correctly', () => {
      const result = formatDisplayTime('13:00');
      expect(result).toMatch(/1:00 (pm|PM)/);
    });
  });

  describe('formatTimeStringTo12Hour', () => {
    it('should convert morning time to 12-hour format', () => {
      const result = formatTimeStringTo12Hour('09:30');
      expect(result).toBe('9:30 AM');
    });

    it('should convert afternoon time to 12-hour format', () => {
      const result = formatTimeStringTo12Hour('14:30');
      expect(result).toBe('2:30 PM');
    });

    it('should handle midnight as 12:00 AM', () => {
      const result = formatTimeStringTo12Hour('00:00');
      expect(result).toBe('12:00 AM');
    });

    it('should handle noon as 12:00 PM', () => {
      const result = formatTimeStringTo12Hour('12:00');
      expect(result).toBe('12:00 PM');
    });

    it('should return empty string for undefined', () => {
      const result = formatTimeStringTo12Hour(undefined);
      expect(result).toBe('');
    });

    it('should return original string for invalid format', () => {
      const result = formatTimeStringTo12Hour('invalid');
      expect(result).toBe('invalid');
    });
  });

  // ============================================================================
  // DATE FORMATTING
  // ============================================================================

  describe('formatDisplayDate', () => {
    it('should format Date object to readable format', () => {
      const date = new Date('2025-11-15T00:00:00Z');
      const result = formatDisplayDate(date);
      expect(result).toContain('November');
      expect(result).toContain('2025');
    });

    it('should format date string to readable format', () => {
      const result = formatDisplayDate('2025-11-15');
      expect(result).toContain('November');
      expect(result).toContain('2025');
    });
  });

  describe('formatCalendarDate', () => {
    it('should format YYYY-MM-DD string with default format', () => {
      const result = formatCalendarDate('2025-11-15');
      expect(result).toBe('2025-11-15');
    });

    it('should format Date object with default format', () => {
      const date = new Date(2025, 10, 15); // Month is 0-indexed
      const result = formatCalendarDate(date);
      expect(result).toBe('2025-11-15');
    });

    it('should return empty string for null', () => {
      const result = formatCalendarDate(null);
      expect(result).toBe('');
    });

    it('should handle custom format string', () => {
      const result = formatCalendarDate('2025-11-15', 'MMM dd, yyyy');
      expect(result).toContain('Nov');
      expect(result).toContain('2025');
    });

    it('should handle invalid date gracefully', () => {
      const result = formatCalendarDate('invalid-date');
      expect(result).toBe('invalid-date');
    });
  });

  describe('formatDateStringToWords', () => {
    it('should format date to words with day of week', () => {
      const result = formatDateStringToWords('2025-11-15');
      expect(result).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
      expect(result).toContain('November');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('should return empty string for undefined', () => {
      const result = formatDateStringToWords(undefined);
      expect(result).toBe('');
    });

    it('should return original string for invalid format', () => {
      const result = formatDateStringToWords('invalid');
      expect(result).toBe('invalid');
    });

    it('should handle year boundary dates', () => {
      const result = formatDateStringToWords('2025-01-01');
      expect(result).toContain('January');
      expect(result).toContain('1');
      expect(result).toContain('2025');
    });
  });

  // ============================================================================
  // DAYS OF WEEK FORMATTING
  // ============================================================================

  describe('formatDaysOfWeek', () => {
    it('should return "Every day" for all 7 days', () => {
      const result = formatDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
      expect(result).toBe('Every day');
    });

    it('should return "Weekdays" for Monday-Friday', () => {
      const result = formatDaysOfWeek([1, 2, 3, 4, 5]);
      expect(result).toBe('Weekdays');
    });

    it('should return "Weekends" for Saturday-Sunday', () => {
      const result = formatDaysOfWeek([0, 6]);
      expect(result).toBe('Weekends');
    });

    it('should return comma-separated day names', () => {
      const result = formatDaysOfWeek([1, 3, 5]);
      expect(result).toBe('Monday, Wednesday, Friday');
    });

    it('should return "None" for empty array', () => {
      const result = formatDaysOfWeek([]);
      expect(result).toBe('None');
    });

    it('should sort days before formatting', () => {
      const result = formatDaysOfWeek([5, 1, 3]);
      expect(result).toBe('Monday, Wednesday, Friday');
    });

    it('should handle single day', () => {
      const result = formatDaysOfWeek([0]);
      expect(result).toBe('Sunday');
    });
  });

  // ============================================================================
  // TIME BLOCK UTILITIES
  // ============================================================================

  describe('generateTimeBlocks', () => {
    it('should generate time blocks with 15-minute intervals', () => {
      const result = generateTimeBlocks({
        startTime: '08:00',
        endTime: '09:00',
        interval: 15,
      });
      expect(result).toHaveLength(5); // 08:00, 08:15, 08:30, 08:45, 09:00
      expect(result[0]).toBe('08:00');
      expect(result[4]).toBe('09:00');
    });

    it('should generate time blocks with 30-minute intervals', () => {
      const result = generateTimeBlocks({
        startTime: '08:00',
        endTime: '10:00',
        interval: 30,
      });
      expect(result).toHaveLength(5); // 08:00, 08:30, 09:00, 09:30, 10:00
      expect(result[0]).toBe('08:00');
      expect(result[2]).toBe('09:00');
    });

    it('should handle single block when start equals end', () => {
      const result = generateTimeBlocks({
        startTime: '08:00',
        endTime: '08:00',
        interval: 15,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('08:00');
    });
  });

  describe('checkTimeBlockInPast', () => {
    const mockDate = new Date('2025-11-06T20:00:00Z'); // Nov 6, 2025 at 8:00 PM UTC

    beforeEach(() => {
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for past date', () => {
      const result = checkTimeBlockInPast('2025-11-05');
      expect(result).toBe(true);
    });

    it('should return false for future date', () => {
      const result = checkTimeBlockInPast('2025-11-07');
      expect(result).toBe(false);
    });

    it('should return true for past time on today', () => {
      const result = checkTimeBlockInPast('2025-11-06', '10:00');
      expect(result).toBe(true);
    });

    it('should return false for future time on today', () => {
      const result = checkTimeBlockInPast('2025-11-06', '23:00');
      expect(result).toBe(false);
    });

    it('should handle Date object', () => {
      const pastDate = new Date('2025-11-05T00:00:00Z');
      const result = checkTimeBlockInPast(pastDate);
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // MEMBER CLASS STYLING
  // ============================================================================

  describe('getMemberClassStyling', () => {
    it('should return styling for UNLIMITED PLAY MALE', () => {
      const result = getMemberClassStyling('UNLIMITED PLAY MALE');
      expect(result.bg).toBe('bg-blue-50');
      expect(result.text).toBe('text-blue-700');
      expect(result.description).toBe('Unlimited Play Male Member');
    });

    it('should return styling for FULL PLAY FEMALE', () => {
      const result = getMemberClassStyling('FULL PLAY FEMALE');
      expect(result.bg).toBe('bg-purple-100');
      expect(result.text).toBe('text-purple-800');
    });

    it('should return styling for GUEST', () => {
      const result = getMemberClassStyling('GUEST');
      expect(result.bg).toBe('bg-lime-200');
      expect(result.text).toBe('text-lime-800');
      expect(result.description).toBe('Guest');
    });

    it('should return styling for STAFF', () => {
      const result = getMemberClassStyling('STAFF');
      expect(result.bg).toBe('bg-indigo-100');
      expect(result.text).toBe('text-indigo-800');
    });

    it('should be case-insensitive', () => {
      const result1 = getMemberClassStyling('guest');
      const result2 = getMemberClassStyling('GUEST');
      expect(result1).toEqual(result2);
    });

    it('should return default styling for unknown class', () => {
      const result = getMemberClassStyling('UNKNOWN CLASS');
      expect(result.bg).toBe('bg-gray-100');
      expect(result.text).toBe('text-gray-800');
      expect(result.description).toBe('Regular member');
    });

    it('should return default styling for null', () => {
      const result = getMemberClassStyling(null);
      expect(result.bg).toBe('bg-gray-100');
      expect(result.text).toBe('text-gray-800');
    });

    it('should return default styling for undefined', () => {
      const result = getMemberClassStyling(undefined);
      expect(result.bg).toBe('bg-gray-100');
      expect(result.text).toBe('text-gray-800');
    });
  });

  // ============================================================================
  // DATE PRESERVATION
  // ============================================================================

  describe('preserveDate', () => {
    it('should preserve Date object', () => {
      const date = new Date(2025, 10, 15); // Nov 15, 2025
      const result = preserveDate(date);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(10);
      expect(result?.getDate()).toBe(15);
    });

    it('should parse YYYY-MM-DD string', () => {
      const result = preserveDate('2025-11-15');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(10); // 0-indexed
      expect(result?.getDate()).toBe(15);
    });

    it('should return undefined for null', () => {
      const result = preserveDate(null);
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
      const result = preserveDate(undefined);
      expect(result).toBeUndefined();
    });

    it('should set time to noon to avoid DST issues', () => {
      const result = preserveDate('2025-11-15');
      expect(result?.getHours()).toBe(12);
      expect(result?.getMinutes()).toBe(0);
    });
  });
});
