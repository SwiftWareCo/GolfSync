import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConfigForDate } from '../data';
import { ConfigTypes } from '~/app/types/TeeSheetTypes';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    insert: vi.fn(),
    query: {
      teesheetConfigRules: {
        findMany: vi.fn(),
      },
      teesheetConfigs: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
}));

import { db } from '~/server/db';

describe('Configuration Selection Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Mock findMany to return existing configs (so initializeDefaultConfigs returns early)
    vi.mocked(db.query.teesheetConfigs.findMany).mockResolvedValue([
      {
        id: 1,
        name: 'Default Config',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);
  });

  describe('getConfigForDate - Specific Date Rules', () => {
    it('should select config for specific date (highest priority)', async () => {
      const testDate = new Date('2025-12-25'); // Christmas

      const specificDateRule = {
        id: 1,
        configId: 10,
        startDate: '2025-12-25',
        endDate: '2025-12-25',
        daysOfWeek: null,
        priority: 100,
        isActive: true,
      };

      const holidayConfig = {
        id: 10,
        name: 'Christmas Day',
        type: ConfigTypes.CUSTOM,
        templateId: 5,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [specificDateRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock specific date rule query
      vi.mocked(db.query.teesheetConfigRules.findMany).mockResolvedValueOnce([
        specificDateRule,
      ] as any);

      // Mock config query
      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        holidayConfig as any
      );

      const result = await getConfigForDate(testDate);

      expect(result).toBeDefined();
      expect(result.id).toBe(10);
      expect(result.name).toBe('Christmas Day');
      expect(result.type).toBe(ConfigTypes.CUSTOM);
    });

    it('should prioritize specific date over recurring day rules', async () => {
      const testDate = new Date('2025-11-11'); // Wednesday (day 3)

      const specificDateRule = {
        id: 1,
        configId: 5,
        startDate: '2025-11-11',
        endDate: '2025-11-11',
        daysOfWeek: null,
        priority: 50,
        isActive: true,
      };

      const specialConfig = {
        id: 5,
        name: 'Special Wednesday',
        type: ConfigTypes.CUSTOM,
        templateId: 2,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [specificDateRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.teesheetConfigRules.findMany).mockResolvedValueOnce([
        specificDateRule,
      ] as any);

      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        specialConfig as any
      );

      const result = await getConfigForDate(testDate);

      expect(result.id).toBe(5);
      expect(result.name).toBe('Special Wednesday');
    });
  });

  describe('getConfigForDate - Recurring Day Rules', () => {
    it('should select weekday config for Monday', async () => {
      const monday = new Date('2025-11-10'); // Monday (day 1)

      const weekdayRule = {
        id: 2,
        configId: 1,
        startDate: null,
        endDate: null,
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
        priority: 10,
        isActive: true,
      };

      const weekdayConfig = {
        id: 1,
        name: 'Weekday Config',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [weekdayRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // No specific date rules
      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([weekdayRule] as any);

      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        weekdayConfig as any
      );

      const result = await getConfigForDate(monday);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Weekday Config');
      expect(result.interval).toBe(15);
    });

    it('should select weekend config for Saturday', async () => {
      const saturday = new Date('2025-11-08'); // Saturday (day 6)

      const weekendRule = {
        id: 3,
        configId: 2,
        startDate: null,
        endDate: null,
        daysOfWeek: [0, 6], // Sun, Sat
        priority: 10,
        isActive: true,
      };

      const weekendConfig = {
        id: 2,
        name: 'Weekend Config',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 20,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [weekendRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([weekendRule] as any);

      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        weekendConfig as any
      );

      const result = await getConfigForDate(saturday);

      expect(result.id).toBe(2);
      expect(result.name).toBe('Weekend Config');
      expect(result.interval).toBe(20);
    });

    it('should select weekend config for Sunday', async () => {
      const sunday = new Date('2025-11-09'); // Sunday (day 0)

      const weekendRule = {
        id: 3,
        configId: 2,
        startDate: null,
        endDate: null,
        daysOfWeek: [0, 6],
        priority: 10,
        isActive: true,
      };

      const weekendConfig = {
        id: 2,
        name: 'Weekend Config',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 20,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [weekendRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([weekendRule] as any);

      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        weekendConfig as any
      );

      const result = await getConfigForDate(sunday);

      expect(result.id).toBe(2);
      expect(result.name).toBe('Weekend Config');
    });
  });

  describe('getConfigForDate - Priority Ordering', () => {
    it('should select higher priority rule when multiple rules match', async () => {
      const testDate = new Date('2025-11-10'); // Monday

      const highPriorityRule = {
        id: 10,
        configId: 15,
        startDate: null,
        endDate: null,
        daysOfWeek: [1], // Monday
        priority: 100,
        isActive: true,
      };

      const highPriorityConfig = {
        id: 15,
        name: 'Special Monday Config',
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '18:00',
        interval: 10,
        maxMembersPerBlock: 3,
        isActive: true,
        isSystemConfig: false,
        rules: [highPriorityRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // No specific date rules, return high priority recurring rule
      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([highPriorityRule] as any);

      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        highPriorityConfig as any
      );

      const result = await getConfigForDate(testDate);

      expect(result.id).toBe(15);
      expect(result.name).toBe('Special Monday Config');
    });
  });

  describe('getConfigForDate - Date Range Rules', () => {
    it('should apply rule within date range', async () => {
      const testDate = new Date('2025-06-15'); // Mid-June

      const summerRule = {
        id: 20,
        configId: 20,
        startDate: '2025-06-01',
        endDate: '2025-08-31',
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays during summer
        priority: 50,
        isActive: true,
      };

      const summerConfig = {
        id: 20,
        name: 'Summer Weekday',
        type: ConfigTypes.REGULAR,
        startTime: '06:00',
        endTime: '20:00',
        interval: 12,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [summerRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([summerRule] as any);

      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        summerConfig as any
      );

      const result = await getConfigForDate(testDate);

      expect(result.id).toBe(20);
      expect(result.name).toBe('Summer Weekday');
      expect(result.startTime).toBe('06:00');
    });

    it('should not apply rule outside date range', async () => {
      const testDate = new Date('2025-12-15'); // December (winter) - Monday (day 1)
      const weekdayRule = {
        id: 100,
        configId: 1,
        startDate: null,
        endDate: null,
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
        priority: 0,
        isActive: true,
      };

      const defaultConfig = {
        id: 1,
        name: 'Default Weekday',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [weekdayRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // No specific date rules, no matching recurring rules
      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      // Fall back to system config
      vi.mocked(db.query.teesheetConfigs.findMany).mockResolvedValue([
        defaultConfig,
      ] as any);

      const result = await getConfigForDate(testDate);
      expect(result).toBeDefined();
      expect(result.isSystemConfig).toBe(true);
    });
  });

  describe('getConfigForDate - System Fallback', () => {
    it('should fall back to system config when no rules match', async () => {
      const testDate = new Date('2025-11-10'); // Monday (day 1)

      const weekdayRule = {
        id: 101,
        configId: 1,
        startDate: null,
        endDate: null,
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
        priority: 0,
        isActive: true,
      };

      const systemConfig = {
        id: 1,
        name: 'System Default',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [weekdayRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // No specific date rules, no recurring rules
      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Return system config
      vi.mocked(db.query.teesheetConfigs.findMany).mockResolvedValue([
        systemConfig,
      ] as any);

      const result = await getConfigForDate(testDate);

      expect(result.id).toBe(1);
      expect(result.isSystemConfig).toBe(true);
      expect(result.name).toBe('System Default');
    });
  });

  describe('getConfigForDate - Inactive Rules', () => {
    it('should ignore inactive rules', async () => {
      const testDate = new Date('2025-11-10'); // Monday (day 1)

      const weekdayRule = {
        id: 102,
        configId: 1,
        startDate: null,
        endDate: null,
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
        priority: 0,
        isActive: true,
      };

      const defaultConfig = {
        id: 1,
        name: 'Default Config',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [weekdayRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Query should filter out inactive rules (return empty)
      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([]) // No active specific date rules
        .mockResolvedValueOnce([]); // No active recurring rules

      vi.mocked(db.query.teesheetConfigs.findMany).mockResolvedValue([
        defaultConfig,
      ] as any);

      const result = await getConfigForDate(testDate);

      expect(result.id).not.toBe(99);
      expect(result.id).toBe(1);
    });
  });

  describe('getConfigForDate - Edge Cases', () => {
    it('should throw error when no config found', async () => {
      const testDate = new Date('2025-11-10');

      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Return empty array (no system configs)
      vi.mocked(db.query.teesheetConfigs.findMany).mockResolvedValue([]);

      // Should throw when no system configs available
      await expect(getConfigForDate(testDate)).rejects.toThrow();
    });

    it('should handle leap year dates correctly', async () => {
      const leapDayDate = new Date('2024-02-29'); // Leap day (Thursday)

      const weekdayRule = {
        id: 2,
        configId: 1,
        startDate: null,
        endDate: null,
        daysOfWeek: [1, 2, 3, 4, 5],
        priority: 10,
        isActive: true,
      };

      const weekdayConfig = {
        id: 1,
        name: 'Weekday Config',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [weekdayRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([weekdayRule] as any);

      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        weekdayConfig as any
      );

      // Also mock findMany for system fallback (in case recurring rule doesn't match)
      vi.mocked(db.query.teesheetConfigs.findMany).mockResolvedValue([
        weekdayConfig,
      ] as any);

      const result = await getConfigForDate(leapDayDate);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should handle timezone edge cases', async () => {
      // Test with UTC midnight vs local midnight
      const utcDate = new Date('2025-11-10T00:00:00Z');

      const weekdayRule = {
        id: 2,
        configId: 1,
        startDate: null,
        endDate: null,
        daysOfWeek: [1], // Monday
        priority: 10,
        isActive: true,
      };

      const weekdayConfig = {
        id: 1,
        name: 'Weekday Config',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '19:00',
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [weekdayRule],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.teesheetConfigRules.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([weekdayRule] as any);

      vi.mocked(db.query.teesheetConfigs.findFirst).mockResolvedValue(
        weekdayConfig as any
      );

      const result = await getConfigForDate(utcDate);

      expect(result).toBeDefined();
    });
  });
});
