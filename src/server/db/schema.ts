// Barrel export for all schema files
// Relations are defined separately in relations.ts to avoid triggering relation evaluation during prerendering

// Table and type exports from domain-specific schemas
export * from "./schema/teesheetConfigs.schema";
export * from "./schema/lottery";
export * from "./schema/fills.schema";
export * from "./schema/core/members.schema";
export * from "./schema/core/guests.schema";
export * from "./schema/booking/timeblocks.schema";
export * from "./schema/booking/members-booking.schema";
export * from "./schema/billing/charges.schema";
export * from "./schema/restrictions/restrictions.schema";
export * from "./schema/events/events.schema";
export * from "./schema/events/event-registrations.schema";
export * from "./schema/misc/course-info.schema";

// Re-export relation types from relations.ts
export type {
  TimeBlockWithRelations,
  TimeBlockMemberWithMember,
  TimeBlockGuestWithGuest,
} from "./relations";
