# Sentry Setup Guide for GolfSync

This guide will walk you through integrating Sentry for error monitoring in your GolfSync application.

## Prerequisites

- Sentry account (free tier available at https://sentry.io)
- Access to Vercel environment variables

## Step 1: Create Sentry Project

1. Go to https://sentry.io and sign up or log in
2. Click "Create Project"
3. Select **Next.js** as your platform
4. Name your project: `golfsync-production`
5. Set your alert frequency preferences
6. Click "Create Project"

## Step 2: Install Sentry SDK

Run the following command in your project directory:

```bash
npm install @sentry/nextjs
```

## Step 3: Initialize Sentry Configuration

Run the Sentry setup wizard:

```bash
npx @sentry/wizard@latest -i nextjs
```

The wizard will:
- Create `sentry.client.config.ts`
- Create `sentry.server.config.ts`
- Create `sentry.edge.config.ts`
- Update `next.config.js` with Sentry webpack plugin
- Create `.sentryclirc` file

**IMPORTANT:** After the wizard completes, add `.sentryclirc` to your `.gitignore` file if it's not already there.

## Step 4: Configure Sentry Files

### sentry.client.config.ts

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,
  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // Filter out noise
  ignoreErrors: [
    // Random plugins/extensions
    'top.GLOBALS',
    // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    // Facebook borked
    'fb_xd_fragment',
    // Chrome extensions
    'chrome-extension://',
  ],
  beforeSend(event, hint) {
    // Filter out low-priority errors in production
    if (process.env.NODE_ENV === 'production') {
      // Don't send network errors for offline users
      if (event.exception?.values?.[0]?.type === 'NetworkError') {
        return null;
      }
    }
    return event;
  },
});
```

### sentry.server.config.ts

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  beforeSend(event, hint) {
    // Don't send errors from development
    if (process.env.NODE_ENV === 'development') {
      console.error('Sentry error (dev mode):', hint.originalException || hint.syntheticException);
      return null;
    }
    return event;
  },
});
```

### sentry.edge.config.ts

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
```

## Step 5: Add Environment Variables

### Local Development (.env.local)

Add your Sentry DSN to `.env.local`:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-public-key@o1234567.ingest.sentry.io/1234567
SENTRY_AUTH_TOKEN=your_auth_token_here
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=golfsync-production
```

### Vercel Production Environment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...` | Production, Preview, Development |
| `SENTRY_AUTH_TOKEN` | `your_token` | Production |
| `SENTRY_ORG` | `your-org-slug` | Production |
| `SENTRY_PROJECT` | `golfsync-production` | Production |

**To get your SENTRY_AUTH_TOKEN:**
1. Go to Sentry → Settings → Account → API → Auth Tokens
2. Create a new token with scope: `project:releases`
3. Copy and save the token

## Step 6: Update .gitignore

Add Sentry-related files to `.gitignore`:

```gitignore
# Sentry
.sentryclirc
.sentry-*
sentry-*-config.ts.map
```

## Step 7: Test Sentry Integration

Create a test page to verify Sentry is working:

```typescript
// src/app/sentry-test/page.tsx (temporary test page)
'use client';

import { Button } from '~/components/ui/button';

export default function SentryTestPage() {
  const throwError = () => {
    throw new Error('Sentry Test Error - This is expected!');
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Sentry Error Test</h1>
      <Button onClick={throwError}>
        Trigger Test Error
      </Button>
    </div>
  );
}
```

**Testing Steps:**
1. Run `npm run dev`
2. Visit `http://localhost:3000/sentry-test`
3. Click "Trigger Test Error"
4. Go to Sentry dashboard → Issues
5. You should see the test error appear within 1-2 minutes

**IMPORTANT:** Delete the test page after verification!

## Step 8: Integrate Sentry into Server Actions

Update your server actions to report errors to Sentry:

```typescript
// Example: src/server/teesheet/actions.ts
import * as Sentry from '@sentry/nextjs';

export async function createTeesheet(date: string) {
  try {
    // Your logic here
    const result = await db.insert(teesheets).values({ date }).returning();
    return { success: true, data: result[0] };
  } catch (error) {
    // Log to Sentry
    Sentry.captureException(error, {
      tags: {
        action: 'createTeesheet',
        feature: 'teesheet',
      },
      extra: {
        date,
      },
    });

    console.error('Failed to create teesheet:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

## Step 9: Setup User Context

Add user context to Sentry errors for better debugging:

```typescript
// src/components/providers/sentry-user-provider.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export function SentryUserProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        username: `${user.firstName} ${user.lastName}`,
        isAdmin: user.publicMetadata.isAdmin as boolean,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  return <>{children}</>;
}
```

Then wrap your app in the provider:

```typescript
// src/app/layout.tsx
import { SentryUserProvider } from '~/components/providers/sentry-user-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <SentryUserProvider>
            {/* Your other providers */}
            {children}
          </SentryUserProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
