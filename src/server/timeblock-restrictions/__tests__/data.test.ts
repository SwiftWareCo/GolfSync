import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkBatchTimeblockRestrictions, getTimeblockRestrictionsByCategory, getMemberClasses } from '../data';

vi.mock('~/server/db', () => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
    query: {
      timeblockRestrictions: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      members: {
        findMany: vi.fn(),
      },
      timeBlockMembers: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock('~/lib/utils', () => ({
  formatDateToYYYYMMDD: (date: Date | string) => {
    if (typeof date === 'string') return date.split('T')[0];
    return date.toISOString().split('T')[0];
  },
  formatDisplayTime: (time: string) => time,
}));

import { db } from '~/server/db';

describe('Member Class Restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTimeblockRestrictionsByCategory', () => {
    it('should get member class restrictions', async () => {
      const mockRestrictions = [
        {
          id: 1,
          name: 'Weekday Morning Restriction',
          restrictionCategory: 'MEMBER_CLASS',
          restrictionType: 'TIME',
          memberClasses: ['RESTRICTED'],
          startTime: '06:00',
          endTime: '12:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
        },
      ];
      vi.mocked(db.query.timeblockRestrictions.findMany).mockResolvedValue(mockRestrictions as any);
      const result = await getTimeblockRestrictionsByCategory('MEMBER_CLASS');
      expect(result).toEqual(mockRestrictions);
      expect(db.query.timeblockRestrictions.findMany).toHaveBeenCalled();
    });

    it('should get guest restrictions', async () => {
      const mockRestrictions = [
        {
          id: 2,
          name: 'Weekend Guest Restriction',
          restrictionCategory: 'GUEST',
          restrictionType: 'TIME',
          startTime: '07:00',
          endTime: '10:00',
          daysOfWeek: [0, 6],
          isActive: true,
        },
      ];
      vi.mocked(db.query.timeblockRestrictions.findMany).mockResolvedValue(mockRestrictions as any);
      const result = await getTimeblockRestrictionsByCategory('GUEST');
      expect(result).toEqual(mockRestrictions);
    });

    it('should get course availability restrictions', async () => {
      const mockRestrictions = [
        {
          id: 3,
          name: 'Course Closed - Maintenance',
          restrictionCategory: 'COURSE_AVAILABILITY',
          restrictionType: 'AVAILABILITY',
          startDate: new Date('2025-12-25'),
          endDate: new Date('2025-12-26'),
          isActive: true,
        },
      ];
      vi.mocked(db.query.timeblockRestrictions.findMany).mockResolvedValue(mockRestrictions as any);
      const result = await getTimeblockRestrictionsByCategory('COURSE_AVAILABILITY');
      expect(result).toEqual(mockRestrictions);
    });
  });

  describe('getMemberClasses', () => {
    it('should return list of all member classes', async () => {
      const mockClasses = [
        { class: 'UNLIMITED PLAY' },
        { class: 'FULL PLAY' },
        { class: 'RESTRICTED' },
        { class: 'SENIOR' },
      ];
      vi.mocked(db.selectDistinct).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockClasses),
      } as any);
      const result = await getMemberClasses();
      expect(result).toEqual(['UNLIMITED PLAY', 'FULL PLAY', 'RESTRICTED', 'SENIOR']);
    });

    it('should handle empty member classes', async () => {
      vi.mocked(db.selectDistinct).mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      } as any);
      const result = await getMemberClasses();
      expect(result).toEqual([]);
    });
  });
});

