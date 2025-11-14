# Edge Case Testing Matrix

 

**Phase:** 13 - Edge Case Testing & Bug Fixes

**Date:** November 13, 2025

**Status:** In Progress

 

---

 

## Testing Categories

 

This document tracks comprehensive edge case testing across 7 major categories with 50+ edge cases.

 

**Legend:**

- ✅ **PASS** - Works as expected

- ❌ **FAIL** - Bug found (needs fix)

- ⚠️ **PARTIAL** - Partial handling (needs improvement)

- 🔄 **FIXED** - Bug fixed in this phase

- 📝 **DOCUMENTED** - Known limitation documented

 

---

 

## Category 1: Concurrent Operations

 

| # | Edge Case | Expected Behavior | Actual Behavior | Status | Notes |

|---|-----------|-------------------|-----------------|--------|-------|

| 1.1 | Two users booking same time slot simultaneously | One succeeds, one gets "time block full" error | | ⏳ Testing | Database transaction handling |

| 1.2 | Admin publishes teesheet while member is viewing | Member sees updated state on next interaction | | ⏳ Testing | React Query cache invalidation |

| 1.3 | Two admins editing same member simultaneously | Last write wins (optimistic locking) | | ⏳ Testing | No database-level locking |

| 1.4 | Lottery drawn while entries being added | New entries not included in current draw | | ⏳ Testing | Status-based filtering |

| 1.5 | Member added to time block while being deleted | Operation fails with clear error | | ⏳ Testing | Foreign key constraints |

| 1.6 | Time block deleted while member being added | Add operation fails gracefully | | ⏳ Testing | Cascade delete handling |

| 1.7 | Multiple admins processing same lottery | First completes, others get error | | ⏳ Testing | Status transitions |

| 1.8 | Admin updates settings while member booking | Booking uses settings snapshot | | ⏳ Testing | Settings caching |

 

---

 

## Category 2: Data Integrity

 

| # | Edge Case | Expected Behavior | Actual Behavior | Status | Notes |

|---|-----------|-------------------|-----------------|--------|-------|

| 2.1 | Member deleted with active bookings | Cascade delete removes bookings | | ⏳ Testing | `onDelete: "cascade"` |

| 2.2 | Teesheet deleted with bookings | Cascade deletes time blocks + members | | ⏳ Testing | Foreign key cascade |

| 2.3 | Time block capacity exceeded | Insert fails, returns error | | ⏳ Testing | Application-level check needed |

| 2.4 | Lottery with zero entries | Process returns "no entries" message | | ⏳ Testing | Empty array handling |

| 2.5 | Lottery with single entry | Awards slot to single entry | | ⏳ Testing | Edge case in algorithm |

| 2.6 | Duplicate lottery entry same date | Unique constraint prevents duplicate | | ⏳ Testing | Database constraint |

| 2.7 | Orphaned time block members (no member) | Prevented by foreign key | | ⏳ Testing | Database integrity |

| 2.8 | Orphaned lottery entries (deleted member) | Cascade delete removes entry | | ⏳ Testing | Foreign key constraint |

| 2.9 | Negative fairness score | Prevented by validation | | ⏳ Testing | Input validation |

| 2.10 | Fairness score overflow (> max integer) | Clamped to maximum | | ⏳ Testing | Integer limits |

 

---

 

## Category 3: Network Issues

 

| # | Edge Case | Expected Behavior | Actual Behavior | Status | Notes |

|---|-----------|-------------------|-----------------|--------|-------|

| 3.1 | Booking during network interruption | Retry logic activates (2 retries) | | ⏳ Testing | React Query retry |

| 3.2 | Weather API timeout | Uses cached weather, logs error | | ⏳ Testing | Try/catch + Sentry |

| 3.3 | Database connection lost | Neon auto-reconnects, returns error | | ⏳ Testing | Serverless handles |

| 3.4 | Push notification delivery failure | Logs error, doesn't block operation | | ⏳ Testing | Non-critical failure |

| 3.5 | Partial form submission | Form state preserved on error | | ⏳ Testing | React state |

| 3.6 | Network drops mid-mutation | Mutation fails, user notified | | ⏳ Testing | Error handling |

