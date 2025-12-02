// Relation definitions for all schema tables
// Kept separate from schema.ts to avoid triggering relation evaluation during prerendering

import { relations } from "drizzle-orm";
import { members, memberClasses, type Member } from "./schema/core/members.schema";
import { guests, type Guest } from "./schema/core/guests.schema";
import {
  timeBlocks,
  teesheets,
  paceOfPlay,
  TimeBlockInsert,
  PaceOfPlay,
} from "./schema/booking/timeblocks.schema";
import {
  timeBlockMembers,
  timeBlockGuests,
  TimeBlockMember,
  TimeBlockGuest,
} from "./schema/booking/members-booking.schema";
import { eventRegistrations } from "./schema/events/event-registrations.schema";
import {
  powerCartCharges,
  generalCharges,
} from "./schema/billing/charges.schema";
import { events, eventDetails } from "./schema/events/events.schema";
import {
  timeblockOverrides,
  timeblockRestrictions,
} from "./schema/restrictions/restrictions.schema";
import { teesheetConfigs } from "./schema/teesheetConfigs.schema";
import { fills, type Fill } from "./schema/fills.schema";
import {
  lotteryEntries,
  memberFairnessScores,
  memberSpeedProfiles,
} from "./schema/lottery";

// Cross-domain relations (defined here to avoid circular imports)

// MemberClasses Relations
export const memberClassesRelations = relations(memberClasses, ({ many }) => ({
  members: many(members),
}));

// Members Relations
export const membersRelations = relations(members, ({ many, one }) => ({
  memberClass: one(memberClasses, {
    fields: [members.classId],
    references: [memberClasses.id],
  }),
  timeBlockMembers: many(timeBlockMembers),
  eventRegistrations: many(eventRegistrations),
  powerCartCharges: many(powerCartCharges, {
    relationName: "memberPowerCartCharges",
  }),
  splitPowerCartCharges: many(powerCartCharges, {
    relationName: "memberSplitCharges",
  }),
  generalCharges: many(generalCharges, {
    relationName: "memberGeneralCharges",
  }),
  sponsoredCharges: many(generalCharges, {
    relationName: "memberSponsoredCharges",
  }),
  lotteryEntries: many(lotteryEntries, {
    relationName: "memberLotteryEntries",
  }),
}));

// Guests Relations
export const guestsRelations = relations(guests, ({ many }) => ({
  timeBlockGuests: many(timeBlockGuests),
}));

// Teesheets Relations
export const teesheetsRelations = relations(teesheets, ({ many, one }) => ({
  timeBlocks: many(timeBlocks),
  config: one(teesheetConfigs, {
    fields: [teesheets.configId],
    references: [teesheetConfigs.id],
  }),
}));

// TimeBlocks Relations
export const timeBlocksRelations = relations(timeBlocks, ({ many, one }) => ({
  timeBlockMembers: many(timeBlockMembers),
  timeBlockGuests: many(timeBlockGuests),
  paceOfPlay: one(paceOfPlay, {
    fields: [timeBlocks.id],
    references: [paceOfPlay.timeBlockId],
  }),
  teesheet: one(teesheets, {
    fields: [timeBlocks.teesheetId],
    references: [teesheets.id],
  }),
  fills: many(fills, {
    relationName: "timeblockFills",
  }),
}));

// PaceOfPlay Relations
export const paceOfPlayRelations = relations(paceOfPlay, ({ one }) => ({
  timeBlock: one(timeBlocks, {
    fields: [paceOfPlay.timeBlockId],
    references: [timeBlocks.id],
  }),
}));

// TimeBlockMembers Relations
export const timeBlockMembersRelations = relations(
  timeBlockMembers,
  ({ one }) => ({
    timeBlock: one(timeBlocks, {
      fields: [timeBlockMembers.timeBlockId],
      references: [timeBlocks.id],
    }),
    member: one(members, {
      fields: [timeBlockMembers.memberId],
      references: [members.id],
    }),
  }),
);

// TimeBlockGuests Relations
export const timeBlockGuestsRelations = relations(
  timeBlockGuests,
  ({ one }) => ({
    guest: one(guests, {
      fields: [timeBlockGuests.guestId],
      references: [guests.id],
    }),
    timeBlock: one(timeBlocks, {
      fields: [timeBlockGuests.timeBlockId],
      references: [timeBlocks.id],
    }),
    invitedByMember: one(members, {
      fields: [timeBlockGuests.invitedByMemberId],
      references: [members.id],
    }),
  }),
);