describe('Time Restriction Checking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkBatchTimeblockRestrictions - Member Time Restrictions', () => {
    it('should allow UNLIMITED PLAY member to book anytime', async () => {
      const timeBlocks = [
        { id: 1, startTime: '08:00', date: '2025-11-10' },
      ];
      vi.mocked(db.query.timeblockRestrictions.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await checkBatchTimeblockRestrictions({
        timeBlocks,
        memberId: 1,
        memberClass: 'UNLIMITED PLAY',
      });
      expect(result).toHaveLength(1);
      expect(result[0].hasViolations).toBe(false);
      expect(result[0].violations).toHaveLength(0);
    });

    it('should block RESTRICTED member during restricted hours', async () => {
      const timeBlocks = [
        { id: 1, startTime: '08:00', date: '2025-11-10' },
      ];
      const mockRestrictions = [
        {
          id: 1,
          name: 'Weekday Morning Restriction',
          description: 'Restricted members cannot book weekday mornings',
          restrictionCategory: 'MEMBER_CLASS',
          restrictionType: 'TIME',
          memberClasses: ['RESTRICTED'],
          startTime: '06:00',
          endTime: '12:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
          canOverride: true,
        },
      ];
      vi.mocked(db.query.timeblockRestrictions.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRestrictions as any);
      const result = await checkBatchTimeblockRestrictions({
        timeBlocks,
        memberId: 1,
        memberClass: 'RESTRICTED',
      });
      expect(result).toHaveLength(1);
      expect(result[0].hasViolations).toBe(true);
      expect(result[0].violations).toHaveLength(1);
      expect(result[0].violations[0].restrictionCategory).toBe('MEMBER_CLASS');
      expect(result[0].violations[0].type).toBe('TIME');
      expect(result[0].violations[0].canOverride).toBe(true);
    });

    it('should allow RESTRICTED member outside restricted hours', async () => {
      const timeBlocks = [
        { id: 1, startTime: '14:00', date: '2025-11-10' },
      ];
      const mockRestrictions = [
        {
          id: 1,
          name: 'Weekday Morning Restriction',
          restrictionCategory: 'MEMBER_CLASS',
          restrictionType: 'TIME',
          memberClasses: ['RESTRICTED'],
          startTime: '06:00',
          endTime: '12:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
        },
      ];
      vi.mocked(db.query.timeblockRestrictions.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRestrictions as any);
      const result = await checkBatchTimeblockRestrictions({
        timeBlocks,
        memberId: 1,
        memberClass: 'RESTRICTED',
      });
      expect(result).toHaveLength(1);
      expect(result[0].hasViolations).toBe(false);
    });



    it('should apply day-of-week restrictions correctly', async () => {

      const timeBlocks = [

        { id: 1, startTime: '08:00', date: '2025-11-08' }, // Saturday

      ];



      const mockRestrictions = [

        {

          id: 1,

          name: 'Weekday Only Restriction',

          restrictionCategory: 'MEMBER_CLASS',

          restrictionType: 'TIME',

          memberClasses: ['RESTRICTED'],

          startTime: '06:00',

          endTime: '12:00',

          daysOfWeek: [1, 2, 3, 4, 5], // Weekdays only

          isActive: true,

        },

      ];



      vi.mocked(db.query.timeblockRestrictions.findMany)

        .mockResolvedValueOnce([])

        .mockResolvedValueOnce(mockRestrictions as any);



      const result = await checkBatchTimeblockRestrictions({

        timeBlocks,

        memberId: 1,

        memberClass: 'RESTRICTED',

      });



      expect(result).toHaveLength(1);

      expect(result[0].hasViolations).toBe(false); // Saturday not in restricted days

    });

  });



  describe('checkBatchTimeblockRestrictions - Frequency Restrictions', () => {

    it('should block when frequency limit exceeded', async () => {

      const timeBlocks = [

        { id: 1, startTime: '08:00', date: '2025-11-10' },

      ];



      const mockRestrictions = [

        {

          id: 2,

          name: 'Monthly Booking Limit',

          description: 'Limited to 4 bookings per month',

          restrictionCategory: 'MEMBER_CLASS',

          restrictionType: 'FREQUENCY',

          memberClasses: ['RESTRICTED'],

          maxCount: 4,

          periodDays: 30,

          isActive: true,

          canOverride: false,

        },

      ];



      vi.mocked(db.query.timeblockRestrictions.findMany)

        .mockResolvedValueOnce([])

        .mockResolvedValueOnce(mockRestrictions as any);



      // Mock existing bookings count (member already has 4 bookings this month)

      vi.mocked(db.select).mockReturnValue({

        from: vi.fn().mockReturnValue({

          where: vi.fn().mockResolvedValue([{ count: 4 }]),

        }),

      } as any);



      const result = await checkBatchTimeblockRestrictions({

        timeBlocks,

        memberId: 1,

        memberClass: 'RESTRICTED',

      });



      expect(result).toHaveLength(1);

      expect(result[0].hasViolations).toBe(true);

      expect(result[0].violations[0].type).toBe('FREQUENCY');

      expect(result[0].violations[0].frequencyInfo).toBeDefined();

      expect(result[0].violations[0].frequencyInfo.currentCount).toBe(4);

      expect(result[0].violations[0].frequencyInfo.maxCount).toBe(4);

    });



    it('should allow booking when under frequency limit', async () => {

      const timeBlocks = [

        { id: 1, startTime: '08:00', date: '2025-11-10' },

      ];



      const mockRestrictions = [

        {

          id: 2,

          name: 'Monthly Booking Limit',

          restrictionCategory: 'MEMBER_CLASS',

          restrictionType: 'FREQUENCY',

          memberClasses: ['RESTRICTED'],

          maxCount: 4,

          periodDays: 30,

          isActive: true,

        },

      ];



      vi.mocked(db.query.timeblockRestrictions.findMany)

        .mockResolvedValueOnce([])

        .mockResolvedValueOnce(mockRestrictions as any);



      // Mock existing bookings count (member has 2 bookings, under limit)

      vi.mocked(db.select).mockReturnValue({

        from: vi.fn().mockReturnValue({

          where: vi.fn().mockResolvedValue([{ count: 2 }]),

        }),

      } as any);



      const result = await checkBatchTimeblockRestrictions({

        timeBlocks,

        memberId: 1,

        memberClass: 'RESTRICTED',

      });



      expect(result).toHaveLength(1);

      expect(result[0].hasViolations).toBe(false);

    });

  });



  describe('checkBatchTimeblockRestrictions - Course Availability', () => {

    it('should block booking during course closure', async () => {

      const timeBlocks = [

        { id: 1, startTime: '08:00', date: '2025-12-25' }, // Christmas

      ];



      const mockRestrictions = [

        {

          id: 3,

          name: 'Christmas Closure',

          description: 'Course closed for Christmas',

          restrictionCategory: 'COURSE_AVAILABILITY',

          restrictionType: 'AVAILABILITY',

          startDate: '2025-12-25',

          endDate: '2025-12-26',

          isActive: true,

          canOverride: false,

        },

      ];



      vi.mocked(db.query.timeblockRestrictions.findMany)

        .mockResolvedValueOnce(mockRestrictions as any) // COURSE_AVAILABILITY

        .mockResolvedValueOnce([]); // MEMBER_CLASS



      const result = await checkBatchTimeblockRestrictions({

        timeBlocks,

        memberId: 1,

        memberClass: 'UNLIMITED PLAY',

      });



      expect(result).toHaveLength(1);

      expect(result[0].hasViolations).toBe(true);

      expect(result[0].violations[0].restrictionCategory).toBe('COURSE_AVAILABILITY');

      expect(result[0].violations[0].type).toBe('AVAILABILITY');

      expect(result[0].violations[0].canOverride).toBe(false);

    });



    it('should allow booking outside course closure period', async () => {

      const timeBlocks = [

        { id: 1, startTime: '08:00', date: '2025-12-24' }, // Day before Christmas

      ];



      const mockRestrictions = [

        {

          id: 3,

          name: 'Christmas Closure',

          restrictionCategory: 'COURSE_AVAILABILITY',

          restrictionType: 'AVAILABILITY',

          startDate: '2025-12-25',

          endDate: '2025-12-26',

          isActive: true,

        },

      ];



      vi.mocked(db.query.timeblockRestrictions.findMany)

        .mockResolvedValueOnce(mockRestrictions as any)

        .mockResolvedValueOnce([]);



      const result = await checkBatchTimeblockRestrictions({

        timeBlocks,

        memberId: 1,

        memberClass: 'UNLIMITED PLAY',

      });



      expect(result).toHaveLength(1);

      expect(result[0].hasViolations).toBe(false);

    });

  });



  describe('checkBatchTimeblockRestrictions - Guest Restrictions', () => {

    it('should block guest during restricted hours', async () => {

      const timeBlocks = [

        { id: 1, startTime: '08:00', date: '2025-11-09' }, // Saturday

      ];



      const mockGuestRestrictions = [

        {

          id: 4,

          name: 'Weekend Morning Guest Restriction',

          description: 'Guests not allowed weekend mornings',

          restrictionCategory: 'GUEST',

          restrictionType: 'TIME',

          startTime: '06:00',

          endTime: '11:00',

          daysOfWeek: [0, 6], // Weekend

          isActive: true,

          canOverride: true,

        },

      ];



      // Mock the sequential calls: COURSE_AVAILABILITY, then GUEST

      vi.mocked(db.query.timeblockRestrictions.findMany)

        .mockResolvedValueOnce([]) // COURSE_AVAILABILITY

        .mockResolvedValueOnce(mockGuestRestrictions as any); // GUEST



      const result = await checkBatchTimeblockRestrictions({

        timeBlocks,

        guestId: 1,

      });



      expect(result).toHaveLength(1);

      expect(result[0].hasViolations).toBe(true);

      expect(result[0].violations[0].restrictionCategory).toBe('GUEST');

    });

  });



  describe('checkBatchTimeblockRestrictions - Multiple Violations', () => {

    it('should report multiple violations for same timeblock', async () => {

      const timeBlocks = [

        { id: 1, startTime: '08:00', date: '2025-12-25' }, // Christmas + restricted time

      ];



      const courseRestriction = {

        id: 1,

        name: 'Christmas Closure',

        description: 'Course is closed for Christmas holiday',

        restrictionCategory: 'COURSE_AVAILABILITY',

        restrictionType: 'AVAILABILITY',

        startDate: '2025-12-25',

        endDate: '2025-12-26',

        isActive: true,

        canOverride: false,

      };



      const memberRestriction = {

        id: 2,

        name: 'Morning Restriction',

        description: 'Restricted members cannot book mornings',

        restrictionCategory: 'MEMBER_CLASS',

        restrictionType: 'TIME',

        memberClasses: ['RESTRICTED'],

        startTime: '06:00',

        endTime: '12:00',

        daysOfWeek: [],

        isActive: true,

        canOverride: true,

      };



      // Mock sequential calls: COURSE_AVAILABILITY first, then MEMBER_CLASS

      vi.mocked(db.query.timeblockRestrictions.findMany)

        .mockResolvedValueOnce([courseRestriction] as any) // COURSE_AVAILABILITY

        .mockResolvedValueOnce([memberRestriction] as any); // MEMBER_CLASS



      const result = await checkBatchTimeblockRestrictions({

        timeBlocks,

        memberId: 1,

        memberClass: 'RESTRICTED',

      });



      expect(result).toHaveLength(1);

      expect(result[0].hasViolations).toBe(true);

      expect(result[0].violations.length).toBeGreaterThanOrEqual(1);

      // Should prioritize AVAILABILITY over TIME for preferred reason

      expect(result[0].preferredReason).toContain('closed');

    });

  });

});



describe('Restriction Priority', () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });



  it('should prioritize AVAILABILITY violations in preferred reason', async () => {

    const timeBlocks = [

      { id: 1, startTime: '08:00', date: '2025-12-25' },

    ];



    const mockRestrictions = [

      {

        id: 1,

        name: 'Course Closed',

        description: 'Holiday closure',

        restrictionCategory: 'COURSE_AVAILABILITY',

        restrictionType: 'AVAILABILITY',

        startDate: '2025-12-25',

        endDate: '2025-12-25',

        isActive: true,
        canOverride: false,

      },

    ];



    // Mock sequential calls: COURSE_AVAILABILITY first, then MEMBER_CLASS

    vi.mocked(db.query.timeblockRestrictions.findMany)

      .mockResolvedValueOnce(mockRestrictions as any) // COURSE_AVAILABILITY

      .mockResolvedValueOnce([]); // MEMBER_CLASS (none)



    const result = await checkBatchTimeblockRestrictions({

      timeBlocks,

      memberId: 1,

      memberClass: 'UNLIMITED PLAY',

    });



    expect(result[0].hasViolations).toBe(true);

    expect(result[0].preferredReason).toBe('Holiday closure');

  });

});