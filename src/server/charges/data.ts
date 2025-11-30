import "server-only";
import { and, desc, eq, gte, lte, sql, or, ilike } from "drizzle-orm";
import { db } from "../db";

import {
  powerCartCharges,
  generalCharges,
  members,
  guests,
} from "../db/schema";
import { formatCalendarDate } from "~/lib/utils";
import { alias } from "drizzle-orm/pg-core";

export interface ChargeFilters {
  startDate?: string;
  endDate?: string;
  search?: string;
  chargeType?: string;
  page?: number;
  pageSize?: number;
  charged?: boolean;
  memberId?: number;
  guestId?: number;
}

// Get pending power cart charges
export async function getPendingPowerCartCharges(date?: Date) {
  const memberTable = members;
  const splitMemberTable = alias(members, "split_members");

  const query = db
    .select({
      id: powerCartCharges.id,
      date: powerCartCharges.date,
      isMedical: powerCartCharges.isMedical,
      staffInitials: powerCartCharges.staffInitials,
      charged: powerCartCharges.charged,
      numHoles: powerCartCharges.numHoles,
      isSplit: powerCartCharges.isSplit,
      member: {
        id: memberTable.id,
        firstName: memberTable.firstName,
        lastName: memberTable.lastName,
        memberNumber: memberTable.memberNumber,
      },
      guest: {
        id: guests.id,
        firstName: guests.firstName,
        lastName: guests.lastName,
      },
      splitWithMember: {
        id: sql<number>`split_members.id`,
        firstName: sql<string>`split_members.first_name`,
        lastName: sql<string>`split_members.last_name`,
        memberNumber: sql<string>`split_members.member_number`,
      },
    })
    .from(powerCartCharges)
    .leftJoin(memberTable, eq(powerCartCharges.memberId, memberTable.id))
    .leftJoin(guests, eq(powerCartCharges.guestId, guests.id))
    .leftJoin(
      splitMemberTable,
      eq(powerCartCharges.splitWithMemberId, splitMemberTable.id),
    )
    .where(
      and(
        eq(powerCartCharges.charged, false),
        date ? eq(powerCartCharges.date, formatCalendarDate(date)) : undefined,
      ),
    )
    .orderBy(desc(powerCartCharges.date));

  return query;
}

// Get pending general charges
export async function getPendingGeneralCharges(date?: Date) {
  const memberTable = members;
  const sponsorMemberTable = alias(members, "sponsor_members");

  const query = db
    .select({
      id: generalCharges.id,
      date: generalCharges.date,
      chargeType: generalCharges.chargeType,
      paymentMethod: generalCharges.paymentMethod,
      staffInitials: generalCharges.staffInitials,
      charged: generalCharges.charged,
      member: {
        id: memberTable.id,
        firstName: memberTable.firstName,
        lastName: memberTable.lastName,
        memberNumber: memberTable.memberNumber,
      },
      guest: {
        id: guests.id,
        firstName: guests.firstName,
        lastName: guests.lastName,
      },
      sponsorMember: {
        id: sql<number>`sponsor_members.id`,
        firstName: sql<string>`sponsor_members.first_name`,
        lastName: sql<string>`sponsor_members.last_name`,
        memberNumber: sql<string>`sponsor_members.member_number`,
      },
    })
    .from(generalCharges)
    .leftJoin(memberTable, eq(generalCharges.memberId, memberTable.id))
    .leftJoin(guests, eq(generalCharges.guestId, guests.id))
    .leftJoin(
      sponsorMemberTable,
      eq(generalCharges.sponsorMemberId, sponsorMemberTable.id),
    )
    .where(
      and(
        eq(generalCharges.charged, false),
        date ? eq(generalCharges.date, formatCalendarDate(date)) : undefined,
      ),
    )
    .orderBy(desc(generalCharges.date));

  return query;
}

