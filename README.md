# GolfSync

A simple application to help golf clubs manage members, track scores, and organize golf events.

## Testing

This project uses [Vitest](https://vitest.dev/) for unit and integration testing.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
src/
├── __tests__/
│   ├── setup.ts           # Test configuration
│   └── utils/
│       ├── db-mock.ts     # Database mocking utilities
│       ├── test-helpers.ts # Helper functions
│       └── sample.test.ts  # Sample tests
├── lib/
│   └── __tests__/
│       └── utils.test.ts   # Utility function tests
└── server/
    └── [feature]/
        └── __tests__/
            ├── actions.test.ts # Server action tests
            └── data.test.ts    # Data fetching tests
```

### Coverage Requirements

- **Lines:** 70%+
- **Functions:** 70%+
- **Branches:** 70%+
- **Statements:** 70%+

View coverage report: Open `coverage/index.html` after running `npm run test:coverage`

## Teesheet System Flow

### Configuration Management

1. **Teesheet Configurations**

   - Configurations define the rules for time block creation
   - Each config has:
     - Name (e.g., "Weekday", "Weekend")
     - Start time (e.g., "07:00")
     - End time (e.g., "19:00")
     - Interval (minutes between time blocks)
     - Max members per block (default: 4)
     - Active status

2. **Configuration Rules**
   - Rules determine which config to use based on:
     - Day of week (0-6, null for all)
     - Weekend status (true/false/null)
     - Start/end dates (optional)
     - Priority (higher = more important)
     - Active status

### Teesheet Creation Flow

1. **Daily Teesheet Creation**

   - When accessing a date:
     - System checks for existing teesheet
     - If none exists:
       1. Determines appropriate config based on rules
       2. Creates new teesheet with selected config
       3. Generates time blocks based on config settings
       4. Each time block can hold 0-4 members

2. **Time Block Management**

   - Time blocks are created in sequence based on:
     - Start time
     - End time
     - Interval
   - Each block has:
     - Start time
     - End time
     - Associated members (0-4)
     - Creation/update timestamps

3. **Member Management**
   - Members can be:
     - Added to time blocks (up to max per block)
     - Removed from time blocks
     - Searched by name or member number
   - Changes are reflected immediately in the UI

### Data Flow

1. **Database Schema**

   - `teesheets`: Daily teesheets
   - `teesheetConfigs`: Configuration templates
   - `teesheetConfigRules`: Rules for config selection
   - `timeBlocks`: Individual time slots
   - `timeBlockMembers`: Member assignments to time blocks
   - `members`: Member information

2. **API Flow**
   - Server components handle data fetching
   - Client components handle user interactions
   - Real-time updates using Next.js router refresh

## Roadmap

### Phase 1: Foundation
- [x] Set up Clerk for authentication
- [ ] Build out initial UI
- [x] Create database schema for members
- [x] Migrate member data using scripts
- [ ] Build SERVER COMPONENTS for member data
- [ ] Create member management interface
- [ ] Display member data in dashboard

### Phase 2: Core Features
- [ ] TEST
- [ ] TEST
- [ ] TEST
- [ ] TEST

### Phase 3: Stuff ill need to do in future
- [ ] TEST
- [ ] TEST
- [ ] TEST
- [ ] Migrate users using Clerk migrate docs

# Things that need fixing

- [x] Inconsistent member numbering system:
  - Duplicate member numbers exist across active and resigned members
  - Staff members don't have a consistent numbering format
  - Many members have empty or zero member numbers
  - No clear distinction between different member types in numbering
  - No standardized format for handling resigned members

# Recent Fixes

## Don't have to constantly refresh member teesheet for updates

## navigation for members is broken (highlighting doesnt work)

## Member Numbering System Standardization ✅

Fixed inconsistent member numbering system with the following changes:

1. Staff Members (68 total)
   - Added "S-" prefix to all staff member numbers
   - Empty staff numbers standardized to "S-STAFF"

2. Resigned Members (405 total)
   - Added "R-" prefix to all resigned member numbers
   - Empty resigned numbers standardized to "R-RESIGNED"

3. Empty/Zero Numbers (25 total)
   - Standardized all empty or "0" numbers to "EMPTY"

4. Duplicate Numbers Found and Handled:
   - Original duplicates:
     - TM001 (UNLIMITED PLAY MALE)
     - 123456 (FULL PLAY FEMALE)
     - 2774A (UNLIMITED PLAY MALE)
     - TM057 (UNLIMITED PLAY MALE)
     - TM075 (UNLIMITED PLAY MALE)
     - TM002 (UNLIMITED PLAY MALE)
     - TM062 (FULL PLAY MALE)
   - Additional duplicates found during import:
     - 6554 (Ethan Reid - JUNIOR BOY)
     - 8766 (Luca Tomei - JUNIOR BOY)
     - 3665 (Steve Wong - WAITING LIST)
     - 6033 (Sam Hu - UNLIMITED PLAY MALE)
     - 6504 (Cooper Pederson - JUNIOR <10)
     - 6534 (Leonardo Yang - JUNIOR BOY)
     - 6921 (Eric Niu - JUNIOR BOY)

5. CSV Structure Issues Identified:
   - Duplicate columns found:
     - "Member Number" and "memberNumber"
     - "Class" appears twice
   - These duplicates need to be consolidated to prevent import errors

Total Changes:
- Members processed: 1403
- Staff prefixes added: 68
- Resigned prefixes added: 405
- Empty numbers standardized: 25
- Duplicate numbers identified: 14 (7 original + 7 additional)
- Unchanged members: 898

## Issues

- in login page we hardcode org id which is an issue for other orgs that want to use members.