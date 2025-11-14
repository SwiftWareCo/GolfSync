# Load Testing Guide

 

This directory contains Artillery-based load tests for GolfSync.

 

## Prerequisites

 

1. **Install Artillery:**

   ```bash

   npm install --save-dev artillery

   ```

 

2. **Deploy Application:**

   Load tests require a deployed instance (staging or production).

 

3. **Get Authentication Cookies:**

 

   **For regular member cookie:**

   - Login as a member in your browser

   - Open DevTools → Application → Cookies

   - Find your session cookie (usually `__session` for Clerk)

   - Copy the entire cookie string

 

   **For admin cookie:**

   - Login as an admin

   - Repeat the same process

 

## Running Tests

 

### Quick Test (Single Endpoint)

 

Test a single endpoint quickly:

 

```bash

# Set your environment

export LOAD_TEST_URL="https://golfsync.vercel.app"

 

# Quick test - 10 users making 100 requests

npx artillery quick --count 10 --num 100 $LOAD_TEST_URL/api/health

```

 

### Full Test Suite

 

Run all load test scenarios:

 

```bash

# 1. Set environment variables

export LOAD_TEST_URL="https://golfsync.vercel.app"

export LOAD_TEST_AUTH_COOKIE="your-member-session-cookie"

export LOAD_TEST_ADMIN_COOKIE="your-admin-session-cookie"

 

# 2. Navigate to load tests directory

cd tests/load

 

# 3. Run all tests

./run-tests.sh

```

 

### Individual Tests

 

Run specific test scenarios:

 

```bash

# Teesheet Viewing (4 minutes, 100 concurrent users)

artillery run teesheet-viewing.yml --output reports/teesheet.json

artillery report reports/teesheet.json --output reports/teesheet.html

 

# Concurrent Bookings (40 seconds, spike load)

artillery run concurrent-bookings.yml --output reports/bookings.json

artillery report reports/bookings.json --output reports/bookings.html

 

# Lottery Processing (30 seconds, 150 entries)

artillery run lottery-processing.yml --output reports/lottery.json

artillery report reports/lottery.json --output reports/lottery.html

```

 

## Test Scenarios

 

### 1. Teesheet Viewing

 

**Purpose:** Verify system handles 100 concurrent users viewing teesheets

 

**Metrics:**

- Response time p95 < 500ms

- Response time p99 < 1000ms

- Error rate < 1%

 

**Duration:** 4 minutes (60s warmup, 120s ramp, 60s sustained)

 

### 2. Concurrent Bookings

 

**Purpose:** Verify no double-bookings under concurrent load

 

**Metrics:**

- No time blocks exceed capacity

- Response time p95 < 500ms

- Some users get "time block full" (expected)

 

**Duration:** 40 seconds (spike load simulating lottery rush)

 

**Verification:**

After test, verify integrity:

```bash

LOAD_TEST_DATE=2025-11-21 node test-helpers.js verify-bookings

```

 

### 3. Lottery Processing

 

**Purpose:** Verify lottery can process 100+ entries efficiently

 

**Metrics:**

- Lottery processing < 10 seconds

- All entries processed correctly

- Fairness algorithm completes

 

**Duration:** 30 seconds (150 submissions + processing)

 

## Analyzing Results

 

### HTML Reports

 

Artillery generates interactive HTML reports with:

- Response time distribution

- Requests per second

- Error rates

- Percentile latencies (p50, p95, p99)

- Timeline view

 

Open in browser:

```bash

open reports/teesheet-viewing.html

```

 

### Key Metrics to Check

 

**Response Times:**

- p50 (median): Should be < 200ms

- p95: Should be < 500ms

- p99: Should be < 1000ms

- Max: Note any outliers > 2000ms

 

**Error Rates:**

- Target: < 1% errors

- 404 errors: Check if routes are correct

- 401 errors: Check authentication cookies

- 500 errors: Check application logs

 

**Throughput:**

- Requests per second sustained

- Virtual users active

- Test duration

 

### Interpreting Results

 

✅ **Good Performance:**

- p95 response time < 500ms

- Error rate < 1%

- No database connection errors

- Stable throughput

 

⚠️ **Needs Investigation:**