| 3.7 | Slow network (> 30s timeout) | Operation times out, retries | | ⏳ Testing | Timeout handling |

| 3.8 | Intermittent connectivity | Retry with exponential backoff | | ⏳ Testing | Retry strategy |

 

---

 

## Category 4: User Input Edge Cases

 

| # | Edge Case | Expected Behavior | Actual Behavior | Status | Notes |

|---|-----------|-------------------|-----------------|--------|-------|

| 4.1 | Extremely long name (> 50 chars) | Truncated or rejected | | ⏳ Testing | Varchar(50) limit |

| 4.2 | Special characters in name (', ", `) | Properly escaped in queries | | ⏳ Testing | Drizzle escaping |

| 4.3 | Emoji in member name (👋) | Stored correctly or rejected | | ⏳ Testing | UTF-8 support |

| 4.4 | SQL injection attempt | Safely escaped by Drizzle | | ⏳ Testing | ORM protection |

| 4.5 | XSS attempt in notes | Sanitized on display | | ⏳ Testing | React escaping |

| 4.6 | Negative charge amount | Rejected by validation | | ⏳ Testing | Zod schema |

| 4.7 | Charge amount > max (999999) | Rejected by validation | | ⏳ Testing | Schema validation |

| 4.8 | Invalid email format | Rejected by validation | | ⏳ Testing | Email schema |

| 4.9 | Invalid phone format | Rejected by validation | | ⏳ Testing | Phone schema |

| 4.10 | Date string in wrong format | Rejected by validation | | ⏳ Testing | Date schema |

| 4.11 | Future date > 365 days | Rejected by range validation | | ⏳ Testing | Date range check |

| 4.12 | Past date for booking | Rejected by validation | | ⏳ Testing | Future date check |

| 4.13 | Leap year date (Feb 29) | Handled correctly | | ⏳ Testing | Date library |

| 4.14 | DST transition dates | Timezone library handles | | ⏳ Testing | date-fns-tz |

| 4.15 | Invalid handicap (> 54) | Accepted but noted | | ⏳ Testing | No strict validation |

| 4.16 | Handicap with + symbol (+5) | Parsed correctly | | ⏳ Testing | String handling |

| 4.17 | Empty required fields | Rejected by validation | | ⏳ Testing | Required fields |

| 4.18 | Whitespace-only input | Trimmed and rejected | | ⏳ Testing | String trimming |

 

---

 

## Category 5: Mobile & Browser Edge Cases

 

| # | Edge Case | Expected Behavior | Actual Behavior | Status | Notes |

|---|-----------|-------------------|-----------------|--------|-------|

| 5.1 | iOS Safari PWA installation | Install prompt works, app installs | | 📱 Manual | Requires iOS device |

| 5.2 | Android Chrome PWA installation | Install banner, app installs | | 📱 Manual | Requires Android |

| 5.3 | Offline - view cached teesheet | Shows cached data | | 📱 Manual | Service worker |

| 5.4 | Offline - attempt booking | Shows "offline" error | | 📱 Manual | Network check |

| 5.5 | Screen width < 375px | Layout responsive, readable | | 🔧 DevTools | Mobile responsive |

| 5.6 | Screen width > 2560px | Content centered, not stretched | | 🔧 DevTools | Desktop responsive |

| 5.7 | Touch gestures on mobile | Drag/drop works smoothly | | 📱 Manual | Touch support |

| 5.8 | Landscape orientation mobile | Layout adapts correctly | | 📱 Manual | Orientation |

| 5.9 | Browser back button | Navigation works correctly | | ✅ Testing | Next.js routing |

| 5.10 | Multiple tabs same user | State syncs across tabs | | ✅ Testing | React Query |

 

---

 

## Category 6: Permission Edge Cases

 

| # | Edge Case | Expected Behavior | Actual Behavior | Status | Notes |

|---|-----------|-------------------|-----------------|--------|-------|

| 6.1 | User loses admin privileges mid-session | Next request fails with 403 | | ⏳ Testing | JWT re-check |

| 6.2 | User account disabled in Clerk | Next request fails with auth error | | ⏳ Testing | Clerk middleware |

| 6.3 | Session expires during booking | Redirected to login | | ⏳ Testing | Session check |

| 6.4 | Concurrent sessions same user | Both sessions work independently | | ⏳ Testing | Stateless JWT |

| 6.5 | Admin demoted to member | Can't access admin routes | | ⏳ Testing | Role check |

| 6.6 | Member promotes self to admin (JWT tampering) | Signature verification fails | | ⏳ Testing | JWT security |

| 6.7 | User tries admin action without permission | 403 Forbidden error | | ⏳ Testing | Auth middleware |

| 6.8 | Expired JWT token | Auto-refresh or re-login | | ⏳ Testing | Clerk handling |

 

---

 

## Category 7: Business Logic Edge Cases

 

| # | Edge Case | Expected Behavior | Actual Behavior | Status | Notes |

|---|-----------|-------------------|-----------------|--------|-------|

| 7.1 | Booking on defined holiday | Allowed (no holiday calendar yet) | | ⏳ Testing | Future feature |

| 7.2 | Booking in past (time travel bug) | Rejected by validation | | ⏳ Testing | Date validation |

| 7.3 | Member class change during lottery entry | Uses class at submission time | | ⏳ Testing | Snapshot data |

| 7.4 | Lottery entry after deadline | Rejected (status check) | | ⏳ Testing | Status validation |

| 7.5 | Lottery results finalized twice | Second finalize is no-op | | ⏳ Testing | Idempotency |

| 7.6 | Member in multiple time blocks same day | Allowed (no restriction) | | ⏳ Testing | Business rule |

| 7.7 | Guest count exceeds time block capacity | Validation prevents | | ⏳ Testing | Capacity check |

| 7.8 | Power cart assigned to empty time block | Allowed (pre-assignment) | | ⏳ Testing | Business rule |

| 7.9 | Charge created for non-existent member | Foreign key prevents | | ⏳ Testing | Database constraint |

| 7.10 | Fairness score reset mid-month | Only resets on scheduled job | | ⏳ Testing | Cron timing |

| 7.11 | Time zone mismatch (server vs client) | BC timezone enforced | | ⏳ Testing | date-fns-tz |

| 7.12 | Teesheet with zero time blocks | Allowed (can add later) | | ⏳ Testing | Business logic |

| 7.13 | Lottery with all entries for same window | Algorithm distributes fairly | | ⏳ Testing | Lottery algorithm |

| 7.14 | Member with no fairness score | Defaults to zero | | ⏳ Testing | Default value |

 

---

 

## Critical Bugs Found

 

### 🔴 High Priority

 

| Bug ID | Description | Impact | Status | Fix ETA |

|--------|-------------|--------|--------|---------|

| | (To be populated during testing) | | | |

 

### 🟡 Medium Priority

 

| Bug ID | Description | Impact | Status | Fix ETA |

|--------|-------------|--------|--------|---------|

| | (To be populated during testing) | | | |

 

### 🟢 Low Priority

 

| Bug ID | Description | Impact | Status | Fix ETA |

|--------|-------------|--------|--------|---------|

| | (To be populated during testing) | | | |

 

---

 

## Testing Methodology

 

### Automated Testing

- Run existing 524 unit tests

- Add new edge case tests to test suite

- Use Artillery for concurrent operation testing

 

### Manual Testing

- Browser DevTools for mobile simulation

- Physical device testing for PWA

- Multiple user sessions for concurrency

 

### Database Testing

- Direct SQL queries to verify constraints

- Test cascade deletes

- Check foreign key integrity

 

---

 

## Test Execution Log

 

| Date | Tester | Category | Edge Cases Tested | Bugs Found | Notes |

|------|--------|----------|-------------------|------------|-------|

| | | | | | |

 

---

 

## Known Limitations

 

(To be documented after testing)

 

---

 

## Recommendations

 

(To be populated after testing)

 

---

 

**Next Steps:**

1. Execute tests systematically by category

2. Document all findings in this matrix

3. Fix critical bugs immediately

4. Document non-critical bugs for backlog

5. Create automated tests for fixed bugs