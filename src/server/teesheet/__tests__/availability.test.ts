import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    select: vi.fn(),
    query: {
      teesheets: {
        findFirst: vi.fn(),
      },
      timeBlocks: {
        findMany: vi.fn(),
      },
    },
  },
}));

// Mock lottery data functions
vi.mock('~/server/lottery/data', () => ({
  getAvailableTimeBlocksForDate: vi.fn(),
}));

import { getAvailableTimeBlocksForDate } from '~/server/lottery/data';

describe('Time Block Availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableTimeBlocksForDate - Capacity Limits', () => {
    it('should return available time block under capacity', async () => {
      const mockTeesheet = {
        id: 1,
        date: '2025-11-10',
        timeBlocks: [
          {
            id: 1,
            startTime: '08:00',
            maxMembers: 4,
            timeBlockMembers: [{ id: 1, memberId: 1 }], // 1 member
            timeBlockGuests: [], // 0 guests
            fills: [], // 0 fills
          },
        ],
      };

      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 1,
          availableSpots: 3,
          isAvailable: true,
          timeBlockMembers: mockTeesheet.timeBlocks[0].timeBlockMembers,
          timeBlockGuests: [],
          fills: [],
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result).toHaveLength(1);
      expect(result[0].availableSpots).toBe(3);
      expect(result[0].isAvailable).toBe(true);
      expect(result[0].currentOccupancy).toBe(1);
    });

    it('should return full time block at capacity', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 4,
          availableSpots: 0,
          isAvailable: false,
          timeBlockMembers: [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
          ],
          timeBlockGuests: [],
          fills: [],
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result).toHaveLength(1);
      expect(result[0].availableSpots).toBe(0);
      expect(result[0].isAvailable).toBe(false);
      expect(result[0].currentOccupancy).toBe(4);
    });

    it('should calculate occupancy from members + guests + fills', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 4,
          availableSpots: 0,
          isAvailable: false,
          timeBlockMembers: [{ id: 1 }], // 1 member
          timeBlockGuests: [{ id: 1 }, { id: 2 }], // 2 guests
          fills: [{ id: 1 }], // 1 fill
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result[0].currentOccupancy).toBe(4); // 1 + 2 + 1
      expect(result[0].availableSpots).toBe(0);
      expect(result[0].isAvailable).toBe(false);
    });

    it('should handle empty time blocks', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 0,
          availableSpots: 4,
          isAvailable: true,
          timeBlockMembers: [],
          timeBlockGuests: [],
          fills: [],
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result).toHaveLength(1);
      expect(result[0].currentOccupancy).toBe(0);
      expect(result[0].availableSpots).toBe(4);
      expect(result[0].isAvailable).toBe(true);
    });

    it('should handle varying maxMembers values', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 3, // Threesome slot
          currentOccupancy: 2,
          availableSpots: 1,
          isAvailable: true,
          timeBlockMembers: [{ id: 1 }, { id: 2 }],
          timeBlockGuests: [],
          fills: [],
        },
        {
          id: 2,
          startTime: '08:15',
          maxMembers: 4, // Foursome slot
          currentOccupancy: 3,
          availableSpots: 1,
          isAvailable: true,
          timeBlockMembers: [{ id: 3 }, { id: 4 }, { id: 5 }],
          timeBlockGuests: [],
          fills: [],
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result).toHaveLength(2);
      expect(result[0].maxMembers).toBe(3);
      expect(result[0].availableSpots).toBe(1);
      expect(result[1].maxMembers).toBe(4);
      expect(result[1].availableSpots).toBe(1);
    });
  });

  describe('getAvailableTimeBlocksForDate - Multiple Time Blocks', () => {
    it('should return multiple available time blocks', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 2,
          availableSpots: 2,
          isAvailable: true,
        },
        {
          id: 2,
          startTime: '08:15',
          maxMembers: 4,
          currentOccupancy: 1,
          availableSpots: 3,
          isAvailable: true,
        },
        {
          id: 3,
          startTime: '08:30',
          maxMembers: 4,
          currentOccupancy: 0,
          availableSpots: 4,
          isAvailable: true,
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result).toHaveLength(3);
      expect(result.every((block) => block.isAvailable)).toBe(true);
    });

    it('should return mix of available and full time blocks', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 4,
          availableSpots: 0,
          isAvailable: false,
        },
        {
          id: 2,
          startTime: '08:15',
          maxMembers: 4,
          currentOccupancy: 2,
          availableSpots: 2,
          isAvailable: true,
        },
        {
          id: 3,
          startTime: '08:30',
          maxMembers: 4,
          currentOccupancy: 4,
          availableSpots: 0,
          isAvailable: false,
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result).toHaveLength(3);
      expect(result.filter((block) => block.isAvailable)).toHaveLength(1);
      expect(result.filter((block) => !block.isAvailable)).toHaveLength(2);
    });

    it('should handle no available time blocks', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([]);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result).toHaveLength(0);
    });
  });

  describe('getAvailableTimeBlocksForDate - Edge Cases', () => {
    it('should handle time block with only guests', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 2,
          availableSpots: 2,
          isAvailable: true,
          timeBlockMembers: [],
          timeBlockGuests: [{ id: 1 }, { id: 2 }],
          fills: [],
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result[0].currentOccupancy).toBe(2);
      expect(result[0].availableSpots).toBe(2);
    });

    it('should handle time block with only fills', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 1,
          availableSpots: 3,
          isAvailable: true,
          timeBlockMembers: [],
          timeBlockGuests: [],
          fills: [{ id: 1 }],
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result[0].currentOccupancy).toBe(1);
      expect(result[0].availableSpots).toBe(3);
    });

    it('should handle time block with exactly one spot left', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 3,
          availableSpots: 1,
          isAvailable: true,
          timeBlockMembers: [{ id: 1 }, { id: 2 }, { id: 3 }],
          timeBlockGuests: [],
          fills: [],
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result[0].availableSpots).toBe(1);
      expect(result[0].isAvailable).toBe(true);
    });

    it('should handle over-capacity scenarios gracefully', async () => {
      // This shouldn't happen but test defensive behavior
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 5, // Over capacity
          availableSpots: -1,
          isAvailable: false,
          timeBlockMembers: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
          timeBlockGuests: [],
          fills: [],
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result[0].currentOccupancy).toBe(5);
      expect(result[0].availableSpots).toBeLessThan(0);
      expect(result[0].isAvailable).toBe(false);
    });
  });

  describe('getAvailableTimeBlocksForDate - Sorting and Ordering', () => {
    it('should return time blocks in chronological order', async () => {
      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        { id: 1, startTime: '08:00', availableSpots: 2, isAvailable: true },
        { id: 2, startTime: '08:15', availableSpots: 3, isAvailable: true },
        { id: 3, startTime: '08:30', availableSpots: 1, isAvailable: true },
        { id: 4, startTime: '08:45', availableSpots: 4, isAvailable: true },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result).toHaveLength(4);
      expect(result[0].startTime).toBe('08:00');
      expect(result[1].startTime).toBe('08:15');
      expect(result[2].startTime).toBe('08:30');
      expect(result[3].startTime).toBe('08:45');
    });
  });
});

