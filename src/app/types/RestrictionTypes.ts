import { z } from "zod";

// Entity types that can have restrictions
export enum RestrictedEntityType {
  CLASS = "CLASS",
  GUEST = "GUEST",
}

// Types of restrictions
export enum RestrictionType {
  TIME = "TIME",
  FREQUENCY = "FREQUENCY",
}

// Base restriction interface
export interface BaseRestriction {
  id: number;
  entityType: RestrictedEntityType;
  entityId: string | null; // classId for "CLASS" type, null for "GUEST"
  restrictionType: RestrictionType;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

// Time restriction specific fields
export interface TimeRestriction extends BaseRestriction {
  restrictionType: RestrictionType.TIME;
  startTime: string; // Format: HH:MM (24h)
  endTime: string; // Format: HH:MM (24h)
  daysOfWeek: number[]; // 0-6 for Sunday-Saturday
}

// Frequency restriction specific fields
export interface FrequencyRestriction extends BaseRestriction {
  restrictionType: RestrictionType.FREQUENCY;
  maxCount: number;
  periodDays: number; // Period in days (30 for monthly)
  applyCharge: boolean;
  chargeAmount: number | null;
}

// Union type for all restrictions
export type Restriction = TimeRestriction | FrequencyRestriction;

// Form values for creating/updating restrictions
export interface RestrictionFormValues {
  name: string;
  description: string;
  entityType: RestrictedEntityType;
  entityId: string | null;
  restrictionType: RestrictionType;
  isActive: boolean;

  // Time restriction fields
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];

  // Frequency restriction fields
  maxCount?: number;
  periodDays?: number;
  applyCharge?: boolean;
  chargeAmount?: number;
}

// Violation represents a broken restriction
export interface RestrictionViolation {
  restrictionId: number;
  restrictionName: string;
  restrictionDescription: string;
  restrictionCategory: "MEMBER_CLASS" | "GUEST" | "LOTTERY";
  entityType: RestrictedEntityType;
  entityId: string | null;
  violationType: RestrictionType;
  message: string;
  canOverride: boolean;
}

// Zod schema for validation
export const restrictionFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: z.string(),
    entityType: z.nativeEnum(RestrictedEntityType),
    entityId: z.string().nullable(),
    restrictionType: z.nativeEnum(RestrictionType),
    isActive: z.boolean(),

    // Time restriction fields - conditionally required
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),

    // Frequency restriction fields - conditionally required
    maxCount: z.number().positive().optional(),
    periodDays: z.number().positive().optional(),
    applyCharge: z.boolean().optional(),
    chargeAmount: z.number().optional(),
  })
  .refine(
    (data) => {
      if (data.restrictionType === RestrictionType.TIME) {
        return !!data.startTime && !!data.endTime && !!data.daysOfWeek?.length;
      }
      return true;
    },
    {
      message:
        "Time restrictions require start time, end time, and days of week",
      path: ["restrictionType"],
    },
  )
  .refine(
    (data) => {
      if (data.restrictionType === RestrictionType.FREQUENCY) {
        return !!data.maxCount && !!data.periodDays;
      }
      return true;
    },
    {
      message: "Frequency restrictions require max count and period days",
      path: ["restrictionType"],
    },
  );