- p95 response time 500-1000ms

- Error rate 1-5%

- Occasional timeouts

- Throughput degradation over time

 

❌ **Performance Issues:**

- p95 response time > 1000ms

- Error rate > 5%

- Consistent timeouts

- Database connection saturation

 

## Troubleshooting

 

### "Invalid Cookie" or 401 Errors

 

Your session cookie expired or is incorrect.

 

**Fix:**

1. Re-login to the application

2. Get fresh cookies from DevTools

3. Update environment variables

4. Re-run tests

 

### High Response Times (> 1s)

 

Possible causes:

- Database not scaled appropriately

- Missing indexes on queries

- Network latency

- Cold start (serverless functions)

 

**Investigation:**

1. Check Neon dashboard for slow queries

2. Check Vercel function logs

3. Run tests during off-peak hours

4. Increase database tier if needed

 

### Connection Errors

 

**Artillery can't reach server:**

- Check LOAD_TEST_URL is correct

- Check server is deployed and running

- Check firewall/security group settings

 

**Database connection errors:**

- Check Neon connection limit (100 for free tier)

- Monitor connections during test

- Reduce concurrent users if saturated

 

### Booking Test Shows Double Bookings

 

This is a critical bug!

 

**Steps:**

1. Note the time block IDs with double bookings

2. Check application logs for race conditions

3. Review time block booking logic

4. Ensure proper database transactions

5. Add database constraints if needed

 

## Adding New Tests

 

Create a new YAML file in this directory:

 

```yaml

# my-new-test.yml

config:

  target: "{{ $processEnvironment.LOAD_TEST_URL }}"

  phases:

    - duration: 60

      arrivalRate: 10

      name: "Test phase"

  processor: "./test-helpers.js"

 

scenarios:

  - name: "My Test Scenario"

    flow:

      - function: "setAuthHeaders"

      - get:

          url: "/my-endpoint"

          headers:

            Cookie: "{{ authCookie }}"

          expect:

            - statusCode: 200

```

 

Add to `run-tests.sh`:

```bash

artillery run my-new-test.yml --output reports/my-new-test.json

artillery report reports/my-new-test.json --output reports/my-new-test.html

```

 

## Best Practices

 

1. **Test Against Staging First**

   - Never run load tests against production without warning

   - Use a staging environment when possible

 

2. **Start Small**

   - Begin with 10 concurrent users

   - Gradually increase load

   - Find breaking points carefully

 

3. **Monitor During Tests**

   - Watch Vercel function logs

   - Monitor Neon database dashboard

   - Check error tracking (Sentry)

 

4. **Document Results**

   - Save reports for comparison

   - Note any issues found

   - Track improvements over time

 

5. **Run Regularly**

   - Before major releases

   - After performance optimizations

   - Monthly for baseline monitoring

 

## CI/CD Integration

 

Add to GitHub Actions workflow:

 

```yaml

# .github/workflows/load-test.yml

name: Load Tests

 

on:

  workflow_dispatch:  # Manual trigger only

  schedule:

    - cron: '0 2 * * 1'  # Weekly on Monday 2am

 

jobs:

  load-test:

    runs-on: ubuntu-latest

    steps:

      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3

      - run: npm install -g artillery

      - run: |

          cd tests/load

          export LOAD_TEST_URL="${{ secrets.STAGING_URL }}"

          export LOAD_TEST_AUTH_COOKIE="${{ secrets.LOAD_TEST_AUTH }}"

          export LOAD_TEST_ADMIN_COOKIE="${{ secrets.LOAD_TEST_ADMIN }}"

          ./run-tests.sh

      - uses: actions/upload-artifact@v3

        with:

          name: load-test-reports

          path: tests/load/reports/

```

 

## Resources

 

- [Artillery Documentation](https://www.artillery.io/docs)

- [Writing Test Scenarios](https://www.artillery.io/docs/guides/guides/test-script-reference)

- [CI/CD Integration](https://www.artillery.io/docs/guides/integration-guides/ci-cd)

 

## Support

 

If you encounter issues with load testing:

1. Check Artillery documentation

2. Review application logs

3. Contact DevOps team

4. File issue in GitHub repository