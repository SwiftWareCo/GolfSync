# Application Monitoring Guide

 

**Date:** November 13, 2025

**Version:** 1.0

**Status:** Production Ready

 

---

 

## Overview

 

GolfSync uses a multi-layered monitoring approach combining Vercel's built-in analytics, health check endpoints, and application logging to ensure reliable production operation.

 

---

 

## Table of Contents

 

1. [Vercel Analytics](#vercel-analytics)

2. [Vercel Speed Insights](#vercel-speed-insights)

3. [Health Check Endpoint](#health-check-endpoint)

4. [Cron Job Monitoring](#cron-job-monitoring)

5. [Logging Strategy](#logging-strategy)

6. [Alerts and Notifications](#alerts-and-notifications)

7. [Troubleshooting](#troubleshooting)

 

---

 

## Vercel Analytics

 

### What It Tracks

 

Vercel Analytics provides real-time insights into:

- **Page Views** - Track which pages users visit

- **User Sessions** - Understand user engagement

- **Traffic Sources** - See where users come from

- **Device Types** - Desktop vs mobile usage

- **Geographic Distribution** - Where users are located

 

### Setup

 

✅ **Already Configured**

 

Analytics are automatically enabled in `src/app/layout.tsx`:

 

```typescript

import { Analytics } from "@vercel/analytics/react";

 

export default function RootLayout({ children }) {

  return (

    <html>

      <body>

        {children}

        <Analytics />

      </body>

    </html>

  );

}

```

 

### Accessing Analytics

 

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)

2. Select your project (GolfSync)

3. Click "Analytics" tab

4. View real-time data and historical trends

 

### Key Metrics to Monitor

 

| Metric | What It Means | Action If Abnormal |

|--------|---------------|-------------------|

| Total Page Views | User engagement | Investigate if drops significantly |

| Unique Visitors | User growth | Check marketing/SEO if declining |

| Avg. Session Duration | User satisfaction | Improve UX if low |

| Bounce Rate | First impression | Optimize landing pages if high |

| Top Pages | Popular features | Focus development on popular areas |

 

---

 

## Vercel Speed Insights

 

### What It Tracks

 

Speed Insights monitors Core Web Vitals:

- **LCP (Largest Contentful Paint)** - Loading performance

- **FID (First Input Delay)** - Interactivity

- **CLS (Cumulative Layout Shift)** - Visual stability

- **TTFB (Time To First Byte)** - Server response time

 

### Setup

 

✅ **Already Configured**

 

Speed Insights are enabled in `src/app/layout.tsx`:

 

```typescript

import { SpeedInsights } from "@vercel/speed-insights/next";

 

export default function RootLayout({ children }) {

  return (

    <html>

      <body>

        {children}

        <SpeedInsights />

      </body>

    </html>

  );

}

```

 

### Accessing Speed Insights

 

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)

2. Select your project

3. Click "Speed Insights" tab

4. View performance metrics by page

 

### Core Web Vitals Targets

 

| Metric | Good | Needs Improvement | Poor |

|--------|------|-------------------|------|

| **LCP** | ≤ 2.5s | 2.5s - 4.0s | > 4.0s |

| **FID** | ≤ 100ms | 100ms - 300ms | > 300ms |

| **CLS** | ≤ 0.1 | 0.1 - 0.25 | > 0.25 |

| **TTFB** | ≤ 800ms | 800ms - 1800ms | > 1800ms |

 

### Performance Optimization Tips

 

**If LCP is slow:**

- Optimize images (use Next.js Image component)

- Reduce server response time

- Minimize render-blocking resources

 

**If FID is high:**

- Reduce JavaScript bundle size

- Code-split large components

- Defer non-critical JavaScript

 

**If CLS is high:**

- Set explicit dimensions for images

- Reserve space for dynamic content

- Use CSS aspect-ratio for responsive media

 

---

 

## Health Check Endpoint

 

### Endpoint

 

```

GET /api/health

```

 

### What It Checks

 

The health check endpoint verifies:

1. **Database Connectivity** - Can we connect to Neon PostgreSQL?

2. **Weather Updates** - Is the weather cron job running?

3. **System Resources** - Memory usage, uptime

4. **Application Version** - Current deployment version

 

### Response Format

 

**Healthy Response (200 OK):**

 

```json

{

  "status": "healthy",

  "timestamp": "2025-11-13T11:48:00.000Z",

  "checks": {

    "database": {

      "status": "connected",

      "message": "Database connection successful"

    },

    "weather": {

      "lastUpdate": "2025-11-13T11:45:00.000Z",

      "updateAge": "180s",

      "status": "running",

      "message": "Weather updates are current"

    }

  },

  "system": {

    "version": "1.0.0",

    "uptime": 3600,

    "memory": {

      "used": 50000000,

      "total": 100000000

    },

    "environment": "production"

  },

  "performance": {

    "responseTime": "15ms"

  }

}

```

 

**Unhealthy Response (503 Service Unavailable):**

 

```json

{

  "status": "unhealthy",

  "timestamp": "2025-11-13T11:48:00.000Z",

  "checks": {

    "database": {

      "status": "disconnected",

      "message": "Database connection failed"

    },

    "weather": {

      "lastUpdate": "2025-11-13T10:00:00.000Z",

      "updateAge": "6480s",

      "status": "stale",

      "message": "Weather updates are stale (>30 minutes)"

    }

  },

  ...

}

```

 

### Usage

 

**Manual Testing:**

 

```bash

# Check health status

curl https://your-app.vercel.app/api/health

 

# Check with verbose output

curl -v https://your-app.vercel.app/api/health

```

 

**Uptime Monitoring Services:**

 

Configure your uptime monitor (e.g., UptimeRobot, Pingdom, StatusCake) to:

- Check `/api/health` every 5 minutes

- Alert if status code is not 200

- Alert if response time > 5 seconds

 

**Load Balancer Health Checks:**

 

If using a load balancer, configure it to:

- Health check path: `/api/health`

- Healthy threshold: 200 status code

- Unhealthy threshold: 2 consecutive failures

- Interval: 30 seconds

 

### Health Check Thresholds

 

| Component | Healthy | Unhealthy |

|-----------|---------|-----------|

| Database | Connected | Connection fails |

| Weather Updates | < 30 minutes old | > 30 minutes old |

| Response Time | < 1 second | > 5 seconds |

| Memory Usage | < 80% | > 90% |

 

---

 

## Cron Job Monitoring

 

### Weather Update Cron

 

**Endpoint:** `POST /api/cron/update-weather`

 

**Schedule:** Every 15 minutes

 

**Configuration (Vercel):**

 

```json

{

  "crons": [

    {

      "path": "/api/cron/update-weather",

      "schedule": "*/15 * * * *"

    }

  ]

}

```

 

### Monitoring Cron Execution

 

**Vercel Logs:**

 

1. Go to Vercel Dashboard → Your Project

2. Click "Deployments" → Select current deployment

3. Click "Functions" → Find cron function

4. View execution logs

 

**Check Last Execution:**

 

```bash

curl https://your-app.vercel.app/api/health | jq '.checks.weather'

```

 

Output:

```json

{

  "lastUpdate": "2025-11-13T11:45:00.000Z",

  "updateAge": "180s",

  "status": "running",

  "message": "Weather updates are current"

}

```

 

### Cron Failure Alerts

 

**Indicators of Cron Failure:**

- Weather `status: "stale"` in health check

- Weather `updateAge` > 30 minutes

- Error logs in Vercel function logs

 

**Troubleshooting Failed Cron:**

 

1. **Check Vercel Cron Configuration:**

   - Verify cron is enabled in `vercel.json`

   - Check cron schedule is correct

 

2. **Check Environment Variables:**

   - Ensure `CRON_SECRET` is set

   - Verify `WEATHER_API_KEY` is valid

 

3. **Check API Limits:**

   - Weather API may have rate limits

   - Check if API key is expired

 

4. **Manual Trigger:**

   ```bash

   curl -X POST https://your-app.vercel.app/api/cron/update-weather \

     -H "Authorization: Bearer YOUR_CRON_SECRET"

   ```

 

---

 

## Logging Strategy

 

### What Gets Logged

 

**Application Logs:**

- Authentication failures

- Authorization denials

- Data modifications (via audit log)

- Cron job execution

- Weather API failures

- Database errors

 

**Automatic Logging:**

- All `console.log()` statements

- All `console.error()` statements

- All `console.warn()` statements

- Uncaught exceptions

- API route errors

 

### Log Levels

 

| Level | When to Use | Example |

|-------|-------------|---------|

| `console.log()` | Info/debug | "User logged in" |

| `console.warn()` | Warnings | "Rate limit approaching" |

| `console.error()` | Errors | "Database connection failed" |

 

### Accessing Logs

 

**Vercel Logs (Real-time):**

 

1. Go to Vercel Dashboard

2. Select deployment

3. Click "Functions" or "Runtime Logs"

4. Filter by severity, function, time

 

**CLI Access:**

 

```bash

# Install Vercel CLI

npm i -g vercel

 

# Login

vercel login

 

# View logs

vercel logs your-app-url

```

 

### Log Retention

 

- **Vercel Hobby Plan:** 1 day

- **Vercel Pro Plan:** 7 days

- **Vercel Enterprise:** 30+ days (configurable)

 

For longer retention, consider:

- Logtail (free tier available)

- DataDog Logs

- Sentry (also provides logs)

- CloudWatch (if using AWS)

 

---

 

## Alerts and Notifications

 

### Recommended Alerts

 

**Critical (Immediate Action):**

- Database connection fails (health check 503)

- Application is down (health check unreachable)

- Error rate > 5% of requests

 

**Warning (Investigate Soon):**

- Weather cron is stale (> 30 minutes)

- Response time > 2 seconds

- Memory usage > 80%

 

**Info (Monitor):**

- Traffic spike (> 2x normal)

- New error types appearing

- Core Web Vitals degrading

 

### Setting Up Alerts

 

**UptimeRobot (Free Tier):**

 

1. Create account at [uptimerobot.com](https://uptimerobot.com)

2. Add Monitor:

   - Monitor Type: HTTP(s)

   - URL: `https://your-app.vercel.app/api/health`

   - Monitoring Interval: 5 minutes

   - Alert Contacts: Your email/SMS

3. Configure Alert:

   - Trigger: When status code ≠ 200

   - Notification: Email + SMS

 

**Vercel Monitoring (Pro):**

 

Vercel Pro plan includes:

- Deployment health monitoring

- Performance degradation alerts

- Error rate alerts

- Custom metrics (with integrations)

 

**Sentry Alerts:**

 

If using Sentry (from Phase 7):

- Configure error rate alerts

- Set up performance alerts

- Slack/email notifications

 

---

 

## Troubleshooting

 

### Common Issues

 

**Issue 1: Health check returns 503**

 

**Symptoms:**

```json

{

  "status": "unhealthy",

  "checks": {

    "database": {

      "status": "disconnected"

    }

  }

}

```

 

**Solutions:**

1. Check Neon dashboard - is database online?

2. Check `POSTGRES_URL` environment variable

3. Check database connection limits

4. Check network connectivity

 

---

 

**Issue 2: Weather updates are stale**

 

**Symptoms:**

```json

{

  "checks": {

    "weather": {

      "status": "stale",

      "updateAge": "3600s"

    }

  }

}

```

 

**Solutions:**

1. Check Vercel cron is configured

2. Check cron execution logs

3. Verify `WEATHER_API_KEY` is valid

4. Check weather API rate limits

5. Manually trigger cron to test

 

---

 

**Issue 3: Analytics not showing data**

 

**Symptoms:**

- Vercel Analytics dashboard is empty

- No page views recorded

 

**Solutions:**

1. Ensure `<Analytics />` component is in layout

2. Check deployment includes latest code

3. Wait 5-10 minutes for data propagation

4. Check ad blockers aren't blocking analytics

5. Verify project is on Vercel (not localhost)

 

---

 

**Issue 4: Slow response times**

 

**Symptoms:**

- Health check `responseTime > 1000ms`

- Speed Insights showing poor TTFB

 

**Solutions:**

1. Check database query performance

2. Review Vercel function logs for slow operations

3. Consider database query optimization

4. Check for N+1 query problems

5. Enable database connection pooling

 

---

 

## Monitoring Checklist

 

Use this checklist for regular monitoring:

 

**Daily:**

- [ ] Check Vercel Analytics for traffic anomalies

- [ ] Review error logs for new issues

- [ ] Verify health check is returning 200

 

**Weekly:**

- [ ] Review Speed Insights trends

- [ ] Check weather cron execution success rate

- [ ] Review memory usage trends

- [ ] Check for new dependency vulnerabilities (`npm audit`)

 

**Monthly:**

- [ ] Review Core Web Vitals improvements

- [ ] Analyze user engagement metrics

- [ ] Check database performance trends

- [ ] Review and optimize slow queries

- [ ] Update monitoring thresholds if needed

 

---

 

## Advanced Monitoring (Optional)

 

For production at scale, consider:

 

**Session Replay:**

- **LogRocket** - See exactly what users experience

- **FullStory** - User session recording

- **Hotjar** - Heatmaps and recordings

 

**Application Performance Monitoring (APM):**

- **New Relic** - Full-stack APM

- **DataDog** - Infrastructure + APM

- **Dynatrace** - AI-powered monitoring

 

**Custom Metrics:**

- **Prometheus** - Time-series metrics

- **Grafana** - Visualization dashboards

- **InfluxDB** - Time-series database

 

**Real User Monitoring (RUM):**

- Vercel Web Analytics (already enabled)

- Google Analytics 4

- Matomo (open-source alternative)

 

---

 

## Related Documentation

 

- [PHASE_10_COMPLETE.md](./PHASE_10_COMPLETE.md) - Phase 10 implementation details

- [Vercel Analytics Docs](https://vercel.com/docs/analytics)

- [Vercel Speed Insights Docs](https://vercel.com/docs/speed-insights)

- [Vercel Cron Jobs Docs](https://vercel.com/docs/cron-jobs)

 

---

 

**Last Updated:** 2025-11-13

**Phase:** 10 - Application Monitoring & Health Checks

**Status:** ✅ Complete