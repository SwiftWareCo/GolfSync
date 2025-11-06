import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateTeesheet, createTimeBlocksForTeesheet } from '../data';
import { ConfigTypes } from '~/app/types/TeeSheetTypes';
import type { TeesheetConfig } from '~/app/types/TeeSheetTypes';

// Helper to create chainable db.select mock
function createSelectMock(returnValue: any[], fillsReturnValue: any[] = []) {
  const mockChain = {
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(returnValue),
    }),
    orderBy: vi.fn().mockResolvedValue(returnValue),
  };

  const innerJoinChain = {
    innerJoin: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(returnValue),
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(returnValue),
      }),
    }),
    where: vi.fn().mockResolvedValue(returnValue),
  };

  let callCount = 0;
  return {
    from: vi.fn().mockImplementation(() => {
      callCount++;
      // First two calls are for time blocks and guests, third call is for fills
      if (callCount >= 3) {
        return {
          where: vi.fn().mockResolvedValue(fillsReturnValue),
        };
      }
      return {
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue(mockChain),
        }),
        innerJoin: vi.fn().mockReturnValue(innerJoinChain),
        where: vi.fn().mockReturnValue(mockChain),
        ...mockChain,
      };
    }),
  };
}

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    insert: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    query: {
      teesheets: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      timeBlocks: {
        findMany: vi.fn(),
      },
      templates: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock the settings data module
vi.mock('~/server/settings/data', () => ({
  getConfigForDate: vi.fn(),
}));

// Mock the utils module
vi.mock('~/lib/utils', () => ({
  generateTimeBlocks: vi.fn(),
}));

// Mock the dates module
vi.mock('~/lib/dates', () => ({
  getDateForDB: vi.fn((date: Date) => date.toISOString().split('T')[0]),
}));

import { db } from '~/server/db';
import { getConfigForDate } from '~/server/settings/data';
import { generateTimeBlocks } from '~/lib/utils';

describe('Teesheet Data Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for db.select that returns empty array
    vi.mocked(db.select).mockReturnValue(createSelectMock([]) as any);

    // Default mock for db.delete
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as any);

    // Default mock for db.insert
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any)
  });

  describe('getOrCreateTeesheet', () => {
    it('should create a new teesheet with REGULAR config for weekday', async () => {
      const testDate = new Date('2025-11-10'); // Monday
      const mockConfig: TeesheetConfig = {
        id: 1,
        name: 'Weekday Config',
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
      };

      const mockTeesheet = {
        id: 1,
        date: '2025-11-10',
        configId: 1,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock getConfigForDate
      vi.mocked(getConfigForDate).mockResolvedValue(mockConfig);

      // Mock insert returning new teesheet
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockTeesheet]),
          }),
        }),
      } as any);

      // Mock no existing time blocks (first check)
      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([]);

      // Mock generateTimeBlocks
      vi.mocked(generateTimeBlocks).mockReturnValue([
        '07:00',
        '07:15',
        '07:30',
      ]);
      // Mock teesheets.findFirst for getTimeBlocksForTeesheet
      vi.mocked(db.query.teesheets.findFirst).mockResolvedValue(
        mockTeesheet as any
      );
      // Mock db.select for getTimeBlocksForTeesheet (returns empty since no blocks yet)
      vi.mocked(db.select).mockReturnValue(createSelectMock([]) as any);

      const result = await getOrCreateTeesheet(testDate);

      expect(result).toBeDefined();
      expect(result.teesheet).toEqual(mockTeesheet);
      expect(result.config).toEqual(mockConfig);
      expect(getConfigForDate).toHaveBeenCalledWith(testDate);
    });

    it('should return existing teesheet when date conflict occurs', async () => {
      const testDate = new Date('2025-11-10');
      const mockConfig: TeesheetConfig = {
        id: 1,
        name: 'Weekday Config',
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
      };

      const existingTeesheet = {
        id: 1,
        date: '2025-11-10',
        configId: 1,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        config: mockConfig,
      };

      vi.mocked(getConfigForDate).mockResolvedValue(mockConfig);

      // Mock insert returning nothing (conflict)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // Empty array = conflict
          }),
        }),
      } as any);

      // Mock findFirst returning existing teesheet
      vi.mocked(db.query.teesheets.findFirst).mockResolvedValue(
        existingTeesheet as any
      );

      // Mock existing time blocks
      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([
        { id: 1, teesheetId: 1, startTime: '07:00' },
      ] as any);

      const result = await getOrCreateTeesheet(testDate);

      expect(result.teesheet).toEqual(existingTeesheet);
      expect(result.config).toEqual(mockConfig);
      expect(db.query.teesheets.findFirst).toHaveBeenCalled();
    });

    it('should create time blocks for new teesheet with no existing blocks', async () => {
      const testDate = new Date('2025-11-10');
      const mockConfig: TeesheetConfig = {
        id: 1,
        name: 'Weekday Config',
        type: ConfigTypes.REGULAR,
        startTime: '07:00',
        endTime: '09:00',
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTeesheet = {
        id: 1,
        date: '2025-11-10',
        configId: 1,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getConfigForDate).mockResolvedValue(mockConfig);

      // Setup insert mock to handle both teesheet insert (with onConflictDoNothing) and time blocks insert
      let insertCallCount = 0;
      vi.mocked(db.insert).mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          // First call: teesheet insert
          return {
            values: vi.fn().mockReturnValue({
              onConflictDoNothing: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([mockTeesheet]),
              }),
            }),
          } as any;
        } else {
          // Subsequent calls: time blocks insert
          return {
            values: vi.fn().mockResolvedValue(undefined),
          } as any;
        }
      });

      // First call (getOrCreateTeesheet line 175): no blocks exist
      // Second call (createTimeBlocksForTeesheet line 44): no blocks exist
      vi.mocked(db.query.timeBlocks.findMany)
        .mockResolvedValueOnce([]) // getOrCreateTeesheet check
        .mockResolvedValueOnce([]); // createTimeBlocksForTeesheet check
      vi.mocked(generateTimeBlocks).mockReturnValue([
        '07:00',
        '07:15',
        '07:30',
        '07:45',
        '08:00',
        '08:15',
        '08:30',
        '08:45',
      ]);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      // Mock db.select for getTimeBlocksForTeesheet
      const mockTimeBlockRows = [
        {
          id: 1,
          teesheetId: 1,
          startTime: '07:00',
          endTime: '07:00',
          notes: null,
          displayName: null,
          maxMembers: 4,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          members: null,
        },
      ];

      // Mock teesheets.findFirst for getTimeBlocksForTeesheet
      vi.mocked(db.query.teesheets.findFirst).mockResolvedValue(
        mockTeesheet as any
      );
      vi.mocked(db.select).mockReturnValue(createSelectMock(mockTimeBlockRows) as any);

      const result = await getOrCreateTeesheet(testDate);

      expect(result).toBeDefined();
      expect(generateTimeBlocks).toHaveBeenCalledWith({
        startTime: '07:00',
        endTime: '09:00',
        interval: 15,
      });
    });

    it('should handle CUSTOM config with template blocks', async () => {
      const testDate = new Date('2025-12-25'); // Christmas
      const mockConfig: TeesheetConfig = {
        id: 2,
        name: 'Holiday Config',
        type: ConfigTypes.CUSTOM,
        templateId: 1,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTeesheet = {
        id: 2,
        date: '2025-12-25',
        configId: 2,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTemplate = {
        id: 1,
        name: 'Holiday Template',
        blocks: [
          { startTime: '08:00', maxPlayers: 4, displayName: 'Morning Slot' },
          { startTime: '10:00', maxPlayers: 4, displayName: 'Late Morning' },
          { startTime: '13:00', maxPlayers: 4, displayName: 'Afternoon' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getConfigForDate).mockResolvedValue(mockConfig);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockTeesheet]),
          }),
        }),
      } as any);

      // No existing blocks
      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([]);

      // Mock template fetch
      vi.mocked(db.query.templates.findFirst).mockResolvedValue(
        mockTemplate as any
      );

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      // Mock db.select for getTimeBlocksForTeesheet
      vi.mocked(db.select).mockReturnValue(createSelectMock([]) as any);

      const result = await getOrCreateTeesheet(testDate);

      expect(result).toBeDefined();
      expect(result.config.type).toBe(ConfigTypes.CUSTOM);
    });
  });

  describe('createTimeBlocksForTeesheet - REGULAR config', () => {
    it('should generate time blocks based on interval', async () => {
      const mockConfig: TeesheetConfig = {
        id: 1,
        name: 'Test Config',
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '10:00',
        interval: 30,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock no existing blocks
      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([]);

      vi.mocked(generateTimeBlocks).mockReturnValue([
        '08:00',
        '08:30',
        '09:00',
        '09:30',
      ]);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      // Mock db.select for getTimeBlocksForTeesheet
      const mockTimeBlockRows = [
        {
          id: 1,
          teesheetId: 1,
          startTime: '08:00',
          endTime: '08:00',
          notes: null,
          displayName: null,
          maxMembers: 4,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          members: null,
        },
      ];
      // Mock teesheets.findFirst for getTimeBlocksForTeesheet
      vi.mocked(db.query.teesheets.findFirst).mockResolvedValue({
        id: 1,
        date: '2025-11-10',
        configId: 1,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Mock teesheets.findFirst for getTimeBlocksForTeesheet
      vi.mocked(db.query.teesheets.findFirst).mockResolvedValue({
        id: 1,
        date: '2025-11-10',
        configId: 1,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(db.select).mockReturnValue(createSelectMock(mockTimeBlockRows) as any);

      await createTimeBlocksForTeesheet(1, mockConfig, '2025-11-10');

      expect(generateTimeBlocks).toHaveBeenCalledWith({
        startTime: '08:00',
        endTime: '10:00',
        interval: 30,
      });
    });

    it('should handle race conditions when blocks already exist', async () => {
      const mockConfig: TeesheetConfig = {
        id: 1,
        name: 'Test Config',
        type: ConfigTypes.REGULAR,
        startTime: '08:00',
        endTime: '10:00',
        interval: 30,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock existing blocks (race condition)
      const existingBlocks = [
        { id: 1, teesheetId: 1, startTime: '08:00' },
        { id: 2, teesheetId: 1, startTime: '08:30' },
      ];

      // Mock query.timeBlocks.findMany to return existing blocks
      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue(
        existingBlocks as any
      );

       // Mock teesheets.findFirst for getTimeBlocksForTeesheet
       vi.mocked(db.query.teesheets.findFirst).mockResolvedValue({
        id: 1,
        date: '2025-11-10',
        configId: 1,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
  } as any);

      // Mock db.select for getTimeBlocksForTeesheet
      const mockTimeBlockRows = existingBlocks.map((block) => ({
        ...block,
        endTime: block.startTime,
        notes: null,
        displayName: null,
        maxMembers: 4,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        members: null,
      }));

      vi.mocked(db.select).mockReturnValue(createSelectMock(mockTimeBlockRows) as any);

      const result = await createTimeBlocksForTeesheet(
        1,
        mockConfig,
        '2025-11-10'
      );

      // Should return early without calling generateTimeBlocks
      expect(generateTimeBlocks).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('createTimeBlocksForTeesheet - CUSTOM config', () => {
    it('should create blocks from template', async () => {
      const mockConfig: TeesheetConfig = {
        id: 2,
        name: 'Custom Config',
        type: ConfigTypes.CUSTOM,
        templateId: 1,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTemplate = {
        id: 1,
        name: 'Test Template',
        blocks: [
          { startTime: '08:00', maxPlayers: 4, displayName: 'Slot 1' },
          { startTime: '10:00', maxPlayers: 3, displayName: 'Slot 2' },
          { startTime: '14:00', maxPlayers: 4, displayName: 'Slot 3' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([]);
      vi.mocked(db.query.templates.findFirst).mockResolvedValue(
        mockTemplate as any
      );

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      let capturedBlocks: any[] = [];
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((blocks) => {
          capturedBlocks = blocks;
          return Promise.resolve(undefined);
        }),
      } as any);
      // Mock teesheets.findFirst for getTimeBlocksForTeesheet
  vi.mocked(db.query.teesheets.findFirst).mockResolvedValue({
    id: 1,
    date: '2025-11-10',
    configId: 2,
    isPublic: false,
    published: false,
    generalNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

      // Mock db.select for getTimeBlocksForTeesheet
      const mockTimeBlockRows = [
        {
          id: 1,
          teesheetId: 1,
          startTime: '08:00',
          endTime: '08:00',
          notes: null,
          displayName: 'Slot 1',
          maxMembers: 4,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          members: null,
        },
      ];
      vi.mocked(db.select).mockReturnValue(createSelectMock(mockTimeBlockRows) as any);

      await createTimeBlocksForTeesheet(1, mockConfig, '2025-11-10');

      expect(db.query.templates.findFirst).toHaveBeenCalled();
      expect(capturedBlocks).toHaveLength(3);
      expect(capturedBlocks[0]).toMatchObject({
        startTime: '08:00',
        maxMembers: 4,
        displayName: 'Slot 1',
      });
    });

    it('should throw error when template not found', async () => {
      const mockConfig: TeesheetConfig = {
        id: 2,
        name: 'Custom Config',
        type: ConfigTypes.CUSTOM,
        templateId: 999, // Non-existent template
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([]);
      vi.mocked(db.query.templates.findFirst).mockResolvedValue(null);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      await expect(
        createTimeBlocksForTeesheet(1, mockConfig, '2025-11-10')
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when template has no blocks', async () => {
      const mockConfig: TeesheetConfig = {
        id: 2,
        name: 'Custom Config',
        type: ConfigTypes.CUSTOM,
        templateId: 1,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: false,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTemplate = {
        id: 1,
        name: 'Empty Template',
        blocks: null, // No blocks
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([]);
      vi.mocked(db.query.templates.findFirst).mockResolvedValue(
        mockTemplate as any
      );

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      await expect(
        createTimeBlocksForTeesheet(1, mockConfig, '2025-11-10')
      ).rejects.toThrow('Template has no blocks');
    });
  });

  describe('Edge Cases', () => {
    it('should handle teesheet creation for past dates', async () => {
      const pastDate = new Date('2020-01-01');
      const mockConfig: TeesheetConfig = {
        id: 1,
        name: 'Old Config',
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
      };

      const mockTeesheet = {
        id: 999,
        date: '2020-01-01',
        configId: 1,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getConfigForDate).mockResolvedValue(mockConfig);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockTeesheet]),
          }),
        }),
      } as any);
      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([]);
      vi.mocked(generateTimeBlocks).mockReturnValue(['07:00']);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      // Mock db.select for getTimeBlocksForTeesheet
      vi.mocked(db.select).mockReturnValue(createSelectMock([]) as any);

      const result = await getOrCreateTeesheet(pastDate);

      expect(result).toBeDefined();
      expect(result.teesheet.date).toBe('2020-01-01');
    });

    it('should throw error when config not found', async () => {
      const testDate = new Date('2025-11-10');

      vi.mocked(getConfigForDate).mockRejectedValue(
        new Error('Configuration not found')
      );

      await expect(getOrCreateTeesheet(testDate)).rejects.toThrow(
        'Configuration not found'
      );
    });

    it('should handle concurrent teesheet creation gracefully', async () => {
      const testDate = new Date('2025-11-10');
      const mockConfig: TeesheetConfig = {
        id: 1,
        name: 'Weekday Config',
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
      };

      vi.mocked(getConfigForDate).mockResolvedValue(mockConfig);

      // Simulate conflict (another request created it first)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // Empty = conflict
          }),
        }),
      } as any);

      const existingTeesheet = {
        id: 1,
        date: '2025-11-10',
        configId: 1,
        isPublic: false,
        published: false,
        generalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        config: mockConfig,
      };

      vi.mocked(db.query.teesheets.findFirst).mockResolvedValue(
        existingTeesheet as any
      );
      vi.mocked(db.query.timeBlocks.findMany).mockResolvedValue([
        { id: 1, teesheetId: 1, startTime: '07:00' },
      ] as any);

      const result = await getOrCreateTeesheet(testDate);

      expect(result).toBeDefined();
      expect(result.teesheet.id).toBe(1);
    });
  });
});
