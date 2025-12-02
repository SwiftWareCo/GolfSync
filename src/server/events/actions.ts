"use server";

import { db } from "~/server/db";
import { events, eventRegistrations, eventDetails, members } from "~/server/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuthentication } from "~/lib/auth-server";
import type { EventFormValues } from "~/components/events/admin/EventForm";

// Create a new event
export async function createEvent(data: EventFormValues) {
  try {
    await requireAdmin();

    const result = await db
      .insert(events)
      .values({
        name: data.name,
        description: data.description,
        eventType: data.eventType,
        startDate: data.startDate,
        endDate: data.endDate,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        capacity: data.capacity,
        requiresApproval: data.requiresApproval,
        registrationDeadline: data.registrationDeadline,
        isActive: data.isActive,
        memberClassIds: data.memberClassIds,
        teamSize: data.teamSize,
        guestsAllowed: data.guestsAllowed,
      })
      .returning();

    const newEvent = result[0];
    if (!newEvent) {
      throw new Error("Failed to create event");
    }

    // Insert event details if any fields have values
    if (
      data.format ||
      data.rules ||
      data.prizes ||
      data.entryFee ||
      data.additionalInfo
    ) {
      await db.insert(eventDetails).values({
        eventId: newEvent.id,
        format: data.format,
        rules: data.rules,
        prizes: data.prizes,
        entryFee: data.entryFee,
        additionalInfo: data.additionalInfo,
      });
    }

    revalidatePath("/admin/events");
    revalidatePath("/members/events");
    return { success: true, event: newEvent };
  } catch (error) {
    console.error("Error creating event:", error);
    return { success: false, error: "Failed to create event" };
  }
}

