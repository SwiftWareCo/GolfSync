# Lottery System Architectural Audit - Granular Issue Breakdown

## Overview

This document breaks down each architectural issue into individual commits/phases. Each issue lists EVERY file affected with specific line numbers and required changes.

Work through these sequentially - each is designed to be an isolated change that can be committed independently.

---

## COMMIT 1: Add Missing LotteryEntryData Type & Refactor Member Profiles Query

**Problem #1:** `LotteryEntryData` type is defined in forbidden `@src/app/types/LotteryTypes.ts` but should be in schema file.

**Problem #2:** `member-profiles-data.ts` uses manual `.select()` with `.leftJoin()` and manual type definitions instead of Drizzle's relational query API with type inference.

**Files to Modify:**

### 1.1 `src/server/db/schema/lottery/lottery-entries.schema.ts`

**After line 89** (after existing type exports), add:

```typescript
// Lottery entry data return type for member view (discriminated union)
// Used by getLotteryEntryData() to distinguish individual/group/group_member entries
export type LotteryEntryData =
  | { type: "individual"; entry: LotteryEntry }
  | { type: "group"; entry: LotteryEntry }
  | { type: "group_member"; entry: LotteryEntry }
  | null;
```

### 1.2 `src/server/lottery/member-profiles-data.ts`

**Lines 10-31:** DELETE the entire `MemberProfile` interface
```typescript
// REMOVE THIS:
export interface MemberProfile {
  id: number;
  memberId: number;
  memberName: string;
  // ... all 20+ fields
}
```

**Lines 56-102:** Replace manual query with Drizzle relational query
```typescript
// CHANGE FROM:
export async function getMemberProfilesWithFairness(): Promise<MemberProfile[]> {
  const currentMonth = format(new Date(), "yyyy-MM");

  const profiles = await db
    .select({
      id: members.id,
      memberId: members.id,
      memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
      // ... 20+ manual field mappings
    })
    .from(members)
    .leftJoin(memberSpeedProfiles, eq(members.id, memberSpeedProfiles.memberId))
    .leftJoin(
      memberFairnessScores,
      and(
        eq(members.id, memberFairnessScores.memberId),
        eq(memberFairnessScores.currentMonth, currentMonth)
      )
    )
    .where(isNotNull(members.id))
    .orderBy(desc(members.lastName));

  return profiles;
}

// TO:
export async function getMemberProfilesWithFairness() {
  const currentMonth = format(new Date(), "yyyy-MM");

  const profiles = await db.query.members.findMany({
    with: {
      memberSpeedProfile: true,
      memberFairnessScores: {
        where: eq(memberFairnessScores.currentMonth, currentMonth),
        limit: 1,
      },
    },
    orderBy: [desc(members.lastName)],
  });

  // Transform to match expected shape with nested data and single fairness score
  return profiles.map(profile => ({
    ...profile,
    memberSpeedProfile: profile.memberSpeedProfile ?? null,
    fairnessScore: profile.memberFairnessScores[0] ?? null,
  }));
}
```

**Lines 105-150:** Update `getMemberProfileById` similarly
```typescript
// CHANGE FROM:
export async function getMemberProfileById(memberId: number): Promise<MemberProfile | null> {
  const currentMonth = format(new Date(), "yyyy-MM");

  const profile = await db
    .select({
      id: members.id,
      // ... manual field mappings
    })
    .from(members)
    .leftJoin(memberSpeedProfiles, eq(members.id, memberSpeedProfiles.memberId))
    .leftJoin(
      memberFairnessScores,
      and(
        eq(members.id, memberFairnessScores.memberId),
        eq(memberFairnessScores.currentMonth, currentMonth)
      )
    )
    .where(eq(members.id, memberId))
    .limit(1);

  return profile[0] ?? null;
}

// TO:
export async function getMemberProfileById(memberId: number) {
  const currentMonth = format(new Date(), "yyyy-MM");

  const profile = await db.query.members.findFirst({
    where: eq(members.id, memberId),
    with: {
      memberSpeedProfile: true,
      memberFairnessScores: {
        where: eq(memberFairnessScores.currentMonth, currentMonth),
        limit: 1,
      },
    },
  });

  if (!profile) return null;

  // Transform to match expected shape
  return {
    ...profile,
    memberSpeedProfile: profile.memberSpeedProfile ?? null,
    fairnessScore: profile.memberFairnessScores[0] ?? null,
  };
}
```

