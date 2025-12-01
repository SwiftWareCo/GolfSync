import "server-only";
import { db } from "~/server/db";
import { events, eventRegistrations } from "~/server/db/schema";
import {
  eq,
  sql,
  and,
  desc,
  asc,
  or,
} from "drizzle-orm";

import {
  type Event,
  type EventRegistration,
  type EventType,
  type EventWithRegistrations,
} from "~/app/types/events";
import { getBCToday } from "~/lib/dates";

// Get all events
export async function getEvents(): Promise<EventWithRegistrations[]> {
  const rows = await db.query.events.findMany({
    with: {
      details: true,
      registrations: {
        with: {
          member: true,
        },
      },
    },
    orderBy: [desc(events.startDate)],
  });

  return rows.map((event) => {
    // Count actual participants: 1 (captain) + team members + fills
    // Only count approved and pending registrations
    const activeRegistrations = event.registrations?.filter(
      (reg) => reg.status === "APPROVED" || reg.status === "PENDING"
    ) || [];

    const registrationsCount = activeRegistrations.reduce((sum, reg) => {
      const teamMembersCount = reg.teamMemberIds?.length || 0;
      const fillsCount = Array.isArray(reg.fills) ? reg.fills.length : 0;
      return sum + 1 + teamMembersCount + fillsCount;
    }, 0);

    // Get pending registrations count
    const pendingRegistrationsCount = event.registrations?.filter(
      (reg) => reg.status === "PENDING"
    ).length || 0;

    return {
      ...event,
      eventType: event.eventType as EventType,
      registrationsCount,
      pendingRegistrationsCount,
      registrations: event.registrations,
    } as EventWithRegistrations;
  });
}

// Get upcoming events
export async function getUpcomingEvents(
  limit = 5,
  memberClass?: string,
): Promise<Event[]> {
  const today = getBCToday();

  const memberClassCondition = memberClass
    ? sql`AND (member_classes IS NULL OR array_length(member_classes, 1) IS NULL OR ${memberClass} = ANY(member_classes))`
    : sql``;

  const whereClause = sql`start_date >= ${today} AND is_active = true ${memberClassCondition}`;

  const rows = await db.query.events.findMany({
    where: whereClause,
    orderBy: [asc(events.startDate)],
    with: {
      details: true,
      registrations: true,
    },
    limit,
  });

  return rows.map((event) => {
    // Count actual participants: 1 (captain) + team members + fills
    const activeRegistrations = event.registrations?.filter(
      (reg) => reg.status === "APPROVED" || reg.status === "PENDING"
    ) || [];

    const registrationsCount = activeRegistrations.reduce((sum, reg) => {
      const teamMembersCount = reg.teamMemberIds?.length || 0;
      const fillsCount = Array.isArray(reg.fills) ? reg.fills.length : 0;
      return sum + 1 + teamMembersCount + fillsCount;
    }, 0);

    return {
      ...event,
      eventType: event.eventType as EventType,
      registrationsCount,
    } as Event;
  });
}

// Get a single event by ID
export async function getEventById(eventId: number): Promise<Event | null> {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      details: true,
      registrations: true,
    },
  });

  if (!event) return null;

  // Count actual participants: 1 (captain) + team members + fills
  const activeRegistrations = event.registrations?.filter(
    (reg) => reg.status === "APPROVED" || reg.status === "PENDING"
  ) || [];

  const registrationsCount = activeRegistrations.reduce((sum, reg) => {
    const teamMembersCount = reg.teamMemberIds?.length || 0;
    const fillsCount = Array.isArray(reg.fills) ? reg.fills.length : 0;
    return sum + 1 + teamMembersCount + fillsCount;
  }, 0);

  return {
    ...event,
    eventType: event.eventType as EventType,
    registrationsCount,
  } as Event;
}

// Get event registrations
export async function getEventRegistrations(
  eventId: number,
): Promise<EventRegistration[]> {
  const registrations = await db.query.eventRegistrations.findMany({
    where: and(eq(eventRegistrations.eventId, eventId)),
    with: {
      member: true,
    },
    orderBy: [desc(eventRegistrations.createdAt)],
  });

  // Fetch team member details for each registration
  const registrationsWithTeamMembers = await Promise.all(
    registrations.map(async (registration) => {
      let teamMembers: Awaited<ReturnType<typeof db.query.members.findMany>> = [];
      if (registration.teamMemberIds && registration.teamMemberIds.length > 0) {
        const teamMemberDetails = await db.query.members.findMany({
          where: sql.raw(`id = ANY(ARRAY[${registration.teamMemberIds.join(',')}])`),
        });
        teamMembers = teamMemberDetails;
      }

      return {
        ...registration,
        teamMembers,
      };
    })
  );

  return registrationsWithTeamMembers as EventRegistration[];
}


// Get a member's event registrations
export async function getMemberEventRegistrations(memberId: number) {
  const registrations = await db.query.eventRegistrations.findMany({
    where: or(
      eq(eventRegistrations.memberId, memberId),
      sql`${memberId} = ANY(team_member_ids)`,
    ),
    with: {
      event: true,
    },
    orderBy: [desc(eventRegistrations.createdAt)],
  });

  return registrations;
}

export async function getEventsForClass(memberClass: string) {
  const today = getBCToday();
  const whereClause = sql`start_date >= ${today} AND is_active = true AND (member_classes IS NULL OR array_length(member_classes, 1) IS NULL OR ${memberClass} = ANY(member_classes))`;

  const dbEvents = await db.query.events.findMany({
    where: whereClause,
    orderBy: [desc(events.startDate)],
    with: {
      details: true,
      registrations: true,
    },
  });

  return dbEvents.map((event) => {
    // Count actual participants: 1 (captain) + team members + fills
    const activeRegistrations = event.registrations?.filter(
      (reg) => reg.status === "APPROVED" || reg.status === "PENDING"
    ) || [];

    const registrationsCount = activeRegistrations.reduce((sum, reg) => {
      const teamMembersCount = reg.teamMemberIds?.length || 0;
      const fillsCount = Array.isArray(reg.fills) ? reg.fills.length : 0;
      return sum + 1 + teamMembersCount + fillsCount;
    }, 0);

    const pendingRegistrationsCount = event.registrations?.filter(
      (reg) => reg.status === "PENDING"
    ).length || 0;

    return {
      ...event,
      eventType: event.eventType as EventType,
      registrationsCount,
      pendingRegistrationsCount,
    } as Event;
  });
}

// Get member's registration for a specific event with team member details
export async function getMemberRegistrationForEvent(
  eventId: number,
  memberId: number,
) {
  const registration = await db.query.eventRegistrations.findFirst({
    where: and(
      eq(eventRegistrations.eventId, eventId),
      or(
        eq(eventRegistrations.memberId, memberId),
        sql`${memberId} = ANY(team_member_ids)`,
      ),
    ),
    with: {
      member: true,
    },
  });

  if (!registration) return null;

  // Fetch team member details if they exist
  let teamMembers: Awaited<ReturnType<typeof db.query.members.findMany>> = [];
  if (registration.teamMemberIds && registration.teamMemberIds.length > 0) {
    const teamMemberDetails = await db.query.members.findMany({
      where: sql.raw(`id = ANY(ARRAY[${registration.teamMemberIds.join(',')}])`),
    });
    teamMembers = teamMemberDetails;
  }

  return {
    ...registration,
    teamMembers,
  };
}
