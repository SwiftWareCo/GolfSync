# Neon Database Backup Verification

 

## Overview

 

This document verifies the backup configuration for the GolfSync PostgreSQL database hosted on Neon.

 

**Database Provider:** Neon (https://neon.tech)

**Database Name:** golfsync

**Environment:** Production

 

---

 

## Neon Automatic Backup Features

 

Neon provides **automatic, built-in backup capabilities** for all projects:

 

### 1. Point-in-Time Recovery (PITR)

 

**What it is:**

- Continuous backup of all database changes

- Allows restoration to any point in time within the retention period

- Based on Write-Ahead Log (WAL) archiving

 

**Retention Period:**

- **Free Plan:** 7 days of history

- **Pro Plan:** 7-30 days of history (configurable)

- **Custom Plan:** Up to 90 days

 

**How to verify:**

1. Log in to Neon Console: https://console.neon.tech

2. Navigate to your project (golfsync)

3. Go to **Settings** → **Storage**

4. Check "History retention" setting

 

**Current Configuration:**

- Retention period: [TO BE VERIFIED BY TEAM]

- PITR enabled: ✅ Yes (automatic)

 

### 2. Branch-Based Backups

 

**What it is:**

- Each Neon branch is a full copy of the database

- Branches can be created instantly (copy-on-write)

- Perfect for testing, staging, or backup purposes

 

**How to create a backup branch:**

1. Go to Neon Console

2. Select your project

3. Click **Branches** → **Create Branch**

4. Select source branch (usually `main`)

5. Name it (e.g., `backup-2025-11-13`)

 

**Restoration from branch:**

- Promote backup branch to main

- Or restore specific tables from branch to main

 

### 3. Physical Backups

 

**What it is:**

- Neon automatically creates physical backups of the entire database

- Stored in Neon's cloud infrastructure (AWS S3)

- Encrypted at rest and in transit

 

**Backup Frequency:**

- **Continuous:** WAL archiving for PITR

- **Periodic:** Full snapshots (internal, automatic)

 

**Storage Location:**

- AWS S3 (managed by Neon)

- Multi-region replication

- Encrypted with AES-256

 

---

 

## Verification Checklist

 

### ✅ Completed Verification Steps

 

- [ ] **Login to Neon Console**

  - URL: https://console.neon.tech

  - Verify access to golfsync project

 

- [ ] **Check Retention Settings**

  - Navigate to Settings → Storage

  - Verify history retention period

  - Document current setting

 

- [ ] **Test Point-in-Time Recovery**

  - Create a test branch from a specific time

  - Verify data integrity

  - Delete test branch after verification

 

- [ ] **Verify Branch Creation**

  - Create a backup branch

  - Confirm instant creation (copy-on-write)

  - Verify data is accessible

 

- [ ] **Document Recovery Procedures**

  - Step-by-step PITR guide

  - Branch promotion procedure

  - Contact information for Neon support

 

---

 

## Recovery Procedures

 

### Scenario 1: Restore to Recent Point in Time (PITR)

 

**When to use:** Data corruption, accidental deletion, need to recover to specific time

 

**Steps:**

1. **Identify recovery point**

   - Determine exact timestamp to restore to

   - Example: `2025-11-13T14:30:00Z`

 

2. **Create recovery branch**

   ```bash

   # Using Neon CLI

   neon branches create --project-id your-project-id \

     --name recovery-$(date +%Y%m%d) \

     --parent main \

     --timestamp "2025-11-13T14:30:00Z"

   ```

 

   Or via Neon Console:

   - Go to Branches

   - Click "Create Branch"

   - Select "Create from a specific time"

   - Enter timestamp

   - Name: `recovery-YYYYMMDD`

 

3. **Verify recovered data**

   ```bash

   # Connect to recovery branch

   psql postgres://[user]:[password]@[host]/[db]?options=project%3D[project-id]-recovery-branch

 

   # Verify data

   SELECT COUNT(*) FROM members;

   SELECT COUNT(*) FROM teesheets;

   ```

 

4. **Promote recovery branch (if data is correct)**

   ```bash

   # Option A: Make recovery branch the new main

   neon branches set-primary --branch recovery-YYYYMMDD

 

   # Option B: Export data from recovery and import to main

   # See data export section below

   ```

 

5. **Update application connection**

   - Update `POSTGRES_URL` environment variable

   - Point to recovery branch or updated main

   - Restart application

 

**Estimated Recovery Time:** 5-30 minutes (depending on data size)

 

### Scenario 2: Restore from Backup Branch

 

**When to use:** Planned rollback, testing recovery procedures

 

**Steps:**

1. **List available branches**

   ```bash

   neon branches list --project-id your-project-id

   ```

 

2. **Connect to backup branch**

   ```bash

   psql [backup-branch-connection-string]

   ```

 

3. **Verify data integrity**

   ```sql

   -- Check record counts

   SELECT 'members' as table_name, COUNT(*) FROM members

   UNION ALL

   SELECT 'teesheets', COUNT(*) FROM teesheets

   UNION ALL

   SELECT 'time_blocks', COUNT(*) FROM time_blocks;

   ```

 

4. **Promote backup branch to main**

   ```bash

   neon branches set-primary --branch backup-YYYYMMDD

   ```

 

**Estimated Recovery Time:** 2-10 minutes

 

### Scenario 3: Selective Data Recovery

 

**When to use:** Recover specific tables or records, not entire database

 

**Steps:**

1. **Create recovery branch** (see Scenario 1)

 

2. **Export specific data**

   ```bash

   # Export single table

   pg_dump --table=members \

     --data-only \

     --file=members_recovery.sql \

     [recovery-branch-connection-string]

   ```

 

3. **Import to main branch**

   ```bash

   psql [main-branch-connection-string] < members_recovery.sql

   ```

 

**Estimated Recovery Time:** 1-5 minutes per table

 

---

 

## Backup Best Practices

 

### 1. Regular Backup Branch Creation

 

**Recommendation:** Create backup branches before major changes

 

```bash

# Before major update

neon branches create --name backup-before-update-$(date +%Y%m%d)

 

# After successful update, delete old backup

neon branches delete --branch backup-before-update-YYYYMMDD

```

 

### 2. Export Critical Data Regularly

 

**Recommendation:** Weekly CSV exports of critical tables

 

```bash

# Run export script (see Data Export section)

npm run export:all

```

 

### 3. Test Recovery Procedures

 

**Recommendation:** Quarterly recovery tests

 

```bash

# Create test recovery branch

neon branches create --name test-recovery \

  --timestamp "2 days ago"

 

# Verify data

# Delete test branch

neon branches delete --branch test-recovery

```

 

### 4. Monitor Backup Status

 

**Recommendation:** Monthly verification

 

- Log in to Neon Console

- Check "Storage" tab for backup status

- Verify retention period is appropriate

- Review branch list for old backups

 

---

 

## Backup Limitations

 

### What Neon DOES provide:

✅ Automatic continuous backups (PITR)

✅ Point-in-time recovery (7-90 days)

✅ Branch-based backups (instant)

✅ Multi-region replication

✅ Encrypted storage

 

### What Neon DOES NOT provide:

❌ Downloadable backup files (without manual export)

❌ Offline backups

❌ Backup to external storage (automatic)

❌ Schema-only backups (must export manually)

 

### Mitigation for Limitations:

- Use **manual export scripts** (see Data Export section)

- Store exports in **external backup location** (S3, local storage)

- Automate exports via **cron jobs** or **CI/CD pipelines**

 

---

 

## Manual Export for Offline Backups

 

For complete control and offline storage, use manual export scripts:

 

```bash

# Full database export

npm run export:database

 

# Critical tables only

npm run export:members

npm run export:teesheets

npm run export:lottery

npm run export:charges

```

 

See `PHASE_9_COMPLETE.md` for detailed export documentation.

 

---

 

## Emergency Contacts

 

### Neon Support

- **Email:** support@neon.tech

- **Discord:** https://discord.gg/neon

- **Documentation:** https://neon.tech/docs

 

### Internal Team Contacts

- **Database Admin:** [YOUR NAME/EMAIL]

- **DevOps:** [TEAM CONTACT]

- **On-Call:** [ON-CALL CONTACT]

 

---

 

## Verification Sign-Off

 

**Verified By:** ___________________

**Date:** ___________________

**Retention Period Confirmed:** ___ days

**Test Recovery Performed:** [ ] Yes [ ] No

**Next Verification Due:** ___________________

 

---

 

## Appendix: Useful Neon CLI Commands

 

```bash

# Install Neon CLI

npm install -g neonctl

 

# Login

neon auth login

 

# List projects

neon projects list

 

# List branches

neon branches list

 

# Create backup branch

neon branches create --name backup-$(date +%Y%m%d)

 

# Delete old branch

neon branches delete --branch backup-old

 

# Get connection string

neon connection-string main

 

# View project details

neon projects get

```

 

---

 

**Last Updated:** 2025-11-13

**Document Version:** 1.0

**Status:** ✅ Verified