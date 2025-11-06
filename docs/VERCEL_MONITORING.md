# Vercel Monitoring & Analytics Setup for GolfSync

This guide covers setting up Vercel's built-in monitoring tools for your GolfSync application.

## Overview

Vercel provides three main monitoring tools:

1. **Vercel Analytics** - Page views, visitor stats, top pages
2. **Vercel Speed Insights** - Core Web Vitals, performance metrics
3. **Runtime Logs** - Server-side logs and errors

**Cost:** All three are FREE for Hobby and Pro plans with generous limits.

---

## 1. Vercel Analytics

### What It Provides

- Page views and unique visitors
- Top pages by traffic
- Referrer sources
- User geography
- Device and browser breakdown
- Real-time visitor tracking

### Setup (5 minutes)

#### Step 1: Enable in Vercel Dashboard

1. Go to your project in Vercel dashboard
2. Navigate to **Analytics** tab
3. Click **Enable Analytics**
4. Select data retention period (90 days free)

#### Step 2: Install SDK

```bash
npm install @vercel/analytics
```

#### Step 3: Add to Your App

```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

#### Step 4: Deploy and Verify

1. Deploy to Vercel: `git push`
2. Visit your site and navigate a few pages
3. Go to Vercel Dashboard → Analytics
4. You should see data within 5-10 minutes

### Custom Events (Optional)

Track custom user actions:

```typescript
// Example: Track teesheet booking
import { track } from '@vercel/analytics';

export async function bookTimeSlot(memberId: number, timeBlockId: number) {
  try {
    // Your booking logic
    const result = await addMemberToTimeBlock(memberId, timeBlockId);

    // Track successful booking
    track('booking_created', {
      memberId,
      timeBlockId,
      success: true,
    });

    return result;
  } catch (error) {
    track('booking_failed', {
      memberId,
      timeBlockId,
      success: false,
      error: error.message,
    });
    throw error;
  }
}
```

**Recommended Custom Events:**
- `teesheet_viewed`
- `booking_created`
- `booking_cancelled`
- `lottery_entry_created`
- `event_registration`
- `push_notification_subscribed`

---

## 2. Vercel Speed Insights

### What It Provides

- **Core Web Vitals:**
  - LCP (Largest Contentful Paint)
  - FID (First Input Delay)
  - CLS (Cumulative Layout Shift)
  - FCP (First Contentful Paint)
  - TTFB (Time to First Byte)
  - INP (Interaction to Next Paint)
- **Performance Score:** Overall score (0-100)
- **Real User Monitoring:** Data from actual users
- **Device Breakdown:** Desktop vs Mobile performance

### Setup (3 minutes)

#### Step 1: Enable in Vercel Dashboard

1. Go to your project in Vercel dashboard
2. Navigate to **Speed Insights** tab
3. Click **Enable Speed Insights**

#### Step 2: Install SDK

```bash
npm install @vercel/speed-insights
```

#### Step 3: Add to Your App

```typescript
// src/app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

#### Step 4: Deploy and Verify

1. Deploy to Vercel
2. Visit your site
3. Go to Vercel Dashboard → Speed Insights
4. Data appears within 24 hours

### Performance Targets for GolfSync

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** | < 2.5s | 2.5s - 4s | > 4s |
| **FID** | < 100ms | 100ms - 300ms | > 300ms |
| **CLS** | < 0.1 | 0.1 - 0.25 | > 0.25 |
| **FCP** | < 1.8s | 1.8s - 3s | > 3s |
| **TTFB** | < 800ms | 800ms - 1.8s | > 1.8s |

**Goal:** Keep all metrics in "Good" range for 75% of users.

---

## 3. Runtime Logs

### What It Provides

- Server-side console logs
- Function invocation logs
- Error logs
- Cold start tracking
- Execution duration

### Setup (No code required!)

Runtime logs are automatically collected. Access them via:

1. Go to Vercel Dashboard → **Deployments**
2. Click on a deployment
3. Navigate to **Functions** tab
4. Click on any function to see logs

### Best Practices for Logging

#### Use Structured Logging