// Update an existing event
export async function updateEvent(eventId: number, data: EventFormValues) {
  try {
    await requireAdmin();

    await db
      .update(events)
      .set({
        name: data.name,
        description: data.description,
        eventType: data.eventType,
        startDate: data.startDate,
        endDate: data.endDate,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        capacity: data.capacity,
        requiresApproval: data.requiresApproval,
        registrationDeadline: data.registrationDeadline,
        isActive: data.isActive,
        memberClassIds: data.memberClassIds,
        teamSize: data.teamSize,
        guestsAllowed: data.guestsAllowed,
      })
      .where(eq(events.id, eventId));

    // Check if event details exist
    const existingDetails = await db.query.eventDetails.findFirst({
      where: eq(eventDetails.eventId, eventId),
    });

    // Update or insert details only if any fields have values
    if (
      data.format ||
      data.rules ||
      data.prizes ||
      data.entryFee ||
      data.additionalInfo
    ) {
      if (existingDetails) {
        await db
          .update(eventDetails)
          .set({
            format: data.format,
            rules: data.rules,
            prizes: data.prizes,
            entryFee: data.entryFee,
            additionalInfo: data.additionalInfo,
          })
          .where(eq(eventDetails.eventId, eventId));
      } else {
        await db.insert(eventDetails).values({
          eventId,
          format: data.format,
          rules: data.rules,
          prizes: data.prizes,
          entryFee: data.entryFee,
          additionalInfo: data.additionalInfo,
        });
      }
    } else if (existingDetails) {
      // If no details provided but details exist, delete them
      await db.delete(eventDetails).where(eq(eventDetails.eventId, eventId));
    }

    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath("/members/events");
    revalidatePath(`/members/events/${eventId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating event:", error);
    return { success: false, error: "Failed to update event" };
  }
}

// Delete an event
export async function deleteEvent(eventId: number) {
  try {
    await requireAdmin();

    await db.delete(events).where(eq(events.id, eventId));

    revalidatePath("/admin/events");
    revalidatePath("/members/events");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { success: false, error: "Failed to delete event" };
  }
}

// Check if members are already registered for an event
export async function checkMembersRegistrationStatus(
  eventId: number,
  memberIds: number[]
) {
  try {
    const registeredMembers: number[] = [];

    for (const memberId of memberIds) {
      const existingRegistration = await db.query.eventRegistrations.findFirst({
        where: and(
          eq(eventRegistrations.eventId, eventId),
          or(
            eq(eventRegistrations.memberId, memberId),
            sql`${memberId} = ANY(team_member_ids)`
          )
        ),
      });

      if (existingRegistration) {
        registeredMembers.push(memberId);
      }
    }

    return { success: true, registeredMembers };
  } catch (error) {
    console.error("Error checking member registration status:", error);
    return { success: false, registeredMembers: [] };
  }
}

// Register a member for an event
export async function registerForEvent(
  eventId: number,
  memberId: number,
  notes?: string,
  teamMemberIds?: number[],
  fills?: Array<{fillType: string; customName?: string}>,
) {
  try {
    await requireAuthentication();
    // Check if captain is already registered (as captain or team member)
    const captainExistingRegistration = await db.query.eventRegistrations.findFirst({
      where: and(
        eq(eventRegistrations.eventId, eventId),
        or(
          eq(eventRegistrations.memberId, memberId),
          sql`${memberId} = ANY(team_member_ids)`
        )
      ),
    });

    if (captainExistingRegistration) {
      return {
        success: false,
        error: "You are already registered for this event",
      };
    }

    // Check if any team members are already registered (as captain or team member)
    if (teamMemberIds && teamMemberIds.length > 0) {
      for (const teamMemberId of teamMemberIds) {
        const memberExistingRegistration = await db.query.eventRegistrations.findFirst({
          where: and(
            eq(eventRegistrations.eventId, eventId),
            or(
              eq(eventRegistrations.memberId, teamMemberId),
              sql`${teamMemberId} = ANY(team_member_ids)`
            )
          ),
        });

        if (memberExistingRegistration) {
          // Get member name for better error message
          const member = await db.query.members.findFirst({
            where: eq(members.id, teamMemberId),
          });
          return {
            success: false,
            error: `${member?.firstName} ${member?.lastName} is already registered for this event`
          };
        }
      }
    }

    // Get the event to check requirements
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    // Validate team size if event requires teams
    if (event.teamSize > 1) {
      const totalTeamSize = 1 + (teamMemberIds?.length || 0) + (fills?.length || 0);
      if (totalTeamSize !== event.teamSize) {
        return {
          success: false,
          error: `Team must have exactly ${event.teamSize} players`,
        };
      }

      // Validate fills only allowed if guests allowed
      if (fills && fills.length > 0 && !event.guestsAllowed) {
        return {
          success: false,
          error: "Guests are not allowed for this event",
        };
      }
    }

    // Set default status based on whether approval is required
    const defaultStatus = event.requiresApproval ? "PENDING" : "APPROVED";

    // Insert registration
    await db.insert(eventRegistrations).values({
      eventId,
      memberId,
      status: defaultStatus,
      notes: notes || undefined,
      teamMemberIds: teamMemberIds || undefined,
      fills: fills as any || undefined,
      isTeamCaptain: true,
    });

    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/members/events/${eventId}`);
    revalidatePath(`/events`);
    revalidatePath(`/members`);
    return { success: true };
  } catch (error) {
    console.error("Error registering for event:", error);
    return { success: false, error: "Failed to register for event" };
  }
}