**Notes:**
- Components will now access nested data with optional chaining: `profile.memberSpeedProfile?.speedTier ?? "AVERAGE"`
- Drizzle automatically infers return types - no manual type definitions needed
- `TimeWindow` already exists in `@src/lib/lottery-utils.ts` - we'll import from there

**Impact:** 2 files modified, ~6 lines added to schema, ~80 lines simplified in member-profiles-data.ts

---

## COMMIT 2: Update lottery/data.ts to Import from Schema

**Problem:** Imports `LotteryEntryData` from forbidden `@src/app/types/LotteryTypes`

**Files to Modify:**

### 2.1 `src/server/lottery/data.ts`

**Line 13:** Update import
```typescript
// CHANGE FROM:
import type { LotteryEntryData } from "~/app/types/LotteryTypes";

// TO:
import type { LotteryEntryData } from "~/server/db/schema/lottery/lottery-entries.schema";
```

**Lines 57, 66, 78:** Remove `as any` type assertions
```typescript
// CHANGE FROM:
return { type: "individual", entry: individualEntry as any };
return { type: "group", entry: groupEntry as any };
return { type: "group_member", entry: groupMemberEntry as any };

// TO:
return { type: "individual", entry: individualEntry };
return { type: "group", entry: groupEntry };
return { type: "group_member", entry: groupMemberEntry };
```

**Impact:** 1 file modified, 4 lines changed

---

## COMMIT 3: Update lottery/actions.ts Type Imports

**Problem:** Imports forbidden types from `@src/app/types/LotteryTypes` and uses `any` parameters

**Files to Modify:**

### 3.1 `src/server/lottery/actions.ts`

**Lines 16-19:** Update imports
```typescript
// CHANGE FROM:
import type {
  LotteryEntryFormData,
  TimeWindow,
} from "~/app/types/LotteryTypes";

// TO:
import type { TimeWindow } from "~/lib/lottery-utils";
import type { LotteryFormInput } from "~/server/db/schema/lottery/lottery-entries.schema";
```

**Note:** Change all usages of `LotteryEntryFormData` to `LotteryFormInput` throughout the file

**Line 381:** Fix function parameter type
```typescript
// CHANGE FROM:
async function calculateFairnessScore(entry: any, timeWindows: any[]): Promise<number>

// TO:
async function calculateFairnessScore(
  entry: { organizerId: number; preferredWindow: string },
  timeWindows: Array<{ window: string; startMinutes: number; endMinutes: number }>
): Promise<number>
```

**Line 474:** Fix memberInserts type
```typescript
// CHANGE FROM:
const memberInserts: any[] = [];

// TO:
const memberInserts: Array<{
  timeBlockId: number;
  memberId: number;
  bookingDate: string;
  bookingTime: string;
}> = [];
```

**Line 724:** Similar fix for memberInserts
```typescript
// CHANGE FROM:
const memberInserts: any[] = [];

// TO:
const memberInserts: Array<{
  timeBlockId: number;
  memberId: number;
  bookingDate: string;
  bookingTime: string;
}> = [];
```

**Lines 827, 886, 916:** Fix helper function types
```typescript
// CHANGE FROM:
function filterBlocksByRestrictions(blocks: any[], memberInfo: {...}, ...)

// TO:
function filterBlocksByRestrictions(
  blocks: Array<{ id: number; startTime: string; availableSpots: number }>,
  memberInfo: { memberId: number; memberClass: string },
  ...
)
```

**Impact:** 1 file modified, ~10 lines changed

---

## COMMIT 4: Delete @src/app/types/LotteryTypes.ts

**Problem:** File exists in forbidden directory per CLAUDE.md

**Files to Modify:**

### 4.1 DELETE FILE: `src/app/types/LotteryTypes.ts`

**Note:** Only do this AFTER commits 2 & 3 are complete to avoid breaking imports

**Impact:** 1 file deleted

---

## COMMIT 5: Update Component Type Imports

**Problem:** Components import types from now-deleted `@src/app/types/`

**Files to Modify:**

### 5.1 `src/components/lottery/AdminLotteryEntryModal.tsx`

**Lines 24-27:** Update imports
```typescript
// CHANGE FROM:
import type {
  TimeWindow,
  LotteryEntryFormData,
} from "~/app/types/LotteryTypes";

// TO:
import type { TimeWindow } from "~/lib/lottery-utils";
```

**Note:** This component already imports `LotteryFormInput` from schema (line 32), so just remove the duplicate `LotteryEntryFormData` import and use `LotteryFormInput` instead

### 5.2 `src/components/lottery/LotteryEditDialog.tsx`

