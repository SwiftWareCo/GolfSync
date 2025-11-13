/**

 * Tests for Input Validation Schemas

 */

 

import { describe, it, expect } from "vitest";

import {

  positiveIntSchema,

  nonNegativeIntSchema,

  stringIdSchema,

  dateStringSchema,

  timeStringSchema,

  emailSchema,

  phoneSchema,

  memberIdSchema,

  memberStatusSchema,

  timeBlockStatusSchema,

  bookingTypeSchema,

  chargeAmountSchema,

  validateInput,

  safeValidateInput,

  validateFutureDate,

  validateDateRange,

  validateBusinessHours,

  addMemberToTimeBlockSchema,

  createChargeSchema,

  updateMemberSchema,

} from "../validation-schemas";

 

describe("Validation Schemas", () => {

  describe("Basic Schemas", () => {

    describe("positiveIntSchema", () => {

      it("should accept positive integers", () => {

        expect(positiveIntSchema.parse(1)).toBe(1);

        expect(positiveIntSchema.parse(100)).toBe(100);

        expect(positiveIntSchema.parse(999999)).toBe(999999);

      });

 

      it("should reject zero and negative numbers", () => {

        expect(() => positiveIntSchema.parse(0)).toThrow();

        expect(() => positiveIntSchema.parse(-1)).toThrow();

        expect(() => positiveIntSchema.parse(-100)).toThrow();

      });

 

      it("should reject non-integers", () => {

        expect(() => positiveIntSchema.parse(1.5)).toThrow();

        expect(() => positiveIntSchema.parse(3.14)).toThrow();

      });

    });

 

    describe("nonNegativeIntSchema", () => {

      it("should accept zero and positive integers", () => {

        expect(nonNegativeIntSchema.parse(0)).toBe(0);

        expect(nonNegativeIntSchema.parse(1)).toBe(1);

        expect(nonNegativeIntSchema.parse(100)).toBe(100);

      });

 

      it("should reject negative numbers", () => {

        expect(() => nonNegativeIntSchema.parse(-1)).toThrow();

      });

    });

 

    describe("stringIdSchema", () => {

      it("should accept non-empty strings", () => {

        expect(stringIdSchema.parse("abc123")).toBe("abc123");

        expect(stringIdSchema.parse("user_456")).toBe("user_456");

      });

 

      it("should reject empty strings", () => {

        expect(() => stringIdSchema.parse("")).toThrow();

      });

    });

 

    describe("dateStringSchema", () => {

      it("should accept valid YYYY-MM-DD format", () => {

        expect(dateStringSchema.parse("2025-01-15")).toBe("2025-01-15");

        expect(dateStringSchema.parse("2025-12-31")).toBe("2025-12-31");

      });

 

      it("should reject invalid formats", () => {

        expect(() => dateStringSchema.parse("01/15/2025")).toThrow();

        expect(() => dateStringSchema.parse("2025-1-15")).toThrow();

        // Note: dateStringSchema only validates format (YYYY-MM-DD), not validity

        // To validate actual dates, use additional validation or Date parsing

        expect(dateStringSchema.parse("2025-13-01")).toBe("2025-13-01"); // Format is valid

      });

    });

 

    describe("timeStringSchema", () => {

      it("should accept valid HH:MM format", () => {

        expect(timeStringSchema.parse("09:30")).toBe("09:30");

        expect(timeStringSchema.parse("23:59")).toBe("23:59");

        expect(timeStringSchema.parse("00:00")).toBe("00:00");

      });

 

      it("should reject invalid formats", () => {

        expect(() => timeStringSchema.parse("9:30")).toThrow(); // Missing leading zero

        expect(() => timeStringSchema.parse("24:00")).toThrow(); // Invalid hour

        expect(() => timeStringSchema.parse("12:60")).toThrow(); // Invalid minute

      });

    });

 

    describe("emailSchema", () => {

      it("should accept valid emails", () => {

        expect(emailSchema.parse("user@example.com")).toBe("user@example.com");

        expect(emailSchema.parse("test.user@domain.co.uk")).toBe(

          "test.user@domain.co.uk"

        );

      });

 

      it("should reject invalid emails", () => {

        expect(() => emailSchema.parse("notanemail")).toThrow();

        expect(() => emailSchema.parse("@example.com")).toThrow();

        expect(() => emailSchema.parse("user@")).toThrow();

      });

    });

 

    describe("phoneSchema", () => {

      it("should accept valid phone numbers", () => {

        expect(phoneSchema.parse("123-456-7890")).toBe("123-456-7890");

        expect(phoneSchema.parse("+1 (234) 567-8900")).toBe("+1 (234) 567-8900");

        expect(phoneSchema.parse("5551234567")).toBe("5551234567");

      });

 

      it("should reject invalid phone numbers", () => {

        expect(() => phoneSchema.parse("abc-def-ghij")).toThrow();

      });

    });

  });

 

  describe("Enum Schemas", () => {

    describe("memberStatusSchema", () => {

      it("should accept valid statuses", () => {

        expect(memberStatusSchema.parse("active")).toBe("active");

        expect(memberStatusSchema.parse("inactive")).toBe("inactive");

        expect(memberStatusSchema.parse("suspended")).toBe("suspended");

      });

 

      it("should reject invalid statuses", () => {

        expect(() => memberStatusSchema.parse("deleted")).toThrow();

        expect(() => memberStatusSchema.parse("pending")).toThrow();

      });

    });

 

    describe("timeBlockStatusSchema", () => {

      it("should accept valid statuses", () => {

        expect(timeBlockStatusSchema.parse("available")).toBe("available");

        expect(timeBlockStatusSchema.parse("booked")).toBe("booked");

        expect(timeBlockStatusSchema.parse("blocked")).toBe("blocked");

        expect(timeBlockStatusSchema.parse("lottery")).toBe("lottery");

      });

 

      it("should reject invalid statuses", () => {

        expect(() => timeBlockStatusSchema.parse("pending")).toThrow();

      });

    });

 

    describe("bookingTypeSchema", () => {

      it("should accept valid booking types", () => {

        expect(bookingTypeSchema.parse("regular")).toBe("regular");

        expect(bookingTypeSchema.parse("guest")).toBe("guest");

        expect(bookingTypeSchema.parse("event")).toBe("event");

        expect(bookingTypeSchema.parse("staff")).toBe("staff");

      });

 

      it("should reject invalid booking types", () => {

        expect(() => bookingTypeSchema.parse("vip")).toThrow();

      });

    });

  });

 

  describe("Charge Schema", () => {

    describe("chargeAmountSchema", () => {

      it("should accept valid amounts", () => {

        expect(chargeAmountSchema.parse(10.0)).toBe(10.0);

        expect(chargeAmountSchema.parse(99.99)).toBe(99.99);

        expect(chargeAmountSchema.parse(0.01)).toBe(0.01);

      });

 

      it("should reject negative amounts", () => {

        expect(() => chargeAmountSchema.parse(-10.0)).toThrow();

        expect(() => chargeAmountSchema.parse(0)).toThrow();

      });

 

      it("should reject more than 2 decimal places", () => {

        expect(() => chargeAmountSchema.parse(10.123)).toThrow();

      });

    });

  });

 

  describe("Composite Schemas", () => {

    describe("addMemberToTimeBlockSchema", () => {

      it("should accept valid input", () => {

        const input = {

          timeBlockId: 1,

          memberId: 123,

        };

 

        const result = addMemberToTimeBlockSchema.parse(input);

 

        expect(result.timeBlockId).toBe(1);

        expect(result.memberId).toBe(123);

      });

 

      it("should reject invalid timeBlockId", () => {

        const input = {

          timeBlockId: -1,

          memberId: 123,

        };

 

        expect(() => addMemberToTimeBlockSchema.parse(input)).toThrow();

      });

 

      it("should reject invalid memberId", () => {

        const input = {

          timeBlockId: 1,

          memberId: 0,

        };

 

        expect(() => addMemberToTimeBlockSchema.parse(input)).toThrow();

      });

    });

 

    describe("createChargeSchema", () => {

      it("should accept valid charge", () => {

        const input = {

          memberId: 123,

          amount: 50.0,

          description: "Cart rental",

        };

 

        const result = createChargeSchema.parse(input);

 

        expect(result.memberId).toBe(123);

        expect(result.amount).toBe(50.0);

        expect(result.description).toBe("Cart rental");

      });

 

      it("should accept optional chargeDate", () => {

        const input = {

          memberId: 123,

          amount: 50.0,

          description: "Cart rental",

          chargeDate: "2025-11-15",

        };

 

        const result = createChargeSchema.parse(input);

 

        expect(result.chargeDate).toBe("2025-11-15");

      });

 

      it("should reject invalid amount", () => {

        const input = {

          memberId: 123,

          amount: -50.0,

          description: "Cart rental",

        };

 

        expect(() => createChargeSchema.parse(input)).toThrow();

      });

 

      it("should reject empty description", () => {

        const input = {

          memberId: 123,

          amount: 50.0,

          description: "",

        };

 

        expect(() => createChargeSchema.parse(input)).toThrow();

      });

    });

 

    describe("updateMemberSchema", () => {

      it("should accept partial updates", () => {

        const input = {

          id: 123,

          firstName: "John",

        };

 

        const result = updateMemberSchema.parse(input);

 

        expect(result.id).toBe(123);

        expect(result.firstName).toBe("John");

        expect(result.lastName).toBeUndefined();

      });

 

      it("should accept full updates", () => {

        const input = {

          id: 123,

          firstName: "John",

          lastName: "Doe",

          email: "john@example.com",

          phone: "123-456-7890",

          status: "active" as const,

        };

 

        const result = updateMemberSchema.parse(input);

 

        expect(result.id).toBe(123);

        expect(result.firstName).toBe("John");

        expect(result.lastName).toBe("Doe");

        expect(result.email).toBe("john@example.com");

        expect(result.status).toBe("active");

      });

 

      it("should require id", () => {

        const input = {

          firstName: "John",

        };

 

        expect(() => updateMemberSchema.parse(input)).toThrow();

      });

    });

  });

 

  describe("Validation Helpers", () => {

    describe("validateInput", () => {

      it("should return validated data on success", () => {

        const result = validateInput(positiveIntSchema, 42);

 

        expect(result).toBe(42);

      });

 

      it("should throw error on validation failure", () => {

        expect(() => validateInput(positiveIntSchema, -1)).toThrow(

          "Validation failed"

        );

      });

    });

 

    describe("safeValidateInput", () => {

      it("should return success object on valid input", () => {

        const result = safeValidateInput(positiveIntSchema, 42);

 

        expect(result.success).toBe(true);

        if (result.success) {

          expect(result.data).toBe(42);

        }

      });

 

      it("should return error object on invalid input", () => {

        const result = safeValidateInput(positiveIntSchema, -1);

 

        expect(result.success).toBe(false);

        if (!result.success) {

          expect(result.error).toContain("Validation failed");

        }

      });

    });

  });

 

  describe("Custom Validators", () => {

    describe("validateFutureDate", () => {

      it("should accept future dates", () => {

        const futureDate = new Date();

        futureDate.setDate(futureDate.getDate() + 7);

        const dateString = futureDate.toISOString().split("T")[0]!;

 

        expect(validateFutureDate(dateString)).toBe(true);

      });

 

      it("should accept today", () => {

        const today = new Date().toISOString().split("T")[0]!;

 

        expect(validateFutureDate(today)).toBe(true);

      });

 

      it("should reject past dates", () => {

        const pastDate = new Date();

        pastDate.setDate(pastDate.getDate() - 7);

        const dateString = pastDate.toISOString().split("T")[0]!;

 

        expect(validateFutureDate(dateString)).toBe(false);

      });

    });

 

    describe("validateDateRange", () => {

      it("should accept date within range", () => {

        const futureDate = new Date();

        futureDate.setDate(futureDate.getDate() + 14);

        const dateString = futureDate.toISOString().split("T")[0]!;

 

        expect(validateDateRange(dateString, 30)).toBe(true);

      });

 

      it("should reject date beyond range", () => {

        const farFuture = new Date();

        farFuture.setDate(farFuture.getDate() + 100);

        const dateString = farFuture.toISOString().split("T")[0]!;

 

        expect(validateDateRange(dateString, 30)).toBe(false);

      });

 

      it("should reject past dates", () => {

        const pastDate = new Date();

        pastDate.setDate(pastDate.getDate() - 7);

        const dateString = pastDate.toISOString().split("T")[0]!;

 

        expect(validateDateRange(dateString, 30)).toBe(false);

      });

    });

 

    describe("validateBusinessHours", () => {

      it("should accept time within business hours", () => {

        expect(validateBusinessHours("09:00")).toBe(true);

        expect(validateBusinessHours("12:00")).toBe(true);

        expect(validateBusinessHours("18:00")).toBe(true);

      });

 

      it("should accept time at boundaries", () => {

        expect(validateBusinessHours("06:00")).toBe(true);

        expect(validateBusinessHours("20:00")).toBe(true);

      });

 

      it("should reject time outside business hours", () => {

        expect(validateBusinessHours("05:59")).toBe(false);

        expect(validateBusinessHours("20:01")).toBe(false);

        expect(validateBusinessHours("23:00")).toBe(false);

      });

 

      it("should accept custom business hours", () => {

        expect(validateBusinessHours("07:00", "07:00", "19:00")).toBe(true);

        expect(validateBusinessHours("06:00", "07:00", "19:00")).toBe(false);

      });

    });

  });

});