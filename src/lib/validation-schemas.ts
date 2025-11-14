/**

 * Input Validation Schemas

 *

 * Centralized Zod schemas for validating inputs to server actions and API routes.

 * Provides type-safe validation with helpful error messages.

 */

 

import { z } from "zod";

 

// ============================================================================

// COMMON SCHEMAS

// ============================================================================

 

/**

 * Positive integer schema

 */

export const positiveIntSchema = z.number().int().positive({

  message: "Must be a positive integer",

});

 

/**

 * Non-negative integer schema (allows 0)

 */

export const nonNegativeIntSchema = z.number().int().min(0, {

  message: "Must be a non-negative integer",

});

 

/**

 * String ID schema (non-empty string)

 */

export const stringIdSchema = z.string().min(1, {

  message: "ID cannot be empty",

});

 

/**

 * Date string schema (YYYY-MM-DD format)

 */

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {

  message: "Date must be in YYYY-MM-DD format",

});

 

/**

 * Time string schema (HH:MM format, 24-hour)

 */

export const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {

  message: "Time must be in HH:MM format (24-hour)",

});

 

/**

 * Email schema

 */

export const emailSchema = z.string().email({

  message: "Invalid email address",

});

 

/**

 * Phone number schema (flexible)

 */

export const phoneSchema = z.string().regex(/^[\d\s\-\(\)\+]+$/, {

  message: "Invalid phone number format",

});

 

// ============================================================================

// MEMBER SCHEMAS

// ============================================================================

 

/**

 * Member ID schema

 */

export const memberIdSchema = positiveIntSchema;

 

/**

 * Member name schema

 */

export const memberNameSchema = z.object({

  firstName: z.string().min(1, "First name is required").max(100),

  lastName: z.string().min(1, "Last name is required").max(100),

});

 

/**

 * Member status schema

 */

export const memberStatusSchema = z.enum(["active", "inactive", "suspended"], {

  errorMap: () => ({ message: "Invalid member status" }),

});

 

/**

 * Member class schema

 */

export const memberClassSchema = z.string().min(1, "Member class is required");

 

// ============================================================================

// TEESHEET SCHEMAS

// ============================================================================

 

/**

 * Teesheet ID schema

 */

export const teesheetIdSchema = positiveIntSchema;

 

/**

 * Time block ID schema

 */

export const timeBlockIdSchema = positiveIntSchema;

 

/**

 * Time block status schema

 */

export const timeBlockStatusSchema = z.enum(

  ["available", "booked", "blocked", "lottery"],

  {

    errorMap: () => ({ message: "Invalid time block status" }),

  }

);

 

/**

 * Booking type schema

 */

export const bookingTypeSchema = z.enum(

  ["regular", "guest", "event", "staff"],

  {

    errorMap: () => ({ message: "Invalid booking type" }),

  }

);

 

/**

 * Time block create/update schema

 */

export const timeBlockSchema = z.object({

  startTime: timeStringSchema,

  endTime: timeStringSchema,

  status: timeBlockStatusSchema.optional(),

  maxPlayers: z.number().int().min(1).max(4).optional(),

});

 

// ============================================================================

// LOTTERY SCHEMAS

// ============================================================================

 

/**

 * Lottery entry ID schema

 */

export const lotteryEntryIdSchema = positiveIntSchema;

 

/**

 * Lottery status schema

 */

export const lotteryStatusSchema = z.enum(

  ["pending", "confirmed", "declined", "expired"],

  {

    errorMap: () => ({ message: "Invalid lottery status" }),

  }

);

 

/**

 * Lottery priority schema

 */

export const lotteryPrioritySchema = z.number().int().min(1).max(100);

 

// ============================================================================

// CHARGE SCHEMAS

// ============================================================================

 

/**

 * Charge ID schema

 */

export const chargeIdSchema = positiveIntSchema;

 

/**

 * Charge amount schema (positive, up to 2 decimal places)

 */

export const chargeAmountSchema = z

  .number()

  .positive("Amount must be positive")

  .multipleOf(0.01, "Amount can have at most 2 decimal places");

 

/**

 * Charge description schema

 */

export const chargeDescriptionSchema = z

  .string()

  .min(1, "Description is required")

  .max(500, "Description is too long");

 

/**

 * Charge status schema

 */

export const chargeStatusSchema = z.enum(["pending", "paid", "cancelled"], {

  errorMap: () => ({ message: "Invalid charge status" }),

});

 

// ============================================================================

// GUEST SCHEMAS

// ============================================================================

 

/**

 * Guest ID schema

 */

export const guestIdSchema = positiveIntSchema;

 

/**

 * Guest name schema

 */