**Check imports:** Update TimeWindow import if present
```typescript
// CHANGE FROM:
import type { TimeWindow } from "~/app/types/LotteryTypes";

// TO:
import type { TimeWindow } from "~/lib/lottery-utils";
```

### 5.3 Other component files that import from `~/app/types/LotteryTypes`

Search for all files importing from `~/app/types/LotteryTypes` and update to:
- `TimeWindow` → import from `~/lib/lottery-utils`
- `LotteryFormInput` → import from `~/server/db/schema/lottery/lottery-entries.schema`

**Impact:** 3-5 files modified, 1-2 lines per file

---

## COMMIT 6: Update Member Profile Components for Nested Data Access

**Problem:** Components access flattened member profile data that no longer exists after COMMIT 1 refactoring. Need to update to use nested structure with optional chaining.

**Files to Modify:**

### 6.1 `src/components/lottery/member-profiles/MemberProfilesTable.tsx`

**Update all data access to use nested structure:**

```typescript
// Speed Profile Data - CHANGE FROM:
profile.speedTier
profile.averageMinutes
profile.adminPriorityAdjustment

// TO:
profile.memberSpeedProfile?.speedTier ?? "AVERAGE"
profile.memberSpeedProfile?.averageMinutes ?? null
profile.memberSpeedProfile?.adminPriorityAdjustment ?? 0

// Fairness Score Data - CHANGE FROM:
profile.fairnessScore
profile.fairnessDaysWithoutGoodTime
profile.fairnessPreferenceFulfillmentRate

// TO:
profile.fairnessScore?.fairnessScore ?? 0
profile.fairnessScore?.daysWithoutGoodTime ?? 0
profile.fairnessScore?.preferenceFulfillmentRate ?? 0
```

**Remove type import:**
```typescript
// REMOVE:
import type { MemberProfile } from "~/server/lottery/member-profiles-data";

// Components now use Drizzle's inferred types automatically
```

### 6.2 `src/components/lottery/SpeedProfileEditDialog.tsx`

**Update prop type and data access:**

```typescript
// CHANGE FROM:
interface SpeedProfileEditDialogProps {
  profile: MemberProfile;
  ...
}

// TO:
interface SpeedProfileEditDialogProps {
  profile: Awaited<ReturnType<typeof getMemberProfilesWithFairness>>[number];
  ...
}

// OR simpler, let TypeScript infer from the parent component
```

**Update all field access with optional chaining:**
```typescript
// CHANGE FROM:
defaultValues={{
  speedTier: profile.speedTier,
  averageMinutes: profile.averageMinutes,
  ...
}}

// TO:
defaultValues={{
  speedTier: profile.memberSpeedProfile?.speedTier ?? "AVERAGE",
  averageMinutes: profile.memberSpeedProfile?.averageMinutes ?? null,
  ...
}}
```

### 6.3 `src/app/(admin)/admin/lottery/member-profiles/page.tsx`

**Update any direct data access if present:**

```typescript
// Use optional chaining for nested data access
profile.memberSpeedProfile?.speedTier
profile.fairnessScore?.fairnessScore
```

**Notes:**
- Drizzle infers types automatically, so components get full type safety
- Optional chaining handles null/undefined cases gracefully
- No manual type definitions needed - TypeScript knows the shape from the query

**Impact:** 3 files modified, ~15-20 lines changed (primarily adding `?.` and `??` operators)

---

## COMMIT 7: Fix N+1 Query in getLotteryEntriesForDate

**Problem:** Makes N separate queries for group members instead of batch fetching

**Files to Modify:**

### 7.1 `src/server/lottery/data.ts`

**Lines 171-217:** Rewrite getLotteryEntriesForDate
```typescript
// REPLACE THIS:
const groupEntriesWithMembers = await Promise.all(
  groupEntries.map(async (group) => {
    const groupMembers = await db.query.members.findMany({
      where: inArray(members.id, group.memberIds),
      ...
    });
    return { ...group, members: groupMembers };
  })
);

// WITH THIS:
// Collect all unique member IDs from all groups
const allGroupMemberIds = [...new Set(
  groupEntries.flatMap(group => group.memberIds)
)];

// Fetch all members in one query
const allGroupMembers = allGroupMemberIds.length > 0
  ? await db.query.members.findMany({
      where: inArray(members.id, allGroupMemberIds),
      with: { memberClass: true },
    })
  : [];

// Create a map for O(1) lookup
const memberMap = new Map(allGroupMembers.map(m => [m.id, m]));

// Map members to groups
const groupEntriesWithMembers = groupEntries.map(group => ({
  ...group,
  members: group.memberIds.map(id => memberMap.get(id)!).filter(Boolean),
}));
```