// Get charge history with filters
export async function getChargeHistory(filters: ChargeFilters) {
  // Power cart charges
  const powerCartQuery = db
    .select({
      id: powerCartCharges.id,
      date: powerCartCharges.date,
      isMedical: powerCartCharges.isMedical,
      staffInitials: powerCartCharges.staffInitials,
      member: {
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        memberNumber: members.memberNumber,
      },
      guest: {
        id: guests.id,
        firstName: guests.firstName,
        lastName: guests.lastName,
      },
      splitWithMember: {
        id: sql<number>`split_members.id`,
        firstName: sql<string>`split_members.first_name`,
        lastName: sql<string>`split_members.last_name`,
        memberNumber: sql<string>`split_members.member_number`,
      },
    })
    .from(powerCartCharges)
    .leftJoin(members, eq(powerCartCharges.memberId, members.id))
    .leftJoin(guests, eq(powerCartCharges.guestId, guests.id))
    .leftJoin(
      alias(members, "split_members"),
      eq(powerCartCharges.splitWithMemberId, sql`split_members.id`),
    )
    .where(
      and(
        filters.charged !== undefined
          ? eq(powerCartCharges.charged, filters.charged)
          : undefined,
        filters.memberId
          ? eq(powerCartCharges.memberId, filters.memberId)
          : undefined,
        filters.guestId
          ? eq(powerCartCharges.guestId, filters.guestId)
          : undefined,
        filters.startDate
          ? gte(powerCartCharges.date, formatCalendarDate(filters.startDate))
          : undefined,
        filters.endDate
          ? lte(powerCartCharges.date, formatCalendarDate(filters.endDate))
          : undefined,
      ),
    )
    .orderBy(desc(powerCartCharges.date));

  // General charges
  const generalQuery = db
    .select({
      id: generalCharges.id,
      date: generalCharges.date,
      chargeType: generalCharges.chargeType,
      paymentMethod: generalCharges.paymentMethod,
      staffInitials: generalCharges.staffInitials,
      member: {
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        memberNumber: members.memberNumber,
      },
      guest: {
        id: guests.id,
        firstName: guests.firstName,
        lastName: guests.lastName,
      },
      sponsorMember: {
        id: sql<number>`sponsor_members.id`,
        firstName: sql<string>`sponsor_members.first_name`,
        lastName: sql<string>`sponsor_members.last_name`,
        memberNumber: sql<string>`sponsor_members.member_number`,
      },
    })
    .from(generalCharges)
    .leftJoin(members, eq(generalCharges.memberId, members.id))
    .leftJoin(guests, eq(generalCharges.guestId, guests.id))
    .leftJoin(
      alias(members, "sponsor_members"),
      eq(generalCharges.sponsorMemberId, sql`sponsor_members.id`),
    )
    .where(
      and(
        filters.charged !== undefined
          ? eq(generalCharges.charged, filters.charged)
          : undefined,
        filters.memberId
          ? eq(generalCharges.memberId, filters.memberId)
          : undefined,
        filters.guestId
          ? eq(generalCharges.guestId, filters.guestId)
          : undefined,
        filters.startDate
          ? gte(generalCharges.date, formatCalendarDate(filters.startDate))
          : undefined,
        filters.endDate
          ? lte(generalCharges.date, formatCalendarDate(filters.endDate))
          : undefined,
        filters.chargeType
          ? eq(generalCharges.chargeType, filters.chargeType)
          : undefined,
      ),
    )
    .orderBy(desc(generalCharges.date));

  const [powerCartResults, generalResults] = await Promise.all([
    powerCartQuery,
    generalQuery,
  ]);

  return {
    powerCartCharges: powerCartResults,
    generalCharges: generalResults,
  };
}

// Get pending charges count for notifications
export async function getPendingChargesCount() {
  const [powerCartCount, generalCount] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(powerCartCharges)
      .where(and(eq(powerCartCharges.charged, false))),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(generalCharges)
      .where(and(eq(generalCharges.charged, false))),
  ]);

  const powerCartTotal = Number(powerCartCount[0]?.count) || 0;
  const generalTotal = Number(generalCount[0]?.count) || 0;

  return {
    powerCartCount: powerCartTotal,
    generalCount: generalTotal,
    total: powerCartTotal + generalTotal,
  };
}

