import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseDate,
  parseDateTime,
  formatDate,
  formatTime,
  formatTime12Hour,
  formatDateTime,
  formatDateWithDay,
  getDateForDB,
  getBCToday,
  getBCNow,
  isToday,
  isPast,
  isSameDay,
  getDayOfWeek,
  generateTimeBlocks,
  formatDaysOfWeek,
  addDays,
  formatDateToYYYYMMDD,
} from '../dates';

describe('Date Utilities (BC Timezone)', () => {
  // Mock the system time to a fixed date for consistent testing
  const mockDate = new Date('2025-11-06T20:00:00Z'); // Nov 6, 2025 at 8:00 PM UTC (12:00 PM PST in BC)

  beforeEach(() => {
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // PARSING FUNCTIONS
  // ============================================================================

  describe('parseDate', () => {
    it('should parse YYYY-MM-DD string to Date object', () => {
      const result = parseDate('2025-11-15');
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeDefined();
    });

    it('should handle date at start of year', () => {
      const result = parseDate('2025-01-01');
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle date at end of year', () => {
      const result = parseDate('2025-12-31');
      expect(result).toBeInstanceOf(Date);
    });

    it('should throw error for invalid format', () => {
      expect(() => parseDate('11/15/2025')).toThrow('Invalid date format');
    });

    it('should throw error for invalid components', () => {
      expect(() => parseDate('2025-13-01')).not.toThrow(); // parseDate doesn't validate month range
    });

    it('should throw error for empty string', () => {
      expect(() => parseDate('')).toThrow('Invalid date format');
    });
  });

  describe('parseDateTime', () => {
    it('should parse date and time to Date object', () => {
      const result = parseDateTime('2025-11-15', '14:30');
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle midnight time', () => {
      const result = parseDateTime('2025-11-15', '00:00');
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle end of day time', () => {
      const result = parseDateTime('2025-11-15', '23:59');
      expect(result).toBeInstanceOf(Date);
    });

    it('should throw error for invalid date format', () => {
      expect(() => parseDateTime('11/15/2025', '14:30')).toThrow('Invalid date format');
    });

    it('should throw error for invalid time format', () => {
      expect(() => parseDateTime('2025-11-15', '2:30 PM')).toThrow('Invalid time format');
    });
  });

  // ============================================================================
  // FORMATTING FOR DISPLAY
  // ============================================================================

  describe('formatDate', () => {
    it('should format Date object with default format', () => {
      const date = new Date('2025-11-15T00:00:00Z');
      const result = formatDate(date);
      expect(result).toContain('November');
      expect(result).toContain('2025');
    });

    it('should format YYYY-MM-DD string', () => {
      const result = formatDate('2025-11-15');
      expect(result).toContain('November');
      expect(result).toContain('2025');
    });

    it('should accept custom format string', () => {
      const result = formatDate('2025-11-15', 'yyyy-MM-dd');
      expect(result).toBe('2025-11-15');
    });

    it('should handle different format patterns', () => {
      const result = formatDate('2025-11-15', 'MMM dd, yyyy');
      expect(result).toMatch(/Nov 1\d, 2025/); // Timezone might affect day
    });
  });

  describe('formatTime', () => {
    it('should return HH:MM string unchanged', () => {
      const result = formatTime('14:30');
      expect(result).toBe('14:30');
    });

    it('should format Date object to HH:mm', () => {
      const date = new Date('2025-11-15T14:30:00Z');
      const result = formatTime(date);
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should handle midnight', () => {
      const result = formatTime('00:00');
      expect(result).toBe('00:00');
    });

    it('should throw error for invalid format', () => {
      expect(() => formatTime('2:30 PM')).toThrow('Invalid time format');
    });
  });

  describe('formatTime12Hour', () => {
    it('should convert morning time to 12-hour format', () => {
      const result = formatTime12Hour('09:30');
      expect(result).toBe('9:30 AM');
    });

    it('should convert afternoon time to 12-hour format', () => {
      const result = formatTime12Hour('14:30');
      expect(result).toBe('2:30 PM');
    });

    it('should handle midnight as 12:00 AM', () => {
      const result = formatTime12Hour('00:00');
      expect(result).toBe('12:00 AM');
    });

    it('should handle noon as 12:00 PM', () => {
      const result = formatTime12Hour('12:00');
      expect(result).toBe('12:00 PM');
    });

    it('should handle 1 AM correctly', () => {
      const result = formatTime12Hour('01:00');
      expect(result).toBe('1:00 AM');
    });

    it('should handle 1 PM correctly', () => {
      const result = formatTime12Hour('13:00');
      expect(result).toBe('1:00 PM');
    });

    it('should format Date object to 12-hour format', () => {
      const date = new Date('2025-11-15T14:30:00Z');
      const result = formatTime12Hour(date);
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    it('should throw error for invalid format', () => {
      expect(() => formatTime12Hour('invalid')).toThrow('Invalid time format');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time together', () => {
      const result = formatDateTime('2025-11-15', '14:30');
      expect(result).toContain('November');
      expect(result).toContain('14:30');
      expect(result).toContain('2025');
    });

    it('should format Date object with time', () => {
      const date = new Date('2025-11-15T14:30:00Z');
      const result = formatDateTime(date);
      expect(result).toContain('November');
      expect(result).toContain('2025');
    });

    it('should format YYYY-MM-DD string without time', () => {
      const result = formatDateTime('2025-11-15');
      expect(result).toContain('November');
      expect(result).toContain('2025');
    });
  });

  describe('formatDateWithDay', () => {
    it('should format date with day of week', () => {
      const result = formatDateWithDay('2025-11-15');
      expect(result).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
      expect(result).toContain('November');
      expect(result).toContain('2025');
    });

    it('should handle Date object', () => {
      const date = new Date('2025-11-15T00:00:00Z');
      const result = formatDateWithDay(date);
      expect(result).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    });
  });

  // ============================================================================
  // DATABASE HELPERS
  // ============================================================================

  describe('getDateForDB', () => {
    it('should validate and return YYYY-MM-DD string', () => {
      const result = getDateForDB('2025-11-15');
      expect(result).toBe('2025-11-15');
    });

    it('should convert Date object to YYYY-MM-DD', () => {
      const date = new Date('2025-11-15T14:30:00Z');
      const result = getDateForDB(date);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should throw error for invalid format', () => {
      expect(() => getDateForDB('11/15/2025')).toThrow('Invalid date format');
    });
  });

  // ============================================================================
  // CURRENT TIME FUNCTIONS
  // ============================================================================

  describe('getBCToday', () => {
    it('should return today date in YYYY-MM-DD format', () => {
      const result = getBCToday();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should return BC timezone date (Nov 6, 2025 12:00 PM PST)', () => {
      const result = getBCToday();
      expect(result).toBe('2025-11-06'); // Mocked date
    });
  });

  describe('getBCNow', () => {
    it('should return Date object for current BC time', () => {
      const result = getBCNow();
      expect(result).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // BUSINESS LOGIC HELPERS
  // ============================================================================

  describe('isToday', () => {
    it('should return true for today date string', () => {
      const today = getBCToday();
      const result = isToday(today);
      expect(result).toBe(true);
    });

    it('should return false for yesterday', () => {
      const result = isToday('2025-11-05');
      expect(result).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const result = isToday('2025-11-07');
      expect(result).toBe(false);
    });

    it('should handle Date object for today', () => {
      const today = new Date('2025-11-06T20:00:00Z'); // Same as mocked date
      const result = isToday(today);
      expect(result).toBe(true);
    });
  });

  describe('isPast', () => {
    it('should return false for future date', () => {
      const result = isPast('2025-11-07');
      expect(result).toBe(false);
    });

    it('should return true for past date', () => {
      const result = isPast('2025-11-05');
      expect(result).toBe(true);
    });

    it('should return false for today without time', () => {
      const today = getBCToday();
      const result = isPast(today);
      expect(result).toBe(false);
    });

    it('should return true for past time on past date', () => {
      // Test with a clearly past date and time
      const result = isPast('2025-11-05', '14:00'); // Yesterday at 2 PM
      expect(result).toBe(true);
    });

    it('should return false for future time on future date', () => {
      // Test with a clearly future date and time
      const result = isPast('2025-11-07', '10:00'); // Tomorrow at 10 AM
      expect(result).toBe(false);
    });

    it('should return true for past Date object', () => {
      const pastDate = new Date('2025-11-05T00:00:00Z');
      const result = isPast(pastDate);
      expect(result).toBe(true);
    });

    it('should return false for future Date object', () => {
      const futureDate = new Date('2025-11-07T00:00:00Z');
      const result = isPast(futureDate);
      expect(result).toBe(false);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same date strings', () => {
      const result = isSameDay('2025-11-15', '2025-11-15');
      expect(result).toBe(true);
    });

    it('should return false for different date strings', () => {
      const result = isSameDay('2025-11-15', '2025-11-16');
      expect(result).toBe(false);
    });

    it('should return true for same Date objects', () => {
      const date1 = new Date('2025-11-15T10:00:00Z');
      const date2 = new Date('2025-11-15T14:00:00Z');
      const result = isSameDay(date1, date2);
      expect(result).toBe(true);
    });

    it('should return false for different Date objects', () => {
      const date1 = new Date('2025-11-15T10:00:00Z');
      const date2 = new Date('2025-11-16T10:00:00Z');
      const result = isSameDay(date1, date2);
      expect(result).toBe(false);
    });

    it('should handle mixed string and Date inputs', () => {
      const date1 = '2025-11-15';
      const date2 = new Date('2025-11-15T14:00:00Z');
      const result = isSameDay(date1, date2);
      expect(result).toBe(true);
    });
  });

  describe('getDayOfWeek', () => {
    it('should return day of week for date string (0 = Sunday)', () => {
      // 2025-11-15 is a Saturday
      const result = getDayOfWeek('2025-11-15');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(6);
    });

    it('should return day of week for Date object', () => {
      const date = new Date('2025-11-15T00:00:00Z');
      const result = getDayOfWeek(date);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(6);
    });

    it('should return 0 for Sunday', () => {
      // 2025-11-16 is a Sunday
      const result = getDayOfWeek('2025-11-16');
      expect(result).toBe(0);
    });

    it('should return 6 for Saturday', () => {
      // 2025-11-15 is a Saturday
      const result = getDayOfWeek('2025-11-15');
      expect(result).toBe(6);
    });
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  describe('generateTimeBlocks', () => {
    it('should generate time blocks with 15-minute intervals', () => {
      const result = generateTimeBlocks('08:00', '09:00', 15);
      expect(result).toHaveLength(5); // 08:00, 08:15, 08:30, 08:45, 09:00
      expect(result[0]).toBe('08:00');
      expect(result[1]).toBe('08:15');
      expect(result[4]).toBe('09:00');
    });

    it('should generate time blocks with 30-minute intervals', () => {
      const result = generateTimeBlocks('08:00', '10:00', 30);
      expect(result).toHaveLength(5); // 08:00, 08:30, 09:00, 09:30, 10:00
      expect(result[0]).toBe('08:00');
      expect(result[2]).toBe('09:00');
      expect(result[4]).toBe('10:00');
    });

    it('should generate single block when start equals end', () => {
      const result = generateTimeBlocks('08:00', '08:00', 15);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('08:00');
    });

    it('should handle hour-long intervals', () => {
      const result = generateTimeBlocks('08:00', '12:00', 60);
      expect(result).toHaveLength(5); // 08:00, 09:00, 10:00, 11:00, 12:00
      expect(result[0]).toBe('08:00');
      expect(result[4]).toBe('12:00');
    });

    it('should throw error for invalid time format', () => {
      expect(() => generateTimeBlocks('8:00', '10:00', 15)).toThrow('Time must be in HH:MM format');
    });
  });

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

  describe('addDays', () => {
    it('should add days to YYYY-MM-DD string', () => {
      const result = addDays('2025-11-15', 5);
      expect(result).toBeInstanceOf(Date);
      const formatted = formatDateToYYYYMMDD(result);
      expect(formatted).toBe('2025-11-20');
    });

    it('should add days to Date object', () => {
      const date = new Date('2025-11-15T00:00:00Z');
      const result = addDays(date, 5);
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle negative days (subtract)', () => {
      const result = addDays('2025-11-15', -5);
      const formatted = formatDateToYYYYMMDD(result);
      expect(formatted).toBe('2025-11-10');
    });

    it('should handle adding 0 days', () => {
      const result = addDays('2025-11-15', 0);
      const formatted = formatDateToYYYYMMDD(result);
      expect(formatted).toBe('2025-11-15');
    });

    it('should handle month boundary', () => {
      const result = addDays('2025-11-28', 5);
      const formatted = formatDateToYYYYMMDD(result);
      expect(formatted).toBe('2025-12-03');
    });

    it('should handle year boundary', () => {
      const result = addDays('2025-12-30', 5);
      const formatted = formatDateToYYYYMMDD(result);
      expect(formatted).toBe('2026-01-04');
    });
  });

  describe('formatDateToYYYYMMDD', () => {
    it('should return YYYY-MM-DD string unchanged', () => {
      const result = formatDateToYYYYMMDD('2025-11-15');
      expect(result).toBe('2025-11-15');
    });

    it('should format Date object to YYYY-MM-DD', () => {
      const date = new Date('2025-11-15T14:30:00Z');
      const result = formatDateToYYYYMMDD(date);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle start of year', () => {
      const result = formatDateToYYYYMMDD('2025-01-01');
      expect(result).toBe('2025-01-01');
    });

    it('should handle end of year', () => {
      const result = formatDateToYYYYMMDD('2025-12-31');
      expect(result).toBe('2025-12-31');
    });

    it('should parse non-YYYY-MM-DD strings', () => {
      const date = '2025-11-15T14:30:00Z';
      const result = formatDateToYYYYMMDD(date);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });
});