**Impact:** 1 file modified, ~25 lines changed, significant performance improvement

---

## COMMIT 8: Fix N+1 Query in processLotteryForDate

**Problem:** calculateFairnessScore makes 2 DB queries per entry (fairness + speed)

**Files to Modify:**

### 8.1 `src/server/lottery/actions.ts`

**Lines 488-501:** Batch fetch fairness scores
```typescript
// BEFORE processing entries, add this:
const allMemberIds = [
  ...entries.individual.map(e => e.organizerId),
  ...entries.groups.map(g => g.organizerId),
];

// Batch fetch all fairness scores
const allFairnessScores = await db.query.memberFairnessScores.findMany({
  where: inArray(memberFairnessScores.memberId, allMemberIds),
});

// Batch fetch all speed profiles
const allSpeedProfiles = await db.query.memberSpeedProfiles.findMany({
  where: inArray(memberSpeedProfiles.memberId, allMemberIds),
});

// Create maps for O(1) lookup
const fairnessMap = new Map(allFairnessScores.map(f => [f.memberId, f]));
const speedMap = new Map(allSpeedProfiles.map(s => [s.memberId, s]));
```

**Lines 377-437:** Update calculateFairnessScore signature
```typescript
// CHANGE FROM:
async function calculateFairnessScore(entry: any, timeWindows: any[]): Promise<number> {
  const fairnessData = await db.query.memberFairnessScores.findFirst({...});
  const speedData = await db.query.memberSpeedProfiles.findFirst({...});
  ...
}

// TO:
function calculateFairnessScore(
  entry: { organizerId: number; preferredWindow: string },
  timeWindows: any[],
  fairnessMap: Map<number, MemberFairnessScore>,
  speedMap: Map<number, MemberSpeedProfile>
): number {
  const fairnessData = fairnessMap.get(entry.organizerId);
  const speedData = speedMap.get(entry.organizerId);
  ...
}
```

**Lines 489-501:** Update calls to calculateFairnessScore
```typescript
// CHANGE FROM:
const priority = await calculateFairnessScore(entry, timeWindows);

// TO:
const priority = calculateFairnessScore(entry, timeWindows, fairnessMap, speedMap);
```

**Impact:** 1 file modified, ~40 lines changed, massive performance improvement

---

## COMMIT 9: Standardize Revalidation Paths

**Problem:** Inconsistent revalidation paths across different actions

**Files to Modify:**

### 9.1 Create New File: `src/server/lottery/utils/revalidation.ts`

```typescript
// New file - Centralized revalidation helpers
import { revalidatePath } from "next/cache";

export function revalidateLotteryPaths(date?: string) {
  revalidatePath("/admin/lottery");
  revalidatePath("/admin/lottery/member-profiles");
  if (date) {
    revalidatePath(`/admin/lottery/${date}`);
  }
}

export function revalidateTeesheetPaths(date?: string) {
  revalidatePath("/admin/teesheet");
  revalidatePath("/members/teesheet");
  if (date) {
    revalidatePath(`/admin/${date}`);
  }
}

export function revalidateMemberProfilePaths() {
  revalidatePath("/admin/lottery/member-profiles");
  revalidatePath("/admin/lottery/[date]", "page");
}
```

### 9.2 `src/server/lottery/actions.ts`

**Add import at top:**
```typescript
import { revalidateLotteryPaths, revalidateTeesheetPaths } from "./utils/revalidation";
```

**Replace all revalidatePath calls:**
- Line ~170: `revalidateLotteryPaths()`
- Line ~212: `revalidateLotteryPaths()`
- Line ~284: `revalidateLotteryPaths()`
- Line ~310: `revalidateLotteryPaths()`
- Line ~368: `revalidateLotteryPaths()` + `revalidateTeesheetPaths(date)`
- Line ~696: `revalidateLotteryPaths(date)` + `revalidateTeesheetPaths(date)`
- And so on...

### 9.3 `src/server/lottery/member-profiles-actions.ts`

**Add import:**
```typescript
import { revalidateMemberProfilePaths } from "./utils/revalidation";
```

**Replace revalidatePath calls:**
- Lines 45-46: Replace with `revalidateMemberProfilePaths()`
- Lines 79-80: Replace with `revalidateMemberProfilePaths()`
- Lines 166-168: Replace with `revalidateMemberProfilePaths()`

**Impact:** 1 new file, 3 files modified, ~20 lines changed

---

## COMMIT 10: Add Responsive Breakpoints to Lottery Components

**Problem:** Missing iPad/tablet breakpoints in several components

