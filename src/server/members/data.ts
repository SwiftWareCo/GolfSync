import { db } from "~/server/db";
import { members } from "~/server/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import type { Member } from "~/app/types/MemberTypes";
import { timeBlockMembers as timeBlockMembersSchema } from "~/server/db/schema";
import { formatDateToYYYYMMDD } from "~/lib/utils";

// Helper function to map members to their full names
export function mapMembersToNames(members: Member[]): string[] {
  return members.map((member) => `${member.firstName} ${member.lastName}`);
}

function convertToMember(row: any): Member {
  return {
    id: row.id,
    classId: row.classId,
    memberClass: row.memberClass || null,
    memberNumber: row.memberNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    email: row.email,
    gender: row.gender,
    dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
    handicap: row.handicap,
    bagNumber: row.bagNumber,
    createdAt: new Date(row.createdAt),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
}

export async function getMembers(): Promise<Member[]> {
  const rows = await db.query.members.findMany({
    with: {
      memberClass: true,
    },
    orderBy: (members, { asc }) => [
      asc(members.lastName),
      asc(members.firstName),
    ],
  });

  return rows.map(convertToMember);
}

export async function getMemberById(id: number): Promise<Member | null> {
  const row = await db.query.members.findFirst({
    where: eq(members.id, id),
    with: {
      memberClass: true,
    },
  });

  return row ? convertToMember(row) : null;
}

// Single-tenant: no organization filtering needed
export async function searchMembersList(query: string): Promise<Member[]> {
  const rows = await db.query.members.findMany({
    where: (members, { or, sql }) =>
      or(
        sql`CONCAT(${members.firstName}, ' ', ${members.lastName}) ILIKE ${`%${query}%`}`,
        sql`${members.memberNumber} ILIKE ${`%${query}%`}`,
      ),
    with: {
      memberClass: true,
    },
    orderBy: (members, { asc }) => [
      asc(members.lastName),
      asc(members.firstName),
    ],
  });

  return rows.map(convertToMember);
}

export async function searchMembers(query = "", page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const results = await db.query.members.findMany({
    where: (members, { or, sql }) =>
      or(
        sql`LOWER(${members.firstName}) LIKE ${`%${query.toLowerCase()}%`}`,
        sql`LOWER(${members.lastName}) LIKE ${`%${query.toLowerCase()}%`}`,
        sql`LOWER(${members.memberNumber}) LIKE ${`%${query.toLowerCase()}%`}`,
        sql`LOWER(CONCAT(${members.firstName}, ' ', ${members.lastName})) LIKE ${`%${query.toLowerCase()}%`}`,
      ),
    with: {
      memberClass: true,
    },
    limit: pageSize + 1,
    offset: offset,
    orderBy: (members, { asc }) => [asc(members.lastName)],
  });

  const hasMore = results.length > pageSize;
  const items = results.slice(0, pageSize);

  return { results: items, hasMore };
}

// Single-tenant: simplified booking history
export async function getMemberBookingHistory(
  memberId: number,
  options: {
    limit?: number;
    year?: number;
    month?: number; // 0-based month (0 = January, 11 = December)
  } = {},
): Promise<any[]> {
  try {
    const { limit = 50, year, month } = options;

    let whereConditions = eq(timeBlockMembersSchema.memberId, memberId);

    // Add month filtering if specified
    if (year !== undefined && month !== undefined) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      const monthStartStr = formatDateToYYYYMMDD(monthStart);
      const monthEndStr = formatDateToYYYYMMDD(monthEnd);

      whereConditions = and(
        whereConditions,
        gte(timeBlockMembersSchema.bookingDate, monthStartStr),
        lte(timeBlockMembersSchema.bookingDate, monthEndStr),
      ) as any; // Type assertion for simplified single-tenant query
    }

    const bookings = await db.query.timeBlockMembers.findMany({
      where: whereConditions,
      with: {
        timeBlock: true,
      },
      orderBy: [
        desc(timeBlockMembersSchema.bookingDate),
        desc(timeBlockMembersSchema.bookingTime),
      ],
      limit,
    });

    return bookings.map((booking) => ({
      id: booking.id,
      date: booking.bookingDate,
      time: booking.bookingTime,
      teesheetId: booking.timeBlock.teesheetId,
      timeBlockId: booking.timeBlockId,
      createdAt: booking.createdAt,
    }));
  } catch (error) {
    console.error("Error getting member booking history:", error);
    return [];
  }
}
