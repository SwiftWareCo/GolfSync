/**

 * Load Testing Helper Functions

 * Provides authentication and test data generation for Artillery load tests

 */

 

// Preferred time windows for lottery

const WINDOWS = ['EARLY_MORNING', 'MORNING', 'MIDDAY', 'AFTERNOON'];

 

/**

 * Set authentication headers from environment variables

 *

 * Required environment variables:

 * - LOAD_TEST_AUTH_COOKIE: Regular member session cookie

 * - LOAD_TEST_ADMIN_COOKIE: Admin session cookie

 *

 * To get cookies:

 * 1. Login to the app in browser

 * 2. Open DevTools → Application → Cookies

 * 3. Copy the entire cookie string

 */

export function setAuthHeaders(context, events, done) {

  // Set auth cookies from environment

  context.vars.authCookie = process.env.LOAD_TEST_AUTH_COOKIE || '';

  context.vars.adminAuthCookie = process.env.LOAD_TEST_ADMIN_COOKIE || '';

 

  if (!context.vars.authCookie) {

    console.warn('⚠️  LOAD_TEST_AUTH_COOKIE not set. Tests may fail.');

  }

 

  if (!context.vars.adminAuthCookie) {

    console.warn('⚠️  LOAD_TEST_ADMIN_COOKIE not set. Admin tests may fail.');

  }

 

  return done();

}

 

/**

 * Generate random booking data

 * Creates realistic booking attempts for load testing

 */

export function generateBookingData(context, events, done) {

  // Generate random member ID (1-100)

  context.vars.memberId = Math.floor(Math.random() * 100) + 1;

 

  // Generate random time block ID (1-20)

  // In real scenarios, you'd fetch available time blocks first

  context.vars.timeBlockId = Math.floor(Math.random() * 20) + 1;

 

  return done();

}

 

/**

 * Generate random lottery entry data

 * Creates realistic lottery submissions with various preferences

 */

export function generateLotteryData(context, events, done) {

  // Random member ID

  context.vars.memberId = Math.floor(Math.random() * 100) + 1;

 

  // Random preferred window

  const preferredIndex = Math.floor(Math.random() * WINDOWS.length);

  context.vars.preferredWindow = WINDOWS[preferredIndex];

 

  // Random alternate window (different from preferred)

  const alternateWindows = WINDOWS.filter((_, i) => i !== preferredIndex);

  context.vars.alternateWindow = alternateWindows[

    Math.floor(Math.random() * alternateWindows.length)

  ];

 

  return done();

}

 

/**

 * Verify no double bookings after load test

 * Run this manually after concurrent booking tests

 *

 * Usage:

 *   LOAD_TEST_DATE=2025-11-21 node test-helpers.js verify-bookings

 */

async function verifyNoDoubleBookings() {

  const { db } = await import('../../src/server/db/index.js');

  const { timeBlockMembers, timeBlocks } = await import('../../src/server/db/schema.js');

  const { eq, sql } = await import('drizzle-orm');

 

  const testDate = process.env.LOAD_TEST_DATE;

  if (!testDate) {

    console.error('❌ LOAD_TEST_DATE environment variable required');

    process.exit(1);

  }

 

  console.log(`\n📊 Verifying bookings for ${testDate}...\n`);

 

  // Check for time blocks exceeding capacity

  const overbooked = await db

    .select({

      timeBlockId: timeBlockMembers.timeBlockId,

      count: sql`count(*)`.as('count'),

      maxMembers: timeBlocks.maxMembers,

    })

    .from(timeBlockMembers)

    .innerJoin(timeBlocks, eq(timeBlockMembers.timeBlockId, timeBlocks.id))

    .where(eq(timeBlockMembers.bookingDate, testDate))

    .groupBy(timeBlockMembers.timeBlockId, timeBlocks.maxMembers)

    .having(sql`count(*) > ${timeBlocks.maxMembers}`);

 

  if (overbooked.length === 0) {

    console.log('✅ No double bookings detected!');

    console.log('✅ All time blocks within capacity');

    return true;

  } else {

    console.error('❌ DOUBLE BOOKINGS DETECTED:');

    console.table(overbooked);

    return false;

  }

}

 

/**

 * Generate test report summary

 */

export function generateReportSummary(context, events, done) {

  // Artillery automatically generates detailed reports

  // This is a placeholder for custom metrics if needed

 

  return done();

}

 

// CLI usage

if (process.argv[2] === 'verify-bookings') {

  verifyNoDoubleBookings()

    .then((success) => process.exit(success ? 0 : 1))

    .catch((error) => {

      console.error('❌ Verification failed:', error);

      process.exit(1);

    });

}