**Files to Modify:**

### 10.1 `src/components/lottery/LotteryAllEntries.tsx`

**Find line with grid layout:**
```typescript
// CHANGE FROM:
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

// TO:
<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
```

### 10.2 `src/components/lottery/TeesheetPreviewAndArrange.tsx`

**Find unassigned entries grid:**
```typescript
// CHANGE FROM:
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

// TO:
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
```

**Add mobile-friendly drag instructions:**
```typescript
// Add notice for mobile users
{isMobile && (
  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
    <p className="text-sm text-blue-800">
      Tap an entry to select it, then tap a time block to assign.
    </p>
  </div>
)}
```

**Impact:** 2 files modified, ~5 lines changed

---

## COMMIT 11: Extract Test Data Generation

**Problem:** Test helpers mixed with business logic in actions.ts

**Files to Modify:**

### 11.1 Create New File: `src/server/lottery/test-helpers.ts`

**Move lines 1033-1323 from actions.ts:**
```typescript
"use server";

import { db } from "~/server/db";
import { lotteryEntries, members } from "~/server/db/schema";
import type { TimeWindow } from "~/server/db/schema/lottery/types";
import { revalidateLotteryPaths } from "./utils/revalidation";

export async function createTestLotteryEntries(date: string): Promise<ActionResult> {
  // ... entire function from actions.ts ...
}
```

### 11.2 `src/server/lottery/actions.ts`

**Lines 1033-1323:** DELETE entire createTestLotteryEntries function

**Add export:**
```typescript
export { createTestLotteryEntries } from "./test-helpers";
```

### 11.3 `src/components/lottery/LotteryDashboard.tsx`

**Update import:**
```typescript
// CHANGE FROM:
import { createTestLotteryEntries } from "~/server/lottery/actions";

// TO:
import { createTestLotteryEntries } from "~/server/lottery/test-helpers";
```

**Impact:** 1 new file, 2 files modified, ~290 lines moved

---

## COMMIT 12: Standardize Error Handling

**Problem:** Mixed error patterns (throw, null, ActionResult)

**Files to Modify:**

### 12.1 `src/server/lottery/data.ts`

**Lines 82-85:** Update error handling
```typescript
// CHANGE FROM:
return null;
} catch (error) {
  console.error("Error getting lottery entry data:", error);
  throw error;
}

// TO:
return null;
} catch (error) {
  console.error("Error getting lottery entry data:", error);
  return null; // Don't throw, return null consistently
}
```

**Similar changes for all data.ts functions:**
- Line 162: getLotteryStatsForDate - return null on error
- Line 215: getLotteryEntriesForDate - return empty arrays
- Line 271: getAvailableTimeBlocksForDate - return empty array

**Impact:** 1 file modified, ~8 lines changed

---

## COMMIT 13: Document SpeedBonusConfiguration Status

**Problem:** Incomplete feature with TODO comment, unclear status

**Files to Modify:**

### 13.1 `src/components/lottery/SpeedBonusConfiguration.tsx`

**Line 46:** Update TODO with detailed plan
```typescript
// REPLACE:
// TODO: Implement save to database/settings

// WITH:
// TODO: Implement save to database/settings
// Options:
// 1. Add speedBonusConfig table to schema
// 2. Store as JSONB in teesheetConfig
// 3. Store as JSONB in systemSettings table
// Decision needed before implementation
```

**Add comment at file top:**
```typescript
/**
 * SpeedBonusConfiguration Component
 *
 * STATUS: UI Complete, Backend NOT Implemented
 * This component currently saves to local state only.
 * Changes are NOT persisted to the database.
 *
 * See line 46 TODO for implementation options.
 */
```

**Impact:** 1 file modified, ~10 lines added (documentation)

---

## Summary

**Total Commits:** 13 isolated changes
**Files Created:** 2 (revalidation.ts, test-helpers.ts)
**Files Modified:** ~15
**Files Deleted:** 1 (LotteryTypes.ts)
**Lines Changed:** ~400

Each commit is independent and can be reviewed/tested separately.

---

## Recommended Order

1. **Commits 1-6**: Type system foundation & component updates (must be done sequentially)
2. **Commits 7-8**: Performance improvements (can be done in parallel after 1-6)
3. **Commits 9-13**: Code organization & polish (can be done in any order)

---

## Testing Checklist

After each commit:
- [ ] Run TypeScript compilation: `pnpm build` or `pnpm type-check`
- [ ] Verify no type errors
- [ ] Test affected functionality in browser
- [ ] Commit changes with descriptive message