```typescript
// Good: Structured logging
console.log(JSON.stringify({
  action: 'createTeesheet',
  date: '2025-11-04',
  userId: 'user_123',
  duration: 234,
  success: true,
}));

// Bad: Unstructured logging
console.log('Created teesheet for 2025-11-04');
```

#### Log Levels

```typescript
// Error (always log)
console.error('Failed to create teesheet:', error);

// Warning (important issues)
console.warn('Member approaching booking limit');

// Info (important events)
console.log('Teesheet published successfully');

// Debug (development only)
if (process.env.NODE_ENV === 'development') {
  console.debug('Booking validation passed', data);
}
```

#### Add Context to Logs

```typescript
// src/lib/logger.ts
export function logAction(
  action: string,
  data: Record<string, unknown>,
  duration?: number
) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    duration,
    ...data,
  }));
}

// Usage
logAction('createTeesheet', { date: '2025-11-04', userId: 'user_123' }, 234);
```

---

## 4. Health Check Monitoring

Create a health check endpoint for monitoring:

```typescript
// src/app/api/health/route.ts
import { db } from '~/server/db';
import { weatherCache } from '~/server/db/schema';
import { desc } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connectivity
    await db.select().from(weatherCache).limit(1);

    // Get last weather update
    const lastWeatherUpdate = await db
      .select()
      .from(weatherCache)
      .orderBy(desc(weatherCache.lastUpdated))
      .limit(1);

    const dbDuration = Date.now() - startTime;

    // Check if weather is stale (> 20 minutes)
    const lastUpdate = lastWeatherUpdate[0]?.lastUpdated;
    const weatherStale = lastUpdate
      ? Date.now() - new Date(lastUpdate).getTime() > 20 * 60 * 1000
      : true;

    return Response.json({
      status: weatherStale ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'healthy',
          responseTime: dbDuration,
        },
        weather: {
          status: weatherStale ? 'stale' : 'healthy',
          lastUpdate: lastUpdate?.toISOString() ?? null,
        },
      },
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return Response.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
```

### Test Health Check

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T20:15:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 45
    },
    "weather": {
      "status": "healthy",
      "lastUpdate": "2025-11-04T20:00:00.000Z"
    }
  },
  "version": "abc1234"
}
```

---

## 5. Uptime Monitoring (External)

While Vercel provides great monitoring, it's recommended to use an external uptime monitor:

### Recommended Free Services:

1. **UptimeRobot** (Free)
   - https://uptimerobot.com
   - 50 monitors free
   - 5-minute checks
   - Email/SMS alerts
2. **Better Uptime** (Free tier)
   - https://betteruptime.com
   - 10 monitors free
   - 3-minute checks
   - Status page
3. **Pingdom** (Free tier)
   - https://www.pingdom.com
   - 1 monitor free
   - 1-minute checks

### Setup UptimeRobot (Recommended)

1. Sign up at https://uptimerobot.com
2. Create new monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://your-app.vercel.app/api/health`
   - **Interval:** 5 minutes
   - **Alert Contacts:** Your email
3. Test monitor

---

## 6. Dashboard Setup

### Create a Monitoring Dashboard

Track these key metrics:

#### Application Health
- ✅ Uptime (target: 99.9%)
- ✅ Health check status
- ✅ Error rate (target: < 0.5%)
- ✅ Response time (target: p95 < 500ms)

#### User Engagement
- 📊 Daily active users
- 📊 Page views per session
- 📊 Top pages
- 📊 Booking conversion rate

#### Performance
- ⚡ Core Web Vitals scores
- ⚡ Page load times
- ⚡ Server response times
- ⚡ Database query times

#### Business Metrics
- 🎯 Teesheets created per day
- 🎯 Bookings per day
- 🎯 Lottery participation rate
- 🎯 Event registration rate