export const guestNameSchema = z

  .string()

  .min(1, "Guest name is required")

  .max(100, "Guest name is too long");

 

// ============================================================================

// PAGINATION SCHEMAS

// ============================================================================

 

/**

 * Pagination schema

 */

export const paginationSchema = z.object({

  page: z.number().int().min(1).default(1),

  pageSize: z.number().int().min(1).max(100).default(20),

});

 

/**

 * Search query schema

 */

export const searchQuerySchema = z.object({

  query: z.string().max(200),

  ...paginationSchema.shape,

});

 

// ============================================================================

// DATE RANGE SCHEMAS

// ============================================================================

 

/**

 * Date range schema

 */

export const dateRangeSchema = z

  .object({

    startDate: dateStringSchema,

    endDate: dateStringSchema,

  })

  .refine((data) => data.startDate <= data.endDate, {

    message: "Start date must be before or equal to end date",

    path: ["startDate"],

  });

 

// ============================================================================

// COMPOSITE SCHEMAS

// ============================================================================

 

/**

 * Add member to time block schema

 */

export const addMemberToTimeBlockSchema = z.object({

  timeBlockId: timeBlockIdSchema,

  memberId: memberIdSchema,

});

 

/**

 * Add guest to time block schema

 */

export const addGuestToTimeBlockSchema = z.object({

  timeBlockId: timeBlockIdSchema,

  guestName: guestNameSchema,

});

 

/**

 * Create charge schema

 */

export const createChargeSchema = z.object({

  memberId: memberIdSchema,

  amount: chargeAmountSchema,

  description: chargeDescriptionSchema,

  chargeDate: dateStringSchema.optional(),

});

 

/**

 * Update member schema

 */

export const updateMemberSchema = z.object({

  id: memberIdSchema,

  firstName: z.string().min(1).max(100).optional(),

  lastName: z.string().min(1).max(100).optional(),

  email: emailSchema.optional(),

  phone: phoneSchema.optional(),

  status: memberStatusSchema.optional(),

  memberClass: memberClassSchema.optional(),

});

 

/**

 * Create lottery entry schema

 */

export const createLotteryEntrySchema = z.object({

  memberId: memberIdSchema,

  teesheetId: teesheetIdSchema,

  priority: lotteryPrioritySchema.optional(),

});

 

// ============================================================================

// VALIDATION HELPERS

// ============================================================================

 

/**

 * Validate input against a schema

 * Returns validated data or throws error with helpful message

 */

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {

  try {

    return schema.parse(data);

  } catch (error) {

    if (error instanceof z.ZodError) {

      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);

      throw new Error(`Validation failed: ${messages.join(", ")}`);

    }

    throw error;

  }

}

 

/**

 * Validate input and return result object

 * Non-throwing version

 */

export function safeValidateInput<T>(

  schema: z.ZodSchema<T>,

  data: unknown

): { success: true; data: T } | { success: false; error: string } {

  try {

    const validated = schema.parse(data);

    return { success: true, data: validated };

  } catch (error) {

    if (error instanceof z.ZodError) {

      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);

      return {

        success: false,

        error: `Validation failed: ${messages.join(", ")}`,

      };

    }

    return {

      success: false,

      error: "Validation failed: Unknown error",

    };

  }

}

 

/**

 * Create a validation error response

 */

export function createValidationError(error: z.ZodError) {

  const errors = error.errors.map((e) => ({

    field: e.path.join("."),

    message: e.message,

  }));

 

  return {

    success: false,

    error: "Validation failed",

    code: "VALIDATION_ERROR",

    status: 400,

    errors,

  };

}

 

// ============================================================================

// CUSTOM VALIDATORS

// ============================================================================

 

/**
 * Validate that a date is not in the past
 */
export function validateFutureDate(date: string): boolean {
  // Parse the date string as YYYY-MM-DD and create a local date at midnight
  const [year, month, day] = date.split("-").map(Number);
  const inputDate = new Date(year!, month! - 1, day!);
  const today = new Date();
  inputDate.setHours(0, 0, 0, 0);
  return inputDate >= today;
}

 

/**

 * Validate that a date is within a certain range from today

 */

export function validateDateRange(

  date: string,

  maxDaysAhead: number

): boolean {

  const inputDate = new Date(date);

  const today = new Date();

  today.setHours(0, 0, 0, 0);

 

  const maxDate = new Date(today);

  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

 

  return inputDate >= today && inputDate <= maxDate;

}

 

/**

 * Validate time is within business hours

 */

export function validateBusinessHours(

  time: string,

  openTime: string = "06:00",

  closeTime: string = "20:00"

): boolean {

  return time >= openTime && time <= closeTime;

}