// Cancel a registration
export async function cancelRegistration(eventId: number, memberId: number) {
  try {
    await db
      .delete(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId));

    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/members/events/${eventId}`);
    return { success: true };
  } catch (error) {
    console.error("Error canceling registration:", error);
    return { success: false, error: "Failed to cancel registration" };
  }
}

// Update registration status (for admin approval)
export async function updateRegistrationStatus(
  registrationId: number,
  status: "PENDING" | "APPROVED" | "REJECTED",
  notes?: string,
) {
  try {
    await requireAdmin();
    await db
      .update(eventRegistrations)
      .set({
        status,
        notes: notes || undefined,
      })
      .where(eq(eventRegistrations.id, registrationId));

    revalidatePath("/admin/events");
    return { success: true };
  } catch (error) {
    console.error("Error updating registration status:", error);
    return { success: false, error: "Failed to update registration status" };
  }
}

// Update event registration details (team members and fills)
export async function updateEventRegistrationDetails(
  registrationId: number,
  details: {
    teamMemberIds?: number[];
    fills?: Array<{ fillType: string; customName?: string }>;
  }
) {
  try {
    await requireAdmin();
    // Get the current registration to check eventId and captain
    const currentRegistration = await db.query.eventRegistrations.findFirst({
      where: eq(eventRegistrations.id, registrationId),
    });

    if (!currentRegistration) {
      return { success: false, error: "Registration not found" };
    }

    // Check if any team members are already registered in OTHER registrations (as captain or team member)
    if (details.teamMemberIds && details.teamMemberIds.length > 0) {
      for (const memberId of details.teamMemberIds) {
        const memberExistingRegistration = await db.query.eventRegistrations.findFirst({
          where: and(
            eq(eventRegistrations.eventId, currentRegistration.eventId),
            // Exclude the current registration we're editing
            sql`id != ${registrationId}`,
            or(
              eq(eventRegistrations.memberId, memberId),
              sql`${memberId} = ANY(team_member_ids)`
            )
          ),
        });

        if (memberExistingRegistration) {
          // Get member name for better error message
          const member = await db.query.members.findFirst({
            where: eq(members.id, memberId),
          });
          return {
            success: false,
            error: `${member?.firstName} ${member?.lastName} is already registered for this event`
          };
        }
      }
    }

    await db
      .update(eventRegistrations)
      .set({
        teamMemberIds: details.teamMemberIds || [],
        fills: details.fills || [],
      })
      .where(eq(eventRegistrations.id, registrationId));

    revalidatePath("/admin/events");
    revalidatePath("/members/events");
    return { success: true };
  } catch (error) {
    console.error("Error updating registration details:", error);
    return { success: false, error: "Failed to update registration details" };
  }
}

// Create event registration as admin
export async function createEventRegistrationAsAdmin(
  eventId: number,
  details: {
    captainId: number;
    teamMemberIds?: number[];
    fills?: Array<{ fillType: string; customName?: string }>;
    notes?: string;
    status: "APPROVED" | "PENDING" | "REJECTED";
  }
) {
  try {
    await requireAdmin();
    // Check if captain is already registered (as captain or team member)
    const captainExistingRegistration = await db.query.eventRegistrations.findFirst({
      where: and(
        eq(eventRegistrations.eventId, eventId),
        or(
          eq(eventRegistrations.memberId, details.captainId),
          sql`${details.captainId} = ANY(team_member_ids)`
        )
      ),
    });

    if (captainExistingRegistration) {
      return { success: false, error: "Captain is already registered for this event" };
    }

    // Check if any team members are already registered (as captain or team member)
    if (details.teamMemberIds && details.teamMemberIds.length > 0) {
      for (const memberId of details.teamMemberIds) {
        const memberExistingRegistration = await db.query.eventRegistrations.findFirst({
          where: and(
            eq(eventRegistrations.eventId, eventId),
            or(
              eq(eventRegistrations.memberId, memberId),
              sql`${memberId} = ANY(team_member_ids)`
            )
          ),
        });

        if (memberExistingRegistration) {
          // Get member name for better error message
          const member = await db.query.members.findFirst({
            where: eq(members.id, memberId),
          });
          return {
            success: false,
            error: `${member?.firstName} ${member?.lastName} is already registered for this event`
          };
        }
      }
    }

    // Create the registration
    await db.insert(eventRegistrations).values({
      eventId,
      memberId: details.captainId,
      teamMemberIds: details.teamMemberIds || [],
      fills: details.fills || [],
      notes: details.notes || null,
      status: details.status,
      isTeamCaptain: true,
    });

    revalidatePath("/admin/events");
    revalidatePath("/members/events");
    return { success: true };
  } catch (error) {
    console.error("Error creating registration as admin:", error);
    return { success: false, error: "Failed to create registration" };
  }
}