### Sample Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  GolfSync Monitoring Dashboard                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Status: 🟢 All Systems Operational                 │
│  Uptime: 99.98% (30 days)                           │
│  Active Users: 45                                   │
│                                                      │
├──────────────┬──────────────┬────────────────────────┤
│  Response    │  Error Rate  │  Core Web Vitals       │
│  Time        │              │                        │
│  245ms       │  0.12%       │  LCP: 1.8s ✅          │
│  ✅ Good     │  ✅ Good     │  FID: 45ms ✅          │
│              │              │  CLS: 0.05 ✅          │
├──────────────┴──────────────┴────────────────────────┤
│  Recent Activity                                     │
│  • Teesheet created for 2025-11-05                  │
│  • 12 bookings in last hour                         │
│  • Lottery drawn successfully                       │
└─────────────────────────────────────────────────────┘
```

---

## 7. Alert Configuration

### Critical Alerts (Immediate Response)

1. **Application Down**
   - Trigger: Health check fails 3 times
   - Action: SMS + Email to on-call team
   - Response: Within 15 minutes
2. **High Error Rate**
   - Trigger: Error rate > 5% for 5 minutes
   - Action: Email to dev team
   - Response: Within 1 hour
3. **Database Issues**
   - Trigger: Database connection fails
   - Action: SMS + Email to on-call team
   - Response: Immediate

### Warning Alerts (Monitor Closely)

1. **Degraded Performance**
   - Trigger: p95 response time > 1s for 10 minutes
   - Action: Email to dev team
   - Response: Within 4 hours
2. **Stale Weather Data**
   - Trigger: Weather not updated in 30 minutes
   - Action: Email notification
   - Response: Within 2 hours
3. **Low Core Web Vitals**
   - Trigger: Any Core Web Vital in "Poor" range
   - Action: Email weekly summary
   - Response: Review in next sprint

---

## 8. Monitoring Checklist

### Daily (First Week)
- [ ] Check Vercel Analytics for traffic
- [ ] Review Speed Insights scores
- [ ] Check Runtime Logs for errors
- [ ] Verify health check endpoint
- [ ] Review Sentry error count

### Weekly (Ongoing)
- [ ] Review performance trends
- [ ] Check uptime percentage
- [ ] Analyze user engagement metrics
- [ ] Review error patterns
- [ ] Check quota usage (Vercel/Sentry)

### Monthly
- [ ] Performance optimization review
- [ ] Cost analysis (Vercel/Sentry)
- [ ] Update alert thresholds
- [ ] Review monitoring coverage
- [ ] Team retrospective on incidents

---

## 9. Troubleshooting

### Analytics Not Showing Data

1. Check `<Analytics />` is in layout
2. Verify deployment is live
3. Wait 10-15 minutes for data
4. Check browser console for errors

### Speed Insights Not Working

1. Check `<SpeedInsights />` is in layout
2. Deploy to production (doesn't work in dev)
3. Wait 24 hours for data collection
4. Ensure site has traffic

### Runtime Logs Missing

1. Logs are only available for 24-48 hours
2. Check you're viewing correct deployment
3. Ensure `console.log` statements exist
4. Check function execution in Vercel dashboard

---

## 10. Cost Breakdown

| Service | Free Tier | Paid Plans |
|---------|-----------|------------|
| **Vercel Analytics** | 100k events/month | $10/month for 1M events |
| **Speed Insights** | Unlimited | Included |
| **Runtime Logs** | 24-48hr retention | 7-day retention on Pro |
| **UptimeRobot** | 50 monitors | $7/month for more |

**Estimated Monthly Cost:** $0 (free tier sufficient for most golf clubs)

---

## Quick Reference: Monitoring URLs

```bash
# Production site
https://your-app.vercel.app

# Health check
https://your-app.vercel.app/api/health

# Vercel Dashboard
https://vercel.com/your-team/your-project

# Analytics
https://vercel.com/your-team/your-project/analytics

# Speed Insights
https://vercel.com/your-team/your-project/speed-insights

# Runtime Logs
https://vercel.com/your-team/your-project/deployments
```

---

## Next Steps

1. ✅ Enable Vercel Analytics
2. ✅ Enable Speed Insights
3. ✅ Create health check endpoint
4. ✅ Setup uptime monitoring
5. ✅ Configure alerts
6. ✅ Create monitoring dashboard
7. ✅ Document incident response
8. ✅ Train team on monitoring

---

**Monitoring complete!** 🎉 Your application is now fully monitored with Vercel's tools.

For advanced monitoring needs, consider:
- **LogRocket** - Session replay and frontend monitoring
- **DataDog** - Full-stack APM and infrastructure monitoring
- **New Relic** - Application performance monitoring