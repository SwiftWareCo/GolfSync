/**

 * Audit Logging Migration - Phase 6

 *

 * Creates comprehensive audit logging tables for tracking all critical operations

 * in the GolfSync system for compliance, debugging, and business intelligence.

 */

 

import { sql } from "drizzle-orm";

import {

  index,

  integer,

  pgTableCreator,

  timestamp,

  varchar,

  text,

  jsonb,

  pgEnum,

} from "drizzle-orm/pg-core";

 

export const createTable = pgTableCreator((name) => `golfsync_${name}`);

 

// Audit Action Types

export const AuditAction = pgEnum("audit_action", [

  "CREATE",

  "UPDATE",

  "DELETE",

  "PUBLISH",

  "UNPUBLISH",

  "ASSIGN",

  "CANCEL",

  "OVERRIDE",

  "PROCESS",

  "CHECK_IN",

  "CHECK_OUT",

]);

 

// Audit Severity Levels

export const AuditSeverity = pgEnum("audit_severity", [

  "INFO",      // Normal operations

  "WARN",      // Unusual but acceptable operations

  "ERROR",     // Failed operations

  "CRITICAL",  // Security-sensitive operations

]);

 

/**

 * Main Audit Log Table

 *

 * Stores all auditable actions in the system with complete context.

 */

export const auditLogs = createTable(

  "audit_logs",

  {

    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),

 

    // Action Details

    action: AuditAction("action").notNull(),

    tableName: varchar("table_name", { length: 100 }).notNull(),

    recordId: integer("record_id"), // ID of affected record (if applicable)

    severity: AuditSeverity("severity").notNull().default("INFO"),

 

    // User Context

    userId: varchar("user_id", { length: 100 }).notNull(), // Clerk user ID

    userName: varchar("user_name", { length: 200 }), // Displayname for quick reference

    userRole: varchar("user_role", { length: 50 }), // ADMIN, MEMBER, STAFF, etc.

 

    // Technical Context

    ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6

    userAgent: text("user_agent"), // Browser/client information

    sessionId: varchar("session_id", { length: 100 }), // Session identifier

    requestId: varchar("request_id", { length: 100 }), // Request tracking ID

 

    // Change Details

    oldValues: jsonb("old_values"), // Previous state (for UPDATE/DELETE)

    newValues: jsonb("new_values"), // New state (for CREATE/UPDATE)

    changedFields: varchar("changed_fields", { length: 255 }).array(), // Fields that changed

 

    // Business Context

    reason: text("reason"), // Why the action was performed

    metadata: jsonb("metadata"), // Additional context (e.g., member count, lottery date)

 

    // Audit Trail

    createdAt: timestamp("created_at", { withTimezone: true })

      .default(sql`CURRENT_TIMESTAMP`)

      .notNull(),

  },

  (table) => [

    index("audit_logs_action_idx").on(table.action),

    index("audit_logs_table_name_idx").on(table.tableName),

    index("audit_logs_record_id_idx").on(table.recordId),

    index("audit_logs_user_id_idx").on(table.userId),

    index("audit_logs_created_at_idx").on(table.createdAt),

    index("audit_logs_severity_idx").on(table.severity),

    index("audit_logs_table_record_idx").on(table.tableName, table.recordId),

    index("audit_logs_user_date_idx").on(table.userId, table.createdAt),

  ],

);

 

/**

 * Critical Operations Audit Table

 *

 * Separate table for high-value operations that require enhanced tracking

 * and longer retention periods.

 */

