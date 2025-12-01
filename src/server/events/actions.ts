"use server";

import { db } from "~/server/db";
import { events, eventRegistrations, eventDetails, members } from "~/server/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { z } from "zod";

// Validation schema for event
const eventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  eventType: z.string().min(1, "Event type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  requiresApproval: z.boolean().default(false),
  registrationDeadline: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  memberClasses: z.array(z.string()).default([]),
  teamSize: z.number().int().positive().default(1),
  guestsAllowed: z.boolean().default(false),
});

// Validation schema for event details
const eventDetailsSchema = z.object({
  format: z.string().optional().nullable(),
  rules: z.string().optional().nullable(),
  prizes: z.string().optional().nullable(),
  entryFee: z.number().nonnegative().optional().nullable(),
  additionalInfo: z.string().optional().nullable(),
});

// Create a new event
export async function createEvent(formData: {
  name: string;
  description: string;
  eventType: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  capacity?: number;
  requiresApproval?: boolean;
  registrationDeadline?: string;
  isActive?: boolean;
  memberClasses?: string[];
  teamSize?: number;
  guestsAllowed?: boolean;
  // Event details
  format?: string;
  rules?: string;
  prizes?: string;
  entryFee?: number;
  additionalInfo?: string;
}) {
  try {
    // Parse and validate event data
    const eventData = eventSchema.parse({
      name: formData.name,
      description: formData.description,
      eventType: formData.eventType,
      startDate: formData.startDate,
      endDate: formData.endDate,
      startTime: formData.startTime || null,
      endTime: formData.endTime || null,
      location: formData.location || null,
      capacity: formData.capacity || null,
      requiresApproval: formData.requiresApproval || false,
      registrationDeadline: formData.registrationDeadline || null,
      isActive: formData.isActive ?? true,
      memberClasses: formData.memberClasses || [],
      teamSize: formData.teamSize || 1,
      guestsAllowed: formData.guestsAllowed || false,
    });

    // Insert event
    const result = await db
      .insert(events)
      .values({
        name: eventData.name,
        description: eventData.description,
        eventType: eventData.eventType,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        startTime: eventData.startTime || undefined,
        endTime: eventData.endTime || undefined,
        location: eventData.location || undefined,
        capacity: eventData.capacity || undefined,
        requiresApproval: eventData.requiresApproval,
        registrationDeadline: eventData.registrationDeadline
          ? eventData.registrationDeadline
          : undefined,
        isActive: eventData.isActive,
        memberClasses: eventData.memberClasses,
        teamSize: eventData.teamSize,
        guestsAllowed: eventData.guestsAllowed,
      })
      .returning();

    const newEvent = result[0];
    if (!newEvent) {
      throw new Error("Failed to create event - no event returned");
    }

    // Insert event details if available
    if (
      formData.format ||
      formData.rules ||
      formData.prizes ||
      formData.entryFee ||
      formData.additionalInfo
    ) {
      const detailsData = eventDetailsSchema.parse({
        format: formData.format || null,
        rules: formData.rules || null,
        prizes: formData.prizes || null,
        entryFee: formData.entryFee || null,
        additionalInfo: formData.additionalInfo || null,
      });

      await db.insert(eventDetails).values({
        eventId: newEvent.id,
        format: detailsData.format || undefined,
        rules: detailsData.rules || undefined,
        prizes: detailsData.prizes || undefined,
        entryFee: detailsData.entryFee || undefined,
        additionalInfo: detailsData.additionalInfo || undefined,
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
export async function updateEvent(
  eventId: number,
  formData: {
    name: string;
    description: string;
    eventType: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    capacity?: number;
    requiresApproval?: boolean;
    registrationDeadline?: string;
    isActive?: boolean;
    memberClasses?: string[];
    teamSize?: number;
    guestsAllowed?: boolean;
    // Event details
    format?: string;
    rules?: string;
    prizes?: string;
    entryFee?: number;
    additionalInfo?: string;
  },
) {
  try {
    // Parse and validate event data
    const eventData = eventSchema.parse({
      name: formData.name,
      description: formData.description,
      eventType: formData.eventType,
      startDate: formData.startDate,
      endDate: formData.endDate,
      startTime: formData.startTime || null,
      endTime: formData.endTime || null,
      location: formData.location || null,
      capacity: formData.capacity || null,
      requiresApproval: formData.requiresApproval || false,
      registrationDeadline: formData.registrationDeadline || null,
      isActive: formData.isActive ?? true,
      memberClasses: formData.memberClasses || [],
      teamSize: formData.teamSize || 1,
      guestsAllowed: formData.guestsAllowed || false,
    });

    // Update event
    await db
      .update(events)
      .set({
        name: eventData.name,
        description: eventData.description,
        eventType: eventData.eventType,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        startTime: eventData.startTime || undefined,
        endTime: eventData.endTime || undefined,
        location: eventData.location || undefined,
        capacity: eventData.capacity || undefined,
        requiresApproval: eventData.requiresApproval,
        registrationDeadline: eventData.registrationDeadline || undefined,
        isActive: eventData.isActive,
        memberClasses: eventData.memberClasses,
        teamSize: eventData.teamSize,
        guestsAllowed: eventData.guestsAllowed,
      })
      .where(eq(events.id, eventId));

    // Check if event details exist
    const existingDetails = await db.query.eventDetails.findFirst({
      where: eq(eventDetails.eventId, eventId),
    });

    // Parse details data
    const detailsData = eventDetailsSchema.parse({
      format: formData.format || null,
      rules: formData.rules || null,
      prizes: formData.prizes || null,
      entryFee: formData.entryFee || null,
      additionalInfo: formData.additionalInfo || null,
    });

    // Only include fields that have values
    const detailsToUpsert: any = {};
    if (detailsData.format !== null)
      detailsToUpsert.format = detailsData.format || undefined;
    if (detailsData.rules !== null)
      detailsToUpsert.rules = detailsData.rules || undefined;
    if (detailsData.prizes !== null)
      detailsToUpsert.prizes = detailsData.prizes || undefined;
    if (detailsData.entryFee !== null)
      detailsToUpsert.entryFee = detailsData.entryFee || undefined;
    if (detailsData.additionalInfo !== null)
      detailsToUpsert.additionalInfo = detailsData.additionalInfo || undefined;

    // Update or insert details only if there are values to set
    if (Object.keys(detailsToUpsert).length > 0) {
      if (existingDetails) {
        await db
          .update(eventDetails)
          .set(detailsToUpsert)
          .where(eq(eventDetails.eventId, eventId));
      } else {
        await db.insert(eventDetails).values({
          eventId,
          ...detailsToUpsert,
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
