#!/bin/bash

 

# Load Testing Suite for GolfSync

# Runs all load test scenarios and generates reports

 

set -e  # Exit on error

 

# Colors for output

RED='\033[0;31m'

GREEN='\033[0;32m'

YELLOW='\033[1;33m'

BLUE='\033[0;34m'

NC='\033[0m' # No Color

 

# Check if Artillery is installed

if ! command -v artillery &> /dev/null; then

    echo -e "${RED}❌ Artillery is not installed${NC}"

    echo "Install it with: npm install --save-dev artillery"

    exit 1

fi

 

# Check environment variables

if [ -z "$LOAD_TEST_URL" ]; then

    echo -e "${RED}❌ LOAD_TEST_URL environment variable not set${NC}"

    echo "Example: export LOAD_TEST_URL=https://golfsync.vercel.app"

    exit 1

fi

 

if [ -z "$LOAD_TEST_AUTH_COOKIE" ]; then

    echo -e "${YELLOW}⚠️  LOAD_TEST_AUTH_COOKIE not set. Some tests may fail.${NC}"

fi

 

if [ -z "$LOAD_TEST_ADMIN_COOKIE" ]; then

    echo -e "${YELLOW}⚠️  LOAD_TEST_ADMIN_COOKIE not set. Admin tests may fail.${NC}"

fi

 

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}  GolfSync Load Testing Suite${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""

echo -e "Target URL: ${GREEN}$LOAD_TEST_URL${NC}"

echo ""

 

# Create reports directory if it doesn't exist

mkdir -p reports

 

# Test 1: Teesheet Viewing

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Test 1: Teesheet Viewing (100 concurrent users)${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""

echo "📊 Running teesheet viewing load test..."

echo "   Duration: 4 minutes"

echo "   Virtual users: 100 concurrent"

echo "   Target: Response time p95 < 500ms"

echo ""

 

artillery run teesheet-viewing.yml \

  --output reports/teesheet-viewing.json \

  || echo -e "${RED}Test 1 failed or had errors${NC}"

 

echo ""

echo -e "${GREEN}✓ Test 1 complete${NC}"

echo ""

 

# Test 2: Concurrent Bookings

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Test 2: Concurrent Bookings${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""

echo "📊 Running concurrent bookings test..."

echo "   Duration: 40 seconds (spike load)"

echo "   Peak rate: 50 bookings/10 seconds"

echo "   Target: No double-bookings"

echo ""

 

artillery run concurrent-bookings.yml \

  --output reports/concurrent-bookings.json \

  || echo -e "${RED}Test 2 failed or had errors${NC}"

 

echo ""

echo -e "${GREEN}✓ Test 2 complete${NC}"

echo ""

echo -e "${YELLOW}⚠️  Important: Verify no double-bookings with:${NC}"

echo "   LOAD_TEST_DATE=2025-11-21 node test-helpers.js verify-bookings"

echo ""

 

# Test 3: Lottery Processing

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Test 3: Lottery Processing${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""

echo "📊 Running lottery processing test..."

echo "   Duration: 30 seconds"

echo "   Entries: 150 lottery submissions"

echo "   Target: Process in < 10 seconds"

echo ""

 

artillery run lottery-processing.yml \

  --output reports/lottery-processing.json \

  || echo -e "${RED}Test 3 failed or had errors${NC}"

 

echo ""

echo -e "${GREEN}✓ Test 3 complete${NC}"

echo ""

 

# Generate HTML Reports

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Generating HTML Reports${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""

 

artillery report reports/teesheet-viewing.json \

  --output reports/teesheet-viewing.html \

  && echo -e "${GREEN}✓ Teesheet viewing report generated${NC}"

 

artillery report reports/concurrent-bookings.json \

  --output reports/concurrent-bookings.html \

  && echo -e "${GREEN}✓ Concurrent bookings report generated${NC}"

 

artillery report reports/lottery-processing.json \

  --output reports/lottery-processing.html \

  && echo -e "${GREEN}✓ Lottery processing report generated${NC}"

 

echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${GREEN}✅ All load tests complete!${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""

echo "📊 Reports generated in: tests/load/reports/"

echo ""

echo "HTML Reports:"

echo "  - teesheet-viewing.html"

echo "  - concurrent-bookings.html"

echo "  - lottery-processing.html"

echo ""

echo -e "${YELLOW}Next Steps:${NC}"

echo "  1. Open HTML reports in your browser"

echo "  2. Verify all metrics meet targets"

echo "  3. Run verification: LOAD_TEST_DATE=2025-11-21 node test-helpers.js verify-bookings"

echo "  4. Document results in PHASE_12_COMPLETE.md"

echo ""