// Charges Relations
export const powerCartChargesRelations = relations(
  powerCartCharges,
  ({ one }) => ({
    member: one(members, {
      fields: [powerCartCharges.memberId],
      references: [members.id],
      relationName: "memberPowerCartCharges",
    }),
    guest: one(guests, {
      fields: [powerCartCharges.guestId],
      references: [guests.id],
    }),
    splitWithMember: one(members, {
      fields: [powerCartCharges.splitWithMemberId],
      references: [members.id],
      relationName: "memberSplitCharges",
    }),
  }),
);

export const generalChargesRelations = relations(generalCharges, ({ one }) => ({
  member: one(members, {
    fields: [generalCharges.memberId],
    references: [members.id],
    relationName: "memberGeneralCharges",
  }),
  guest: one(guests, {
    fields: [generalCharges.guestId],
    references: [guests.id],
  }),
  sponsorMember: one(members, {
    fields: [generalCharges.sponsorMemberId],
    references: [members.id],
    relationName: "memberSponsoredCharges",
  }),
}));

// Events Relations
export const eventsRelations = relations(events, ({ many, one }) => ({
  registrations: many(eventRegistrations),
  details: one(eventDetails),
}));

export const eventDetailsRelations = relations(eventDetails, ({ one }) => ({
  event: one(events, {
    fields: [eventDetails.eventId],
    references: [events.id],
  }),
}));

export const eventRegistrationsRelations = relations(
  eventRegistrations,
  ({ one }) => ({
    event: one(events, {
      fields: [eventRegistrations.eventId],
      references: [events.id],
    }),
    member: one(members, {
      fields: [eventRegistrations.memberId],
      references: [members.id],
    }),
  }),
);

// Restrictions Relations
export const timeblockRestrictionsRelations = relations(
  timeblockRestrictions,
  ({ many }) => ({
    overrides: many(timeblockOverrides),
  }),
);

export const timeblockOverridesRelations = relations(
  timeblockOverrides,
  ({ one }) => ({
    restriction: one(timeblockRestrictions, {
      fields: [timeblockOverrides.restrictionId],
      references: [timeblockRestrictions.id],
    }),
    timeBlock: one(timeBlocks, {
      fields: [timeblockOverrides.timeBlockId],
      references: [timeBlocks.id],
    }),
    member: one(members, {
      fields: [timeblockOverrides.memberId],
      references: [members.id],
    }),
    guest: one(guests, {
      fields: [timeblockOverrides.guestId],
      references: [guests.id],
    }),
  }),
);

// Fills Relations
export const fillsRelations = relations(fills, ({ one }) => ({
  lotteryEntry: one(lotteryEntries, {
    fields: [fills.relatedId],
    references: [lotteryEntries.id],
    relationName: "lotteryEntryFills",
  }),
  timeBlock: one(timeBlocks, {
    fields: [fills.relatedId],
    references: [timeBlocks.id],
    relationName: "timeblockFills",
  }),
}));

// Lottery Relations
export const lotteryEntriesRelations = relations(
  lotteryEntries,
  ({ one, many }) => ({
    organizer: one(members, {
      fields: [lotteryEntries.organizerId],
      references: [members.id],
      relationName: "memberLotteryEntries",
    }),
    assignedTimeBlock: one(timeBlocks, {
      fields: [lotteryEntries.assignedTimeBlockId],
      references: [timeBlocks.id],
    }),
    fills: many(fills, {
      relationName: "lotteryEntryFills",
    }),
  }),
);

export const memberFairnessScoresRelations = relations(
  memberFairnessScores,
  ({ one }) => ({
    member: one(members, {
      fields: [memberFairnessScores.memberId],
      references: [members.id],
    }),
  }),
);

export const memberSpeedProfilesRelations = relations(
  memberSpeedProfiles,
  ({ one }) => ({
    member: one(members, {
      fields: [memberSpeedProfiles.memberId],
      references: [members.id],
    }),
  }),
);

// Hydrated types with relations
export type TimeBlockWithRelations = TimeBlockInsert & {
  members: (Member & Pick<TimeBlockMember, "checkedIn" | "checkedInAt"> & { memberClass?: { label: string } | null })[];
  guests: (Guest & { invitedByMemberId: number; invitedByMember?: Member })[];
  fills: Fill[];
  paceOfPlay: PaceOfPlay | null;
};

export type TimeBlockMemberWithMember = TimeBlockMember & {
  member: Member;
};

export type TimeBlockGuestWithGuest = TimeBlockGuest & {
  guest: Guest;
  invitedByMember: Member;
};
