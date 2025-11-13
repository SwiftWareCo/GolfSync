# Pending Implementation Guide

 

**Date:** November 13, 2025

**Status:** Action Required

**Priority:** High

 

This document provides step-by-step instructions for implementing the remaining security and monitoring tasks identified in Phases 10 and 11.

 

---

 

## Table of Contents

 

1. [Phase 10: Monitoring Setup (External)](#phase-10-monitoring-setup-external)

2. [Phase 11: Security Application](#phase-11-security-application)

3. [Dependency Security Updates](#dependency-security-updates)

 

---

 

## Phase 10: Monitoring Setup (External)

 

### 1. Configure External Uptime Monitoring

 

**Why:** The `/api/health` endpoint is ready, but you need an external service to ping it and alert you when it's down.

 

#### Option A: UptimeRobot (Recommended - Free)

 

**Steps:**

 

1. **Sign up for UptimeRobot**

   - Visit: https://uptimerobot.com

   - Create free account (monitors up to 50 URLs)

 

2. **Add a new monitor**

   - Click "Add New Monitor"

   - Monitor Type: **HTTP(s)**

   - Friendly Name: `GolfSync Health Check`

   - URL: `https://golfsync.vercel.app/api/health`

   - Monitoring Interval: **5 minutes** (free tier)

 

3. **Configure alerts**

   - Alert Contacts: Add your email

   - Alert When Down For: **2 minutes** (1 failed check)

   - Get Notified When:

     - ✅ Down

     - ✅ Up (recovery notification)

 

4. **Advanced settings**

   - Expected Status Code: **200**

   - Custom HTTP Headers: None needed

   - Keyword Monitoring: Add `"status":"healthy"` (optional)

 

5. **Save and test**

   - Click "Create Monitor"

   - Click "Test" to verify it's working

   - Simulate failure by temporarily disabling database to test alerts

 

#### Option B: Pingdom

 

1. Visit: https://www.pingdom.com

2. Similar setup to UptimeRobot

3. Free trial, then paid ($10/month)

 

#### Option C: Vercel Monitoring (Coming Soon)

 

Vercel is rolling out uptime monitoring. Check your project dashboard for availability.

 

**Expected Outcome:**

- ✅ Health endpoint pinged every 5 minutes

- ✅ Email/SMS alerts when health check fails

- ✅ Dashboard showing uptime percentage (aim for 99.9%+)

 

---

 

### 2. Configure Vercel Dashboard Access

 

**Why:** Team members need access to view Analytics, Speed Insights, and deployment logs.

 

#### Steps:

 

1. **Log into Vercel Dashboard**

   - Visit: https://vercel.com/dashboard

   - Select the `golfsync` project

 

2. **Navigate to Team Settings**

   - Click Settings → Team

   - Or visit: https://vercel.com/[your-team]/settings/members

 

3. **Invite team members**

   - Click "Invite Member"

   - Enter email addresses:

     - Operations Manager (for Analytics)

     - Technical Lead (for Speed Insights)

     - Support Staff (view-only access)

 

4. **Set appropriate permissions**

   - **Admin:** Full access (deployment, settings)

   - **Developer:** Deploy and view analytics

   - **Viewer:** View-only (analytics, logs)

 

5. **Enable Analytics/Speed Insights**

   - Go to Project Settings → Analytics

   - Ensure "Vercel Analytics" is **Enabled**

   - Go to Project Settings → Speed Insights

   - Ensure "Speed Insights" is **Enabled**

 

6. **Share dashboard URLs with team**

   ```

   Analytics:      https://vercel.com/[team]/golfsync/analytics

   Speed Insights: https://vercel.com/[team]/golfsync/speed-insights

   Logs:           https://vercel.com/[team]/golfsync/logs

   Health Check:   https://golfsync.vercel.app/api/health

   ```

 

**Expected Outcome:**

- ✅ Team members can access dashboards

- ✅ Analytics showing real user data within 24 hours

- ✅ Speed Insights reporting Core Web Vitals

 

---

 

## Phase 11: Security Application

 

### Overview of Security Infrastructure

 

**What's already built:**

- ✅ `src/lib/auth-helpers.ts` - Auth functions (`requireAuth()`, `requireAdmin()`, `requireMember()`)

- ✅ `src/lib/validation-schemas.ts` - 40+ Zod schemas for input validation

- ✅ `src/lib/rate-limit.ts` - Rate limiting system

- ✅ Security headers in `next.config.js`

 

**What needs to be done:**

- Apply these tools to existing server actions

 

---

 

### 1. Apply Auth Helpers to Server Actions

 

#### Server Actions That Need Authentication

 

**Count:** ~50 server actions across 20 files

 

**Files to update:**

```

src/server/members/actions.ts         - 7 functions

src/server/charges/actions.ts         - 9 functions

src/server/lottery/actions.ts         - 22 functions

src/server/teesheet/actions.ts        - 5 functions

src/server/settings/actions.ts        - 4 functions

src/server/guests/actions.ts          - 3 functions

...and more

```

 

#### Implementation Pattern

 

**Before (Unsecured):**

```typescript

// src/server/members/actions.ts

"use server";

 

export async function deleteMember(id: number) {

  await db.delete(members).where(eq(members.id, id));

  revalidatePath("/members");

  return { success: true };

}

```

 

**After (Secured):**

```typescript

"use server";

 

import { requireAdmin } from "~/lib/auth-helpers";

import { memberIdSchema } from "~/lib/validation-schemas";

 

export async function deleteMember(id: number) {

  // 1. Authentication & Authorization

  await requireAdmin(); // Throws if not admin

 

  // 2. Input validation

  const validatedId = memberIdSchema.parse(id); // Throws if invalid

 

  // 3. Business logic

  await db.delete(members).where(eq(members.id, validatedId));

  revalidatePath("/members");

 

  return { success: true };

}

```

 

#### Step-by-Step Implementation

 

**Step 1: Categorize functions by access level**

 

Create this table for each file:

 

| Function | Access Level | Validation Schema |

|----------|-------------|-------------------|

| `createMember()` | Admin | `createMemberSchema` |

| `updateMember()` | Admin | `updateMemberSchema` |

| `deleteMember()` | Admin | `memberIdSchema` |

| `searchMembersAction()` | Member | None (query string) |

| `getMemberBookingHistory()` | Member (own) | `memberIdSchema` |

 

**Step 2: Update imports**

 

Add to top of each action file:

```typescript

import { requireAuth, requireAdmin, requireMember } from "~/lib/auth-helpers";

import {

  memberIdSchema,

  createMemberSchema,

  // ... other schemas

} from "~/lib/validation-schemas";

```

 

**Step 3: Add auth checks to each function**

 

**Pattern 1: Admin-only functions**

```typescript

export async function createMember(data: any) {

  const user = await requireAdmin(); // Returns user object or throws

  const validated = createMemberSchema.parse(data);

 

  // ... existing logic

}

```

 

**Pattern 2: Member-only functions**

```typescript

export async function submitLotteryEntry(data: any) {

  const user = await requireMember(); // Ensures user is a member

  const validated = lotteryEntrySchema.parse(data);

 

  // ... existing logic

}

```

 

**Pattern 3: Member can only access their own data**

```typescript

export async function getMemberBookingHistory(memberId: number) {

  const user = await requireAuth(); // Get current user

  const validatedId = memberIdSchema.parse(memberId);

 

  // Check ownership: user can only view their own history (unless admin)

  if (!user.isAdmin && user.memberId !== validatedId) {

    throw new Error(JSON.stringify({

      code: "FORBIDDEN",

      message: "You can only view your own booking history",

      status: 403

    }));

  }

 

  // ... existing logic

}

```

 

**Pattern 4: Public functions (weather, health checks)**

```typescript

export async function getWeatherData() {

  // No auth required - public data

  // But still validate input if any

 

  // ... existing logic

}

```

 

#### Quick Reference: Which Auth Function to Use?

 

| Scenario | Function | What it does |

|----------|----------|--------------|

| Admin operations (create/update/delete) | `requireAdmin()` | Throws if not admin |

| Member operations (booking, profiles) | `requireMember()` | Throws if not member |

| Any authenticated user | `requireAuth()` | Throws if not logged in |

| Public endpoints | None | No auth check |

 

#### Error Handling

 

Auth helpers throw structured errors that are automatically caught:

 

```typescript

try {

  const user = await requireAdmin();

  // ... do admin stuff

} catch (error) {

  // Error is already formatted as:

  // {

  //   code: "UNAUTHORIZED" | "FORBIDDEN",

  //   message: "...",

  //   status: 401 | 403

  // }

  return { success: false, error: error.message };

}

```

 

**Note:** In Next.js server actions, thrown errors are automatically returned to the client, so you don't need explicit try/catch unless you want custom handling.

 

---

 

### 2. Apply Validation Schemas to Server Actions

 

#### Available Schemas

 

Located in `src/lib/validation-schemas.ts`:

 

**Member Schemas:**

- `memberIdSchema` - Validates member ID

- `createMemberSchema` - Full member creation data

- `updateMemberSchema` - Partial member updates

- `emailSchema` - Email validation

- `phoneNumberSchema` - Phone validation

 

**Lottery Schemas:**

- `lotteryEntrySchema` - Lottery entry creation

- `lotteryDateSchema` - Lottery date validation

 

**Charge Schemas:**

- `chargeAmountSchema` - Validates charge amounts

- `createChargeSchema` - Charge creation data

 

**Date/Time Schemas:**

- `dateStringSchema` - YYYY-MM-DD format

- `timeStringSchema` - HH:MM format

- `validateFutureDate()` - Custom validator for future dates

 

**Custom Validators:**

- `validateFutureDate(date: string): boolean` - Ensures date is not in past

- `validateDateRange(date: string, maxDaysAhead: number): boolean` - Date within range

 

#### Implementation Examples

 

**Example 1: Simple ID validation**

```typescript

import { memberIdSchema } from "~/lib/validation-schemas";

 

export async function getMember(id: number) {

  const validatedId = memberIdSchema.parse(id); // Throws if invalid

  return await db.query.members.findFirst({

    where: eq(members.id, validatedId)

  });

}

```

 

**Example 2: Object validation**

```typescript

import { createChargeSchema } from "~/lib/validation-schemas";

 

export async function createGeneralCharge(data: any) {

  await requireAdmin();

 

  // Validates all fields: memberId, amount, description, chargeDate

  const validated = createChargeSchema.parse(data);

 

  await db.insert(charges).values({

    memberId: validated.memberId,

    amount: validated.amount,

    description: validated.description,

    // ... use validated data

  });

}

```

 

**Example 3: Custom date validation**

```typescript

import { dateStringSchema, validateFutureDate } from "~/lib/validation-schemas";

 

export async function createTeesheet(date: string, title: string) {

  await requireAdmin();

 

  // First validate format

  const validatedDate = dateStringSchema.parse(date);

 

  // Then validate it's not in the past

  if (!validateFutureDate(validatedDate)) {

    throw new Error("Cannot create teesheet for past dates");

  }

 

  // ... create teesheet

}

```

 

**Example 4: Partial validation (updates)**

```typescript

import { updateMemberSchema } from "~/lib/validation-schemas";

 

export async function updateMember(id: number, data: Partial<Member>) {

  await requireAdmin();

 

  const validatedId = memberIdSchema.parse(id);

  const validatedData = updateMemberSchema.parse(data); // Allows partial fields

 

  await db.update(members)

    .set(validatedData)

    .where(eq(members.id, validatedId));

}

```

 

#### Creating New Schemas

 

If you need a schema that doesn't exist yet:

 

```typescript

// Add to src/lib/validation-schemas.ts

 

export const myNewSchema = z.object({

  field1: z.string().min(1, "Field 1 is required"),

  field2: z.number().positive("Must be positive"),

  field3: z.date().optional(),

});

 

export type MyNewType = z.infer<typeof myNewSchema>;

```

 

Then import and use:

```typescript

import { myNewSchema } from "~/lib/validation-schemas";

 

export async function myAction(data: any) {

  const validated = myNewSchema.parse(data);

  // ... use validated

}

```

 

---

 

### 3. Apply Rate Limiting to Booking Endpoints

 

#### Why Rate Limit?

 

Prevent abuse scenarios:

- User spam-clicking "Book Time Slot" 100 times

- Malicious actor overwhelming lottery submissions

- Bot attacks on public endpoints

 

#### Where to Apply

 

**High Priority:**

- `submitLotteryEntry()` - Prevent lottery spam

- `addMemberToTimeBlock()` - Prevent booking spam

- `createPowerCartCharge()` - Prevent charge spam

 

**Medium Priority:**

- `updateLotteryEntry()` - Prevent update spam

- `searchMembersAction()` - Prevent search abuse

 

**Low Priority:**

- Read-only operations (usually fine without limits)

 

#### Implementation Pattern

 

**Pattern 1: Per-user rate limiting**

 

```typescript

import { checkRateLimit, RateLimitConfig } from "~/lib/rate-limit";

 

const LOTTERY_SUBMIT_LIMIT: RateLimitConfig = {

  maxRequests: 5,        // Max 5 submissions

  windowMs: 60 * 1000,   // Per 1 minute

};

 

export async function submitLotteryEntry(data: any) {

  const user = await requireMember();

 

  // Rate limit check

  const rateLimitResult = checkRateLimit(

    `lottery-submit:${user.userId}`, // Unique identifier per user

    LOTTERY_SUBMIT_LIMIT

  );

 

  if (!rateLimitResult.success) {

    throw new Error(JSON.stringify({

      code: "RATE_LIMIT_EXCEEDED",

      message: `Too many requests. Try again in ${rateLimitResult.retryAfter} seconds`,

      status: 429,

      retryAfter: rateLimitResult.retryAfter

    }));

  }

 

  // Validate input

  const validated = lotteryEntrySchema.parse(data);

 

  // ... proceed with submission

}

```

 

**Pattern 2: Global rate limiting (all users)**

 

```typescript

const SEARCH_LIMIT: RateLimitConfig = {

  maxRequests: 100,      // Max 100 searches

  windowMs: 60 * 1000,   // Per 1 minute (across all users)

};

 

export async function searchMembersAction(query: string) {

  // Global rate limit (not per-user)

  const rateLimitResult = checkRateLimit(

    'global-search', // Same key for all users

    SEARCH_LIMIT

  );

 

  if (!rateLimitResult.success) {

    throw new Error("Search temporarily unavailable. Please try again.");

  }

 

  return await searchMembers(query);

}

```

 

**Pattern 3: Stricter limits for sensitive operations**

 

```typescript

const DELETE_MEMBER_LIMIT: RateLimitConfig = {

  maxRequests: 10,        // Max 10 deletions

  windowMs: 60 * 60 * 1000, // Per 1 hour

};

 

export async function deleteMember(id: number) {

  const user = await requireAdmin();

 

  // Very strict rate limit for deletions

  const rateLimitResult = checkRateLimit(

    `delete-member:${user.userId}`,

    DELETE_MEMBER_LIMIT

  );

 

  if (!rateLimitResult.success) {

    throw new Error("Deletion limit reached. Contact support if needed.");

  }

 

  // ... proceed with deletion

}

```

 

#### Rate Limit Configuration Guidelines

 

| Operation Type | maxRequests | windowMs | Rationale |

|----------------|-------------|----------|-----------|

| Lottery submit | 5 | 1 min | Prevent spam entries |

| Booking | 20 | 1 min | Allow reasonable booking activity |

| Create charge | 30 | 1 min | Admins create multiple charges |

| Search | 100 | 1 min | Allow rapid searching |

| Delete | 10 | 1 hour | Sensitive operation |

| Read-only | No limit | - | Generally safe |

 

#### Testing Rate Limits

 

```bash

# Test lottery submit rate limit

for i in {1..6}; do

  curl -X POST https://golfsync.vercel.app/api/lottery/submit \

    -H "Cookie: your-auth-cookie" \

    -d '{"date":"2025-11-15","memberId":1}' \

  echo "Request $i"

done

 

# Expected: First 5 succeed, 6th returns 429 Too Many Requests

```

 

---

 

### 4. Complete Implementation Checklist

 

Use this checklist to track your progress:

 

#### Members Module (`src/server/members/actions.ts`)

- [ ] `createMember()` - Add `requireAdmin()` + `createMemberSchema`

- [ ] `updateMember()` - Add `requireAdmin()` + `updateMemberSchema`

- [ ] `deleteMember()` - Add `requireAdmin()` + rate limit (10/hour)

- [ ] `searchMembersAction()` - Add `requireAuth()` + rate limit (100/min)

- [ ] `getMemberBookingHistory()` - Add ownership check

 

#### Charges Module (`src/server/charges/actions.ts`)

- [ ] `createPowerCartCharge()` - Add `requireAdmin()` + validation + rate limit

- [ ] `createGeneralCharge()` - Add `requireAdmin()` + `createChargeSchema`

- [ ] `completePowerCartCharge()` - Add `requireAdmin()` + validation

- [ ] `deleteGeneralCharge()` - Add `requireAdmin()` + rate limit

- [ ] `fetchFilteredCharges()` - Add `requireAuth()`

 

#### Lottery Module (`src/server/lottery/actions.ts`)

- [ ] `submitLotteryEntry()` - Add `requireMember()` + validation + rate limit (5/min)

- [ ] `updateLotteryEntry()` - Add ownership check + rate limit (10/min)

- [ ] `cancelLotteryEntry()` - Add ownership check

- [ ] `processLotteryForDate()` - Add `requireAdmin()` + rate limit (1/min)

- [ ] `finalizeLotteryResults()` - Add `requireAdmin()`

- [ ] `clearLotteryEntriesForDate()` - Add `requireAdmin()` (dangerous!)

 

#### Teesheet Module (`src/server/teesheet/actions.ts`)

- [ ] `createTeesheet()` - Add `requireAdmin()` + date validation

- [ ] `updateTeesheet()` - Add `requireAdmin()`

- [ ] `deleteTeesheet()` - Add `requireAdmin()` + rate limit

- [ ] `addMemberToTimeBlock()` - Add `requireAuth()` + rate limit (20/min)

 

#### Settings Module (`src/server/settings/actions.ts`)

- [ ] All functions - Add `requireAdmin()` (settings are admin-only)

 

#### Guests Module (`src/server/guests/actions.ts`)

- [ ] `addGuest()` - Add `requireMember()` + validation

- [ ] `removeGuest()` - Add ownership check

 

#### Weather Module (`src/server/weather/actions.ts`)

- [ ] Functions are public - No auth needed (maybe rate limit 100/min)

 

---

 

## Dependency Security Updates

 

### Current Vulnerabilities

 

Run `npm audit` to see current issues:

 

```bash

npm audit

```

 

**Current vulnerabilities (as of Nov 13, 2025):**

```

1 high severity:    @clerk/nextjs

5 moderate:         next, esbuild, eslint-related

3 low:              brace-expansion

```

 

### Resolution Steps

 

#### 1. Fix Non-Breaking Issues

 

Run the safe fix command:

 

```bash

npm audit fix

```

 

This will update:

- ✅ `@clerk/nextjs` → 6.23.3+ (fixes authentication verification issue)

- ✅ `next` → 15.4.7+ (fixes SSRF and cache vulnerabilities)

- ✅ `@eslint/plugin-kit` → 0.3.4+ (dev dependency, low risk)

- ✅ `brace-expansion` (dev dependency, low risk)

 

**Test after updating:**

```bash

npm run build    # Ensure build works

npm test         # Ensure tests pass (should still be 524/524)

npm run dev      # Test locally

```

 

#### 2. Fix Breaking Changes (esbuild/drizzle-kit)

 

The `esbuild` vulnerability requires updating `drizzle-kit`, which may have breaking changes.

 

**Check current version:**

```bash

npm list drizzle-kit

# Currently: 0.9.1 (vulnerable)

# Need: 0.31.6+ (secure)

```

 

**Update with caution:**

```bash

npm install drizzle-kit@latest --save-dev

```

 

**Verify drizzle migrations still work:**

```bash

npm run db:generate  # Generate migrations

npm run db:push      # Push to database

npm run db:studio    # Check Drizzle Studio

```

 

If migrations break, check the [Drizzle Kit changelog](https://github.com/drizzle-team/drizzle-orm/releases) for migration instructions.

 

#### 3. Verify All Vulnerabilities Resolved

 

```bash

npm audit

 

# Expected output:

found 0 vulnerabilities

```

 

If vulnerabilities remain:

```bash

npm audit --json > audit-report.json  # Generate detailed report

# Review each remaining vulnerability

# Check if they affect production code or only dev dependencies

```

 

#### 4. Commit Security Updates

 

```bash

git add package.json package-lock.json

git commit -m "security: fix npm audit vulnerabilities

 

- Updated @clerk/nextjs to 6.23.3 (fixes auth verification)

- Updated next to 15.4.7 (fixes SSRF and cache issues)

- Updated drizzle-kit to 0.31.6 (fixes esbuild vulnerability)

- Updated eslint dependencies (dev-only)

 

Test results: All 524 tests passing

Build status: Successful"

 

git push

```

 

---

 

## Implementation Timeline

 

### Recommended Approach: Phased Implementation

 

**Week 1: Critical Security (Admin functions)**

- Day 1-2: Secure all admin deletion/creation functions

- Day 3: Add rate limiting to high-risk endpoints

- Day 4: Test and validate

- Day 5: Deploy and monitor

 

**Week 2: Member Security**

- Day 1-2: Secure member booking functions

- Day 3: Add ownership checks

- Day 4-5: Test and deploy

 

**Week 3: Validation & Polish**

- Day 1-2: Add validation schemas to all endpoints

- Day 3: Set up external monitoring

- Day 4-5: Final testing and documentation

 

### Quick Start (If Urgent)

 

If you need to secure the app quickly, prioritize these 10 functions:

 

1. `deleteMember()` - ⚠️ Can permanently delete user data

2. `clearLotteryEntriesForDate()` - ⚠️ Can wipe lottery entries

3. `processLotteryForDate()` - ⚠️ Critical lottery logic

4. `createMember()` - Prevents unauthorized member creation

5. `createGeneralCharge()` - Prevents fraudulent charges

6. `submitLotteryEntry()` - Prevent lottery spam

7. `addMemberToTimeBlock()` - Prevent booking spam

8. `updateMember()` - Protect member data

9. `deleteTeesheet()` - Prevent accidental deletions

10. `finalizeLotteryResults()` - Critical results processing

 

Secure these 10 first, then proceed with the rest.

 

---

 

## Testing Your Implementation

 

### 1. Manual Testing

 

**Test authentication:**

```bash

# Test as unauthenticated user (should fail)

curl https://golfsync.vercel.app/api/members/delete -X POST \

  -d '{"id": 1}'

# Expected: 401 Unauthorized

 

# Test as non-admin member (should fail)

curl https://golfsync.vercel.app/api/members/delete -X POST \

  -H "Cookie: [member-auth-cookie]" \

  -d '{"id": 1}'

# Expected: 403 Forbidden

 

# Test as admin (should succeed)

curl https://golfsync.vercel.app/api/members/delete -X POST \

  -H "Cookie: [admin-auth-cookie]" \

  -d '{"id": 1}'

# Expected: 200 OK

```

 

**Test validation:**

```bash

# Test with invalid data (should fail)

curl https://golfsync.vercel.app/api/charges/create -X POST \

  -H "Cookie: [admin-auth-cookie]" \

  -d '{"amount": -100}'  # Negative amount

# Expected: 400 Bad Request + validation error

 

# Test with valid data (should succeed)

curl https://golfsync.vercel.app/api/charges/create -X POST \

  -H "Cookie: [admin-auth-cookie]" \

  -d '{"memberId": 1, "amount": 100, "description": "Test"}'

# Expected: 200 OK

```

 

**Test rate limiting:**

```bash

# Rapid-fire requests (should get rate limited)

for i in {1..10}; do

  curl https://golfsync.vercel.app/api/lottery/submit -X POST \

    -H "Cookie: [member-auth-cookie]" \

    -d '{"date":"2025-11-15","memberId":1}'

done

# Expected: First few succeed, then 429 Too Many Requests

```

 

### 2. Automated Testing

 

Add tests for secured functions:

 

```typescript

// src/server/members/__tests__/secured-actions.test.ts

import { describe, it, expect, vi } from "vitest";

import { deleteMember } from "../actions";

import * as authHelpers from "~/lib/auth-helpers";

 

describe("deleteMember security", () => {

  it("should require admin access", async () => {

    // Mock requireAdmin to throw

    vi.spyOn(authHelpers, "requireAdmin").mockRejectedValue(

      new Error(JSON.stringify({ code: "FORBIDDEN", status: 403 }))

    );

 

    await expect(deleteMember(1)).rejects.toThrow();

  });

 

  it("should validate member ID", async () => {

    // Mock requireAdmin to succeed

    vi.spyOn(authHelpers, "requireAdmin").mockResolvedValue({

      userId: "admin123",

      isAdmin: true,

      isMember: false,

      memberId: null,

    });

 

    // Invalid ID should throw validation error

    await expect(deleteMember(-1)).rejects.toThrow();

    await expect(deleteMember(0)).rejects.toThrow();

  });

});

```

 

Run tests after each update:

```bash

npm test

# Should maintain 524/524 passing + your new tests

```

 

---

 

## Monitoring Your Changes

 

After implementing security changes:

 

### 1. Check Error Logs

 

In Vercel dashboard:

```

Project → Logs → Filter by "error"

```

 

Look for:

- ❌ Sudden increase in 401/403 errors (might indicate auth issues)

- ❌ 400 errors with validation messages (users submitting bad data)

- ✅ 429 errors (rate limiting working as intended)

 

### 2. Monitor Performance

 

Security checks add minimal overhead:

- Auth check: ~5-10ms

- Validation: ~1-2ms

- Rate limit check: ~1ms

 

Check in Speed Insights that p95 response times haven't increased significantly.

 

### 3. User Feedback

 

After deploying security changes:

- Monitor support requests for "permission denied" issues

- Check if legitimate users are getting rate limited (adjust limits if needed)

- Verify admins can still perform all operations

 

---

 

## Getting Help

 

If you encounter issues during implementation:

 

1. **Check test suite:** `npm test` - Should show you exactly what broke

2. **Check type errors:** `npm run build` - TypeScript will catch many issues

3. **Review examples:** Check `docs/PHASE_11_COMPLETE.md` for reference implementations

4. **Check logs:** Vercel dashboard → Logs (for production issues)

 

---

 

## Summary Checklist

 

Before marking Phases 10 & 11 as fully complete:

 

### Phase 10 - Monitoring

- [ ] External uptime monitoring configured (UptimeRobot/Pingdom)

- [ ] Alerts configured and tested

- [ ] Team has access to Vercel dashboards

- [ ] Health check endpoint verified in production

 

### Phase 11 - Security

- [ ] Auth helpers applied to all admin functions

- [ ] Auth helpers applied to all member functions

- [ ] Validation schemas applied to all user inputs

- [ ] Rate limiting added to booking/lottery endpoints

- [ ] All npm vulnerabilities resolved (`npm audit` shows 0)

- [ ] Security testing performed (manual + automated)

- [ ] 524+ tests still passing

 

### Documentation

- [ ] Team trained on new auth patterns

- [ ] Rate limit values documented and justified

- [ ] Monitoring runbooks created

- [ ] Incident response procedures documented

 

---

 

**Next Steps:** Start with the "Quick Start" 10 critical functions, then work through the full checklist module by module. Test thoroughly after each module before moving to the next.

 

**Estimated Time:**

- Critical security (10 functions): 4-6 hours

- Full security implementation: 20-30 hours

- Monitoring setup: 1-2 hours

- Testing & validation: 4-6 hours

- **Total:** ~30-40 hours