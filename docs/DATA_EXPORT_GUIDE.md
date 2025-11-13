# Data Export Guide

 

## Overview

 

GolfSync provides comprehensive data export functionality for creating CSV backups of critical database tables. This guide covers how to use the export utilities, backup scripts, and browser-based downloads.

 

---

 

## Table of Contents

 

1. [Quick Start](#quick-start)

2. [Export Scripts](#export-scripts)

3. [Export Functions](#export-functions)

4. [Browser Downloads](#browser-downloads)

5. [CSV Format Options](#csv-format-options)

6. [Testing](#testing)

7. [Troubleshooting](#troubleshooting)

 

---

 

## Quick Start

 

### Export All Tables

 

```bash

npm run backup:all

```

 

This will export all critical tables to the `exports/` directory:

- `members-YYYY-MM-DD.csv`

- `teesheets-YYYY-MM-DD.csv`

- `time-blocks-YYYY-MM-DD.csv`

- `lottery-entries-YYYY-MM-DD.csv`

- `charges-YYYY-MM-DD.csv`

- `audit-logs-YYYY-MM-DD.csv`

 

### Export Individual Tables

 

```bash

# Export members only

npm run backup:members

 

# Export teesheets only

npm run backup:teesheets

 

# Export lottery entries

npm run backup:lottery

 

# Export charges

npm run backup:charges

 

# Export audit logs

npm run backup:audit

```

 

---

 

## Export Scripts

 

### Command Line Usage

 

The backup script can be run directly with `tsx`:

 

```bash

tsx scripts/backup-database.ts [table]

```

 

**Available tables:**

- `all` (default) - Export all tables

- `members` - Members table

- `teesheets` - Teesheets table

- `time-blocks` (or `bookings`) - Time block bookings

- `lottery` (or `lottery-entries`) - Lottery entries

- `charges` - Member charges

- `audit` (or `audit-logs`) - Audit logs

 

### Script Output

 

The backup script provides detailed output:

 

```

============================================================

GolfSync Database Backup

============================================================

 

Exporting all tables...

 

============================================================

Export Summary:

  Successful: 6

  Failed: 0

  Total rows exported: 1,234

 

Successfully exported:

  ✓ exports/members-2025-11-13.csv (150 rows)

  ✓ exports/teesheets-2025-11-13.csv (45 rows)

  ✓ exports/time-blocks-2025-11-13.csv (320 rows)

  ✓ exports/lottery-entries-2025-11-13.csv (89 rows)

  ✓ exports/charges-2025-11-13.csv (230 rows)

  ✓ exports/audit-logs-2025-11-13.csv (400 rows)

============================================================

 

Completed in 2.34s

 

✅ All exports completed successfully

```

 

---

 

## Export Functions

 

### Server-Side Exports (Node.js)

 

#### Export Members

 

```typescript

import { exportMembers, exportActiveMembers } from "~/lib/database-export";

 

// Export all members

const result = await exportMembers();

console.log(`Exported ${result.rowCount} members to ${result.filename}`);

 

// Export only active members

const activeResult = await exportActiveMembers();

```

 

#### Export Teesheets

 

```typescript

import {

  exportTeesheets,

  exportTeesheetsByDateRange,

} from "~/lib/database-export";

 

// Export all teesheets

const result = await exportTeesheets();

 

// Export teesheets for specific date range

const startDate = new Date("2025-11-01");

const endDate = new Date("2025-11-30");

const rangeResult = await exportTeesheetsByDateRange(startDate, endDate);

```

 

#### Export Time Blocks (Bookings)

 

```typescript

import { exportTimeBlocks } from "~/lib/database-export";

 

const result = await exportTimeBlocks();

```

 

Time blocks include member and teesheet information flattened for CSV export.

 

#### Export Lottery Entries

 

```typescript

import { exportLotteryEntries } from "~/lib/database-export";

 

const result = await exportLotteryEntries();

```

 

#### Export Charges

 

```typescript

import { exportCharges, exportUnpaidCharges } from "~/lib/database-export";

 

// Export all charges

const allCharges = await exportCharges();

 

// Export only unpaid charges

const unpaid = await exportUnpaidCharges();

```

 

#### Export Audit Logs

 

```typescript

import { exportAuditLogs } from "~/lib/database-export";

 

const result = await exportAuditLogs();

```

 

#### Export All Tables

 

```typescript

import { exportAll, summarizeExports } from "~/lib/database-export";

 

// Export all critical tables

const results = await exportAll();

 

// Print summary

console.log(summarizeExports(results));

```

 

### Export Options

 

All export functions accept optional configuration:

 

```typescript

const result = await exportMembers({

  // CSV format options

  includeHeaders: true,

  dateFormat: "iso", // or "readable"

  delimiter: ",",

  quote: '"',

  lineEnding: "\n",

 

  // File options

  directory: "exports", // Output directory

  filename: "custom-filename.csv", // Custom filename (default: auto-generated)

});

```

 

### Export Result

 

All export functions return an `ExportResult` object:

 

```typescript

type ExportResult = {

  success: boolean;

  filename?: string; // Full path to exported file

  rowCount?: number; // Number of rows exported

  error?: string; // Error message if failed

};

```

 

**Example:**

 

```typescript

const result = await exportMembers();

 

if (result.success) {

  console.log(`✓ Exported ${result.rowCount} rows to ${result.filename}`);

} else {

  console.error(`✗ Export failed: ${result.error}`);

}

```

 

---

 

## Browser Downloads

 

### Client-Side Exports

 

For browser-based data exports that trigger a download:

 

```typescript

import { exportAndDownload } from "~/lib/export";

 

// Export data and trigger browser download

const members = [

  { id: 1, name: "John Smith", email: "john@example.com" },

  { id: 2, name: "Jane Doe", email: "jane@example.com" },

];

 

const result = exportAndDownload(members, "members.csv", {

  includeHeaders: true,

  dateFormat: "readable",

});

 

if (result.success) {

  console.log("Download started");

} else {

  console.error(result.error);

}

```

 

### Manual Download Trigger

 

```typescript

import { toCSV, downloadCSV } from "~/lib/export";

 

// Convert data to CSV

const csv = toCSV(data);

 

// Trigger download

downloadCSV(csv, "export.csv");

```

 

---

 

## CSV Format Options

 

### Include Headers

 

```typescript

// With headers (default)

toCSV(data, { includeHeaders: true });

// Output: id,name,email\n1,John,john@example.com

 

// Without headers

toCSV(data, { includeHeaders: false });

// Output: 1,John,john@example.com

```

 

### Date Format

 

```typescript

// ISO 8601 format (default)

toCSV(data, { dateFormat: "iso" });

// Output: 2025-11-13T10:30:00.000Z

 

// Readable format

toCSV(data, { dateFormat: "readable" });

// Output: Nov 13, 2025

```

 

### Custom Delimiter

 

```typescript

// Comma (default)

toCSV(data, { delimiter: "," });

 

// Semicolon (common in European locales)

toCSV(data, { delimiter: ";" });

 

// Tab-separated

toCSV(data, { delimiter: "\t" });

```

 

### Custom Line Endings

 

```typescript

// Unix/Linux (default)

toCSV(data, { lineEnding: "\n" });

 

// Windows

toCSV(data, { lineEnding: "\r\n" });

```

 

### Special Character Handling

 

The CSV export automatically handles:

 

**Commas in values:**

```csv

name,description

"Smith, John","Member since 2020"

```

 

**Quotes in values:**

```csv

name,nickname

"John ""Johnny"" Smith","The ""Pro"""

```

 

**Newlines in values:**

```csv

name,notes

"John Smith","First line

Second line"

```

 

**Objects and arrays:**

```csv

name,metadata

"John Smith","{""memberSince"":2020,""tier"":""gold""}"

```

 

---

 

## Testing

 

### Run Export Tests

 

```bash

# Run all tests

npm test

 

# Run export tests only

npm test -- export

 

# Run with coverage

npm test:coverage

```

 

### Test Coverage

 

Export functionality includes comprehensive tests:

- ✅ CSV conversion (to/from)

- ✅ Special character escaping

- ✅ Date formatting

- ✅ Database exports (mocked)

- ✅ Error handling

- ✅ Round-trip parsing

 

**Current test status:** 417/417 tests passing ✅

 

---

 

## Generic CSV Utilities

 

For custom exports, use the generic CSV utilities:

 

### Convert to CSV

 

```typescript

import { toCSV } from "~/lib/export";

 

const data = [

  { id: 1, name: "John", age: 30 },

  { id: 2, name: "Jane", age: 25 },

];

 

const csv = toCSV(data);

// Output: id,name,age\n1,John,30\n2,Jane,25

```

 

### Parse CSV

 

```typescript

import { fromCSV } from "~/lib/export";

 

const csv = 'id,name,age\n1,John,30\n2,Jane,25';

const data = fromCSV(csv);

// Output: [{ id: "1", name: "John", age: "30" }, ...]

```

 

### Generate Filename

 

```typescript

import { generateFilename } from "~/lib/export";

 

const filename = generateFilename("members");

// Output: members-2025-11-13.csv

 

const customExt = generateFilename("backup", "txt");

// Output: backup-2025-11-13.txt

```

 

### Get CSV Size

 

```typescript

import { getCSVSize, formatSize } from "~/lib/export";

 

const csv = toCSV(largeDataset);

const bytes = getCSVSize(csv);

const readable = formatSize(bytes);

 

console.log(`Export size: ${readable}`); // "Export size: 2.45 MB"

```

 

---

 

## Troubleshooting

 

### Export Directory Not Found

 

**Error:** `ENOENT: no such file or directory, mkdir 'exports'`

 

**Solution:** The script automatically creates the `exports` directory. Ensure you have write permissions in the project directory.

 

### Database Connection Errors

 

**Error:** `Database connection failed`

 

**Solution:**

1. Check your `.env` file has correct `POSTGRES_URL`

2. Verify database is accessible

3. Check network connectivity to Neon

 

### Empty Export

 

**Error:** `No data to export`

 

**Solution:** This is expected if the table is empty. Check your database has data:

 

```sql

SELECT COUNT(*) FROM members;

```

 

### Permission Denied

 

**Error:** `EACCES: permission denied`

 

**Solution:** Ensure the process has write permissions to the `exports/` directory:

 

```bash

chmod 755 exports/

```

 

### Memory Issues with Large Exports

 

**Error:** `JavaScript heap out of memory`

 

**Solution:** For very large tables, increase Node.js memory:

 

```bash

NODE_OPTIONS="--max-old-space-size=4096" npm run backup:all

```

 

Or export tables individually instead of using `backup:all`.

 

---

 

## Best Practices

 

### Regular Backups

 

Schedule regular exports using cron jobs:

 

```bash

# Daily backup at 2 AM

0 2 * * * cd /path/to/golfsync && npm run backup:all >> /var/log/golfsync-backup.log 2>&1

```

 

### Storage

 

- Store exports in a secure, backed-up location

- Consider encrypting exports containing sensitive data

- Implement retention policies (e.g., keep last 30 days)

- Test restore procedures regularly

 

### Version Control

 

- Do NOT commit exports to git (already in `.gitignore`)

- Store exports separately from source code

- Consider external backup solutions (S3, Google Drive, etc.)

 

### Monitoring

 

Monitor backup success:

 

```bash

#!/bin/bash

npm run backup:all

if [ $? -eq 0 ]; then

  echo "Backup successful" | mail -s "Backup OK" admin@example.com

else

  echo "Backup failed" | mail -s "Backup FAILED" admin@example.com

fi

```

 

---

 

## Integration with Neon Backups

 

The CSV exports complement Neon's built-in backup features:

 

| Feature | Neon PITR | CSV Exports |

|---------|-----------|-------------|

| **Automatic** | ✅ Yes | ❌ No (manual/scheduled) |

| **Downloadable** | ❌ No | ✅ Yes |

| **Offline storage** | ❌ No | ✅ Yes |

| **Point-in-time** | ✅ Yes | ❌ No |

| **Table-specific** | ❌ No | ✅ Yes |

| **Version control** | ❌ No | ✅ Yes (CSV files) |

 

**Recommendation:** Use both strategies:

- **Neon PITR** for quick recovery from recent failures

- **CSV exports** for long-term archival and external backups

 

---

 

## API Reference

 

### Export Functions

 

| Function | Description | Returns |

|----------|-------------|---------|

| `exportMembers()` | Export all members | `Promise<ExportResult>` |

| `exportActiveMembers()` | Export active members only | `Promise<ExportResult>` |

| `exportTeesheets()` | Export all teesheets | `Promise<ExportResult>` |

| `exportTeesheetsByDateRange()` | Export teesheets in date range | `Promise<ExportResult>` |

| `exportTimeBlocks()` | Export time block bookings | `Promise<ExportResult>` |

| `exportLotteryEntries()` | Export lottery entries | `Promise<ExportResult>` |

| `exportCharges()` | Export all charges | `Promise<ExportResult>` |

| `exportUnpaidCharges()` | Export unpaid charges only | `Promise<ExportResult>` |

| `exportAuditLogs()` | Export audit logs | `Promise<ExportResult>` |

| `exportAll()` | Export all tables | `Promise<ExportResult[]>` |

 

### CSV Utilities

 

| Function | Description | Returns |

|----------|-------------|---------|

| `toCSV(data, options?)` | Convert array to CSV string | `string` |

| `fromCSV(csv, options?)` | Parse CSV string to array | `T[]` |

| `downloadCSV(csv, filename)` | Trigger browser download | `void` |

| `exportAndDownload(data, filename, options?)` | Convert and download | `ExportResult` |

| `generateFilename(prefix, ext?)` | Generate timestamped filename | `string` |

| `getCSVSize(csv)` | Get CSV size in bytes | `number` |

| `formatSize(bytes)` | Format bytes to human-readable | `string` |

| `summarizeExports(results)` | Summarize export results | `string` |

 

---

 

## Related Documentation

 

- [Neon Backup Verification](./NEON_BACKUP_VERIFICATION.md) - Neon database backup configuration

- [Phase 9 Complete](./PHASE_9_COMPLETE.md) - Phase 9 implementation details

- [Production Prep Phases](./PRODUCTION_PREP_PHASES.md) - Full production preparation timeline

 

---

 

**Last Updated:** 2025-11-13

**Document Version:** 1.0

**Status:** ✅ Complete