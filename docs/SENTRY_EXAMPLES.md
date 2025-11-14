# Sentry Integration Examples

 

This document provides examples of how to use Sentry error tracking and performance monitoring throughout the GolfSync application.

 

## Table of Contents

 

1. [Server Actions](#server-actions)

2. [API Routes](#api-routes)

3. [Client Components](#client-components)

4. [Database Operations](#database-operations)

5. [Error Boundaries](#error-boundaries)

6. [Manual Error Tracking](#manual-error-tracking)

7. [Performance Monitoring](#performance-monitoring)

8. [User Context](#user-context)

 

---

 

## Server Actions

 

### Basic Server Action with Sentry

 

```typescript

"use server";

 

import { withSentry } from "~/lib/sentry-server";

import { db } from "~/server/db";

import { members } from "~/server/db/schema";

 

// Wrap your server action with withSentry for automatic tracking

export const createMember = withSentry("createMember", async (data: MemberData) => {

  const [member] = await db.insert(members).values(data).returning();

  return { success: true, data: member };

});

```

 

### Manual Integration (Advanced)

 

```typescript

"use server";

 

import * as Sentry from "@sentry/nextjs";

import { initSentryUser } from "~/lib/sentry-server";

 

export async function updateMemberAction(id: number, data: UpdateData) {

  return Sentry.startSpan(

    { name: "updateMember", op: "function.server_action" },

    async () => {

      try {

        // Initialize user context

        await initSentryUser();

 

        // Your logic here

        const result = await db.update(members).set(data).where(eq(members.id, id));

 

        return { success: true, data: result };

      } catch (error) {

        Sentry.captureException(error, {

          tags: { action: "updateMember", memberId: id.toString() },

        });

        return { success: false, error: "Failed to update member" };

      }

    }

  );

}

```

 

---

 

## API Routes

 

### GET Route with Sentry

 

```typescript

// app/api/members/route.ts

import { NextRequest, NextResponse } from "next/server";

import { withSentryAPI } from "~/lib/sentry-server";

 

export const GET = withSentryAPI("GET /api/members", async (request: NextRequest) => {

  const members = await db.select().from(membersTable);

  return NextResponse.json({ members });

});

```

 

### POST Route with Custom Error Handling

 

```typescript

// app/api/bookings/route.ts

import { NextRequest, NextResponse } from "next/server";

import * as Sentry from "@sentry/nextjs";

import { initSentryUser } from "~/lib/sentry-server";

 

export async function POST(request: NextRequest) {

  return Sentry.startSpan({ name: "POST /api/bookings", op: "http.server" }, async () => {

    try {

      await initSentryUser();

 

      const body = await request.json();

 

      // Validate input

      if (!body.date || !body.time) {

        return NextResponse.json(

          { error: "Missing required fields" },

          { status: 400 }

        );

      }

 

      // Your booking logic here

      const booking = await createBooking(body);

 

      return NextResponse.json({ success: true, booking });

    } catch (error) {

      Sentry.captureException(error, {

        tags: { route: "POST /api/bookings" },

        extra: { body: await request.json() },

      });

 

      return NextResponse.json(

        { error: "Failed to create booking" },

        { status: 500 }

      );

    }

  });

}

```

 

---

 

## Client Components

 

### Using Error Boundaries

 

```typescript

// app/members/page.tsx

import { ErrorBoundary } from "~/components/ErrorBoundary";

import MembersList from "~/components/members/MembersList";

 

export default function MembersPage() {

  return (

    <ErrorBoundary

      fallback={

        <div className="p-4">

          <h2>Failed to load members</h2>

          <p>Please try refreshing the page.</p>

        </div>

      }

    >

      <MembersList />

    </ErrorBoundary>

  );

}

```

 

### Manual Error Tracking in Components

 

```typescript

"use client";

 

import { useState } from "react";

import * as Sentry from "@sentry/nextjs";

import { captureException, addUserActionBreadcrumb } from "~/lib/sentry";

 

export function BookingForm() {

  const [error, setError] = useState<string | null>(null);

 

  const handleSubmit = async (data: BookingData) => {

    try {

      addUserActionBreadcrumb("Submit booking form", { date: data.date });

 

      const response = await fetch("/api/bookings", {

        method: "POST",

        body: JSON.stringify(data),

      });

 

      if (!response.ok) {

        throw new Error("Failed to create booking");

      }

 

      const result = await response.json();

      // Handle success

    } catch (error) {

      setError("Failed to create booking");

 

      // Capture the error with context

      captureException(error, {

        tags: { component: "BookingForm" },

        extra: { bookingData: data },

      });

    }

  };

 

  return (

    <form onSubmit={handleSubmit}>

      {/* Form fields */}

      {error && <div className="error">{error}</div>}

    </form>

  );

}

```

 

### Setting User Context in Client Components

 

```typescript

"use client";

 

import { useEffect } from "react";

import { useUser } from "@clerk/nextjs";

import { setSentryUser } from "~/lib/sentry";

 

export function UserContextProvider({ children }: { children: React.ReactNode }) {

  const { user } = useUser();

 

  useEffect(() => {

    if (user) {

      setSentryUser(user);

    }

  }, [user]);

 

  return <>{children}</>;

}

```

 

---

 

## Database Operations

 

### Wrapped Database Query

 

```typescript

import { withSentryDB } from "~/lib/sentry-server";

import { db } from "~/server/db";

import { members } from "~/server/db/schema";

 

export async function getMembers() {

  return withSentryDB("select", "members", async () => {

    return db.select().from(members);

  });

}

```

 

### Complex Database Operation

 

```typescript

import { instrumentDatabaseQuery } from "~/lib/sentry";

import { db } from "~/server/db";

 

export async function updateMemberWithLottery(memberId: number, data: UpdateData) {

  return instrumentDatabaseQuery("update_with_lottery", "members", async () => {

    // Start a transaction

    return db.transaction(async (tx) => {

      // Update member

      const [member] = await tx

        .update(members)

        .set(data)

        .where(eq(members.id, memberId))

        .returning();

 

      // Update lottery entries

      await tx

        .update(lotteryEntries)

        .set({ memberName: `${data.firstName} ${data.lastName}` })

        .where(eq(lotteryEntries.memberId, memberId));

 

      return member;

    });

  });

}

```

 

---

 

## Error Boundaries

 

### Wrapping Entire Route Segment

 

```typescript

// app/admin/layout.tsx

import { ErrorBoundary } from "~/components/ErrorBoundary";

 

export default function AdminLayout({ children }: { children: React.ReactNode }) {

  return (

    <ErrorBoundary showDetails={process.env.NODE_ENV === "development"}>

      <div className="admin-layout">

        <AdminSidebar />

        <main>{children}</main>

      </div>

    </ErrorBoundary>

  );

}

```

 

### Wrapping Specific Components

 

```typescript

import { ErrorBoundary } from "~/components/ErrorBoundary";

import ComplexChart from "./ComplexChart";

 

export function Dashboard() {

  return (

    <div>

      <h1>Dashboard</h1>

 

      {/* Wrap potentially problematic components */}

      <ErrorBoundary

        fallback={<div>Chart temporarily unavailable</div>}

        onError={(error, errorInfo) => {

          console.error("Chart error:", error);

        }}

      >

        <ComplexChart />

      </ErrorBoundary>

 

      {/* Rest of dashboard */}

    </div>

  );

}

```

 

---

 

## Manual Error Tracking

 

### Capturing Custom Errors

 

```typescript

import { captureException, captureMessage } from "~/lib/sentry";

 

// Capture an exception with custom context

try {

  await processLottery();

} catch (error) {

  captureException(error, {

    tags: {

      operation: "lottery_processing",

      severity: "critical",

    },

    extra: {

      lotteryId: lottery.id,

      participantCount: participants.length,

    },

    level: "error",

    fingerprint: ["lottery-processing-error", lottery.id.toString()],

  });

 

  throw error; // Re-throw if needed

}

 

// Capture an informational message

captureMessage("Lottery processing completed", {

  level: "info",

  tags: {

    operation: "lottery_processing",

  },

  extra: {

    lotteryId: lottery.id,

    winnersCount: winners.length,

  },

});

```

 

### Adding Breadcrumbs

 

```typescript

import {

  addBreadcrumb,

  addUserActionBreadcrumb,

  addDataOperationBreadcrumb,

} from "~/lib/sentry";

 

// Generic breadcrumb

addBreadcrumb("Started lottery processing", "lottery", {

  lotteryId: lottery.id,

});

 

// User action breadcrumb

addUserActionBreadcrumb("Clicked create booking button", {

  date: selectedDate,

});

 

// Data operation breadcrumb

addDataOperationBreadcrumb("create", "bookings", bookingId);

```

 

---

 

## Performance Monitoring

 

### Measuring Operations

 

```typescript

import { measureAsync, measureSync, measureDatabaseQuery } from "~/lib/sentry";

 

// Measure an async operation

const results = await measureAsync("complex-calculation", async () => {

  return performComplexCalculation();

});

 

// Measure a sync operation

const data = measureSync("data-transformation", () => {

  return transformData(rawData);

});

 

// Measure a database query

const members = await measureDatabaseQuery("SELECT * FROM members", async () => {

  return db.select().from(membersTable);

});

```

 

### Custom Transactions

 

```typescript

import { startTransaction } from "~/lib/sentry";

 

export async function processLotteryWithMonitoring(lotteryId: number) {

  const transaction = startTransaction("process-lottery", "lottery");

 

  try {

    // Step 1: Fetch lottery

    const fetchSpan = transaction.startChild({

      op: "db.query",

      description: "Fetch lottery data",

    });

    const lottery = await fetchLottery(lotteryId);

    fetchSpan.finish();

 

    // Step 2: Process entries

    const processSpan = transaction.startChild({

      op: "function",

      description: "Process lottery entries",

    });

    const winners = await processEntries(lottery);

    processSpan.finish();

 

    // Step 3: Send notifications

    const notifySpan = transaction.startChild({

      op: "http.client",

      description: "Send winner notifications",

    });

    await sendNotifications(winners);

    notifySpan.finish();

 

    transaction.setStatus("ok");

  } catch (error) {

    transaction.setStatus("internal_error");

    throw error;

  } finally {

    transaction.finish();

  }

}

```

 

---

 

## User Context

 

### Server-Side User Context

 

```typescript

"use server";

 

import { initSentryUser } from "~/lib/sentry-server";

 

export async function serverActionWithUserContext() {

  // Initialize user context at the start of the action

  const user = await initSentryUser();

 

  // All subsequent Sentry calls will include user context

  // ...

}

```

 

### Client-Side User Context

 

```typescript

"use client";

 

import { useEffect } from "react";

import { useUser } from "@clerk/nextjs";

import { setSentryUser, setSentryUserContext } from "~/lib/sentry";

 

export function App() {

  const { user } = useUser();

 

  useEffect(() => {

    if (user) {

      // Set user in Sentry

      setSentryUser(user);

 

      // Add additional user context

      setSentryUserContext({

        membershipType: user.publicMetadata?.membershipType,

        joinedDate: user.createdAt,

      });

    }

  }, [user]);

 

  return <>{/* Your app */}</>;

}

```

 

### Clearing User Context on Logout

 

```typescript

import { clearSentryUser } from "~/lib/sentry";

import { useClerk } from "@clerk/nextjs";

 

export function LogoutButton() {

  const { signOut } = useClerk();

 

  const handleLogout = async () => {

    // Clear Sentry user context

    clearSentryUser();

 

    // Sign out from Clerk

    await signOut();

  };

 

  return <button onClick={handleLogout}>Logout</button>;

}

```

 

---

 

## Best Practices

 

1. **Always wrap server actions** with `withSentry` or manually initialize user context

2. **Use error boundaries** at strategic points in your component tree

3. **Add breadcrumbs** for important user actions and data operations

4. **Tag errors appropriately** to make filtering and searching easier

5. **Don't log sensitive data** - use `beforeSend` hooks to filter PII

6. **Set appropriate sample rates** in production to control costs

7. **Use fingerprints** to group similar errors together

8. **Monitor performance** for critical operations (lottery processing, bookings)

9. **Test in development** to ensure errors are being captured correctly

10. **Review errors regularly** in the Sentry dashboard

 

---

 

## Testing Sentry Integration

 

### Trigger a Test Error (Development Only)

 

```typescript

// Add a test route: app/api/test-sentry/route.ts

import { NextResponse } from "next/server";

 

export async function GET() {

  if (process.env.NODE_ENV === "development") {

    throw new Error("Test Sentry error - this is intentional!");

  }

  return NextResponse.json({ message: "Sentry test only works in development" });

}

```

 

### Check Sentry Dashboard

 

After triggering test errors:

 

1. Go to your Sentry dashboard

2. Check the "Issues" tab for captured errors

3. Verify user context is attached

4. Check performance data in "Performance" tab

5. Review breadcrumbs for context

 

---

 

## Environment Variables

 

Make sure to set these in your `.env` file:

 

```bash

# Required

NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id

SENTRY_DSN=https://your-dsn@sentry.io/project-id

 

# Optional

NEXT_PUBLIC_SENTRY_ENVIRONMENT=production

SENTRY_ENVIRONMENT=production

 

# For source maps upload (optional)

SENTRY_AUTH_TOKEN=your_auth_token

SENTRY_ORG=your_org_slug

SENTRY_PROJECT=your_project_slug

```