```

## Step 10: Configure Alerts

Setup alert rules in Sentry:

1. Go to Sentry → **Alerts** → **Create Alert Rule**
2. Create the following rules:

### Critical Errors Alert
- **Condition:** When the number of errors is more than 10 in 1 hour
- **Filter:** `level:error` OR `level:fatal`
- **Action:** Send email to team
- **Action:** Send Slack notification (if configured)

### New Issue Alert
- **Condition:** A new issue is created
- **Filter:** `level:error` OR `level:fatal`
- **Action:** Send email notification

### Performance Alert
- **Condition:** When transaction duration is above 2 seconds
- **Filter:** All transactions
- **Action:** Send email to team

## Step 11: Performance Monitoring (Optional)

Enable performance monitoring for your server actions:

```typescript
// src/server/teesheet/actions.ts
import * as Sentry from '@sentry/nextjs';

export async function getTeesheet(date: string) {
  return await Sentry.startSpan(
    {
      name: 'getTeesheet',
      op: 'db.query',
      attributes: { date },
    },
    async () => {
      // Your database query here
      const result = await db.query.teesheets.findFirst({
        where: eq(teesheets.date, date),
      });
      return result;
    }
  );
}
```

## Step 12: Source Maps Configuration

Ensure source maps are uploaded for better stack traces:

```javascript
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // Your existing config
};

module.exports = withSentryConfig(
  nextConfig,
  {
    // Sentry webpack plugin options
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
  },
  {
    // Sentry SDK options
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: '/monitoring',
    hideSourceMaps: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  }
);
```

## Step 13: Verify Production Deployment

After deploying to Vercel:

1. Check Vercel build logs for "Sentry: Source maps uploaded successfully"
2. Trigger a test error in production
3. Verify it appears in Sentry dashboard
4. Check that source maps are working (you see readable stack traces)
5. Verify user context is attached to errors

## Monitoring Best Practices

1. **Regular Review:** Check Sentry dashboard daily during first week
2. **Set Up Dashboards:** Create custom dashboards for key metrics
3. **Error Budget:** Set acceptable error rates (e.g., < 0.5% of requests)
4. **Performance Budget:** Set performance thresholds (e.g., p95 < 500ms)
5. **Release Tracking:** Tag releases in Sentry to track error trends

## Troubleshooting

### Source maps not working
- Verify `SENTRY_AUTH_TOKEN` is set in Vercel
- Check build logs for upload errors
- Ensure `.sentryclirc` is not in git

### Errors not appearing
- Check DSN is correct
- Verify environment variables in Vercel
- Check Sentry quota limits
- Ensure error rate limits aren't filtering events

### Too many errors
- Adjust sample rates in config
- Add filters in `beforeSend` hook
- Set up error grouping rules in Sentry

## Cost Optimization

Sentry free tier includes:
- 5,000 errors/month
- 10,000 performance units/month

To stay within limits:
1. Use `tracesSampleRate: 0.1` in production (10% sampling)
2. Filter noisy errors in `beforeSend`
3. Set up proper error grouping
4. Monitor quota usage in Sentry dashboard

## Next Steps

1. ✅ Install Sentry
2. ✅ Configure client/server/edge
3. ✅ Add environment variables
4. ✅ Test integration
5. ✅ Setup user context
6. ✅ Configure alerts
7. ✅ Integrate into server actions
8. ✅ Deploy to production
9. ✅ Monitor for first week
10. ✅ Refine alert rules based on data

---

## Quick Reference: Sentry Commands

```bash
# Test Sentry locally
npm run dev

# Build with Sentry
npm run build

# Check Sentry CLI
npx @sentry/cli --version

# Upload source maps manually
npx @sentry/cli releases files <release> upload-sourcemaps .next

# List releases
npx @sentry/cli releases list
```

## Support Resources

- Sentry Next.js Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Sentry Discord: https://discord.gg/sentry
- Vercel + Sentry Guide: https://vercel.com/integrations/sentry

---

**Setup complete!** Your application is now monitored with Sentry.