export const criticalAuditLogs = createTable(

  "critical_audit_logs",

  {

    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),

 

    // Links to main audit log

    auditLogId: integer("audit_log_id")

      .references(() => auditLogs.id)

      .notNull(),

 

    // Critical Operation Details

    operationType: varchar("operation_type", { length: 50 }).notNull(), // MEMBER_UPDATE, LOTTERY_PROCESS, RESTRICTION_OVERRIDE, etc.

    riskLevel: varchar("risk_level", { length: 20 }).notNull().default("MEDIUM"), // LOW, MEDIUM, HIGH, CRITICAL

 

    // Authorization

    requiresApproval: varchar("requires_approval", { length: 20 }).default("NO"), // YES, NO, PENDING

    approvedBy: varchar("approved_by", { length: 100 }), // User ID who approved

    approvedAt: timestamp("approved_at", { withTimezone: true }),

 

    // Verification

    verifiedBy: varchar("verified_by", { length: 100 }), // User ID who verified

    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    verificationNotes: text("verification_notes"),

 

    // Business Impact

    impactedMembers: integer("impacted_members").array(), // Member IDs affected

    impactedRecords: integer("impacted_records"), // Number of records affected

    financialImpact: text("financial_impact"), // Monetary impact if applicable

 

    // Compliance

    complianceFlags: varchar("compliance_flags", { length: 50 }).array(), // PII, FINANCIAL, SECURITY, etc.

    retentionYears: integer("retention_years").notNull().default(7), // How long to keep this record

 

    createdAt: timestamp("created_at", { withTimezone: true })

      .default(sql`CURRENT_TIMESTAMP`)

      .notNull(),

  },

  (table) => [

    index("critical_audit_logs_audit_log_id_idx").on(table.auditLogId),

    index("critical_audit_logs_operation_type_idx").on(table.operationType),

    index("critical_audit_logs_risk_level_idx").on(table.riskLevel),

    index("critical_audit_logs_requires_approval_idx").on(table.requiresApproval),

    index("critical_audit_logs_created_at_idx").on(table.createdAt),

  ],

);

 

/**

 * Audit Log Retention Policy Table

 *

 * Defines how long different types of audit logs should be retained.

 */

export const auditRetentionPolicies = createTable(

  "audit_retention_policies",

  {

    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),

 

    tableName: varchar("table_name", { length: 100 }).notNull(),

    operationType: varchar("operation_type", { length: 50 }),

    retentionDays: integer("retention_days").notNull(), // Days to retain

    archiveAfterDays: integer("archive_after_days"), // Days before archiving (optional)

    deleteAfterDays: integer("delete_after_days"), // Days before permanent deletion

 

    isActive: varchar("is_active", { length: 20 }).notNull().default("YES"),

    notes: text("notes"),

 

    createdAt: timestamp("created_at", { withTimezone: true })

      .default(sql`CURRENT_TIMESTAMP`)

      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(

      () => new Date(),

    ),

  },

  (table) => [

    index("audit_retention_policies_table_name_idx").on(table.tableName),

  ],

);

 

/**

 * Audit Log Statistics Table

 *

 * Aggregated statistics for reporting and monitoring.

 */

export const auditStatistics = createTable(

  "audit_statistics",

  {

    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),

 

    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD

    tableName: varchar("table_name", { length: 100 }).notNull(),

    action: varchar("action", { length: 20 }).notNull(),

 

    totalCount: integer("total_count").notNull().default(0),

    uniqueUsers: integer("unique_users").notNull().default(0),

    errorCount: integer("error_count").notNull().default(0),

    criticalCount: integer("critical_count").notNull().default(0),

 

    createdAt: timestamp("created_at", { withTimezone: true })

      .default(sql`CURRENT_TIMESTAMP`)

      .notNull(),

  },

  (table) => [

    index("audit_statistics_date_idx").on(table.date),

    index("audit_statistics_table_name_idx").on(table.tableName),

  ],

);

 

// Type exports

export type AuditLog = typeof auditLogs.$inferSelect;

export type AuditLogInsert = typeof auditLogs.$inferInsert;

export type CriticalAuditLog = typeof criticalAuditLogs.$inferSelect;

export type CriticalAuditLogInsert = typeof criticalAuditLogs.$inferInsert;

export type AuditRetentionPolicy = typeof auditRetentionPolicies.$inferSelect;

export type AuditRetentionPolicyInsert = typeof auditRetentionPolicies.$inferInsert;

export type AuditStatistic = typeof auditStatistics.$inferSelect;

export type AuditStatisticInsert = typeof auditStatistics.$inferInsert;