export async function getFilteredCharges(filters: ChargeFilters) {
  const { page = 1, pageSize = 10 } = filters;
  const offset = (page - 1) * pageSize;

  const memberTable = members;
  const splitMemberTable = alias(members, "split_members");
  const sponsorMemberTable = alias(members, "sponsor_members");

  // Create search conditions for each word in the search term
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) || [];
  const createSearchConditions = (terms: string[]) => {
    if (terms.length === 0) return undefined;

    return and(
      ...terms.map((term) =>
        or(
          ilike(memberTable.firstName, `%${term}%`),
          ilike(memberTable.lastName, `%${term}%`),
          ilike(guests.firstName, `%${term}%`),
          ilike(guests.lastName, `%${term}%`),
          sql<boolean>`split_members.first_name ILIKE ${`%${term}%`}`,
          sql<boolean>`split_members.last_name ILIKE ${`%${term}%`}`,
          ilike(powerCartCharges.staffInitials, `%${term}%`),
        ),
      ),
    );
  };

  const createGeneralSearchConditions = (terms: string[]) => {
    if (terms.length === 0) return undefined;

    return and(
      ...terms.map((term) =>
        or(
          ilike(memberTable.firstName, `%${term}%`),
          ilike(memberTable.lastName, `%${term}%`),
          ilike(guests.firstName, `%${term}%`),
          ilike(guests.lastName, `%${term}%`),
          sql<boolean>`sponsor_members.first_name ILIKE ${`%${term}%`}`,
          sql<boolean>`sponsor_members.last_name ILIKE ${`%${term}%`}`,
          ilike(generalCharges.staffInitials, `%${term}%`),
          ilike(generalCharges.chargeType, `%${term}%`),
        ),
      ),
    );
  };

  // Power cart charges query
  const powerCartQuery = db
    .select({
      id: powerCartCharges.id,
      date: powerCartCharges.date,
      isMedical: powerCartCharges.isMedical,
      staffInitials: powerCartCharges.staffInitials,
      charged: powerCartCharges.charged,
      numHoles: powerCartCharges.numHoles,
      isSplit: powerCartCharges.isSplit,
      member: {
        id: memberTable.id,
        firstName: memberTable.firstName,
        lastName: memberTable.lastName,
        memberNumber: memberTable.memberNumber,
      },
      guest: {
        id: guests.id,
        firstName: guests.firstName,
        lastName: guests.lastName,
      },
      splitWithMember: {
        id: sql<number>`split_members.id`,
        firstName: sql<string>`split_members.first_name`,
        lastName: sql<string>`split_members.last_name`,
        memberNumber: sql<string>`split_members.member_number`,
      },
    })
    .from(powerCartCharges)
    .leftJoin(memberTable, eq(powerCartCharges.memberId, memberTable.id))
    .leftJoin(guests, eq(powerCartCharges.guestId, guests.id))
    .leftJoin(
      splitMemberTable,
      eq(powerCartCharges.splitWithMemberId, splitMemberTable.id),
    )
    .where(
      and(
        eq(powerCartCharges.charged, true),
        filters.startDate
          ? gte(powerCartCharges.date, formatCalendarDate(filters.startDate))
          : undefined,
        filters.endDate
          ? lte(powerCartCharges.date, formatCalendarDate(filters.endDate))
          : undefined,
        createSearchConditions(searchTerms),
      ),
    )
    .orderBy(desc(powerCartCharges.date))
    .limit(pageSize)
    .offset(offset);

  // General charges query
  const generalQuery = db
    .select({
      id: generalCharges.id,
      date: generalCharges.date,
      chargeType: generalCharges.chargeType,
      paymentMethod: generalCharges.paymentMethod,
      staffInitials: generalCharges.staffInitials,
      charged: generalCharges.charged,
      member: {
        id: memberTable.id,
        firstName: memberTable.firstName,
        lastName: memberTable.lastName,
        memberNumber: memberTable.memberNumber,
      },
      guest: {
        id: guests.id,
        firstName: guests.firstName,
        lastName: guests.lastName,
      },
      sponsorMember: {
        id: sql<number>`sponsor_members.id`,
        firstName: sql<string>`sponsor_members.first_name`,
        lastName: sql<string>`sponsor_members.last_name`,
        memberNumber: sql<string>`sponsor_members.member_number`,
      },
    })
    .from(generalCharges)
    .leftJoin(memberTable, eq(generalCharges.memberId, memberTable.id))
    .leftJoin(guests, eq(generalCharges.guestId, guests.id))
    .leftJoin(
      sponsorMemberTable,
      eq(generalCharges.sponsorMemberId, sponsorMemberTable.id),
    )
    .where(
      and(
        eq(generalCharges.charged, true),
        filters.startDate
          ? gte(generalCharges.date, formatCalendarDate(filters.startDate))
          : undefined,
        filters.endDate
          ? lte(generalCharges.date, formatCalendarDate(filters.endDate))
          : undefined,
        createGeneralSearchConditions(searchTerms),
      ),
    )
    .orderBy(desc(generalCharges.date))
    .limit(pageSize)
    .offset(offset);

  // Get total counts for pagination
  const [powerCartTotal, generalTotal] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(powerCartCharges)
      .where(and(eq(powerCartCharges.charged, true))),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(generalCharges)
      .where(and(eq(generalCharges.charged, true))),
  ]);

  const [powerCartResults, generalResults] = await Promise.all([
    filters.chargeType === "general" ? [] : powerCartQuery,
    filters.chargeType === "power-cart" ? [] : generalQuery,
  ]);

  return {
    powerCartCharges: powerCartResults,
    generalCharges: generalResults,
    pagination: {
      total:
        Number(powerCartTotal[0]?.count || 0) +
        Number(generalTotal[0]?.count || 0),
      pageSize,
      currentPage: filters.page || 1,
    },
  };
}