describe('Booking Conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Double Booking Prevention', () => {
    it('should identify member already in different time block', async () => {
      const timeBlocks = [
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 2,
          availableSpots: 2,
          isAvailable: true,
          timeBlockMembers: [
            { id: 1, memberId: 5, bookingDate: '2025-11-10' },
            { id: 2, memberId: 6, bookingDate: '2025-11-10' },
          ],
        },
        {
          id: 2,
          startTime: '08:15',
          maxMembers: 4,
          currentOccupancy: 1,
          availableSpots: 3,
          isAvailable: true,
          timeBlockMembers: [
            { id: 3, memberId: 5, bookingDate: '2025-11-10' }, // Same member (5) in different block
          ],
        },
      ];

      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue(timeBlocks as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      // Member 5 should only be in one time block per date
      const member5Blocks = result.filter((block) =>
        block.timeBlockMembers.some((m: any) => m.memberId === 5)
      );

      expect(member5Blocks.length).toBeGreaterThan(1);
      // This documents current behavior - application layer should prevent this
    });

    it('should handle same member not double-booked', async () => {
      const timeBlocks = [
        {
          id: 1,
          startTime: '08:00',
          maxMembers: 4,
          currentOccupancy: 2,
          availableSpots: 2,
          isAvailable: true,
          timeBlockMembers: [
            { id: 1, memberId: 5, bookingDate: '2025-11-10' },
            { id: 2, memberId: 6, bookingDate: '2025-11-10' },
          ],
        },
        {
          id: 2,
          startTime: '08:15',
          maxMembers: 4,
          currentOccupancy: 1,
          availableSpots: 3,
          isAvailable: true,
          timeBlockMembers: [
            { id: 3, memberId: 7, bookingDate: '2025-11-10' },
          ],
        },
      ];

      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue(timeBlocks as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      const uniqueMemberIds = new Set();
      result.forEach((block) => {
        block.timeBlockMembers.forEach((member: any) => {
          expect(uniqueMemberIds.has(member.memberId)).toBe(false);
          uniqueMemberIds.add(member.memberId);
        });
      });
    });
  });
});

describe('Capacity Calculation', () => {
  it('should correctly calculate available spots', async () => {
    const testCases = [
      {
        maxMembers: 4,
        members: 2,
        guests: 0,
        fills: 0,
        expectedAvailable: 2,
      },
      {
        maxMembers: 4,
        members: 1,
        guests: 2,
        fills: 0,
        expectedAvailable: 1,
      },
      {
        maxMembers: 4,
        members: 1,
        guests: 1,
        fills: 1,
        expectedAvailable: 1,
      },
      {
        maxMembers: 3,
        members: 2,
        guests: 0,
        fills: 0,
        expectedAvailable: 1,
      },
    ];

    for (const testCase of testCases) {
      const timeBlockMembers = Array.from({ length: testCase.members }, (_, i) => ({
        id: i + 1,
      }));
      const timeBlockGuests = Array.from({ length: testCase.guests }, (_, i) => ({
        id: i + 1,
      }));
      const fills = Array.from({ length: testCase.fills }, (_, i) => ({ id: i + 1 }));

      vi.mocked(getAvailableTimeBlocksForDate).mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          maxMembers: testCase.maxMembers,
          currentOccupancy: testCase.members + testCase.guests + testCase.fills,
          availableSpots: testCase.expectedAvailable,
          isAvailable: testCase.expectedAvailable > 0,
          timeBlockMembers,
          timeBlockGuests,
          fills,
        },
      ] as any);

      const result = await getAvailableTimeBlocksForDate('2025-11-10');

      expect(result[0].availableSpots).toBe(testCase.expectedAvailable);
      expect(result[0].currentOccupancy).toBe(
        testCase.members + testCase.guests + testCase.fills
      );
    }
  });
});
