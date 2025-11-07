/**

 * Audit Logging Utilities

 *

 * Provides functions to log auditable events throughout the GolfSync application.

 * Usage:

 *   import { auditLog, criticalAuditLog } from '~/server/audit/logger';

 *   await auditLog.create({ tableName: 'members', recordId: 123, ... });

 */

 

import { db } from "../db";

import { auditLogs, criticalAuditLogs, type AuditLogInsert, type CriticalAuditLogInsert } from "../db/audit-schema";

import { auth, currentUser } from "@clerk/nextjs/server";

import { headers } from "next/headers";

 

// ============================================================================

// TYPE DEFINITIONS

// ============================================================================

 

export type AuditAction =

  | "CREATE"

  | "UPDATE"

  | "DELETE"

  | "PUBLISH"

  | "UNPUBLISH"

  | "ASSIGN"

  | "CANCEL"

  | "OVERRIDE"

  | "PROCESS"

  | "CHECK_IN"

  | "CHECK_OUT";

 

export type AuditSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

 

export interface AuditContext {

  action: AuditAction;

  tableName: string;

  recordId?: number | null;

  severity?: AuditSeverity;

  oldValues?: Record<string, any> | null;

  newValues?: Record<string, any> | null;

  reason?: string | null;

  metadata?: Record<string, any> | null;

}

 

export interface CriticalAuditContext extends AuditContext {

  operationType: string;

  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  impactedMembers?: number[];

  impactedRecords?: number;

  financialImpact?: string;

  complianceFlags?: string[];

}

 

// ============================================================================

// HELPER FUNCTIONS

// ============================================================================

 

/**

 * Get current user context from Clerk authentication

 */

async function getUserContext() {

  try {

    const { userId } = await auth();

    const user = await currentUser();

 

    return {

      userId: userId || "SYSTEM",

      userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : null,

      userRole: (user?.publicMetadata?.role as string) || null,

    };

  } catch (error) {

    console.error("[AUDIT] Error getting user context:", error);

    return {

      userId: "SYSTEM",

      userName: null,

      userRole: null,

    };

  }

}

 

/**

 * Get technical context from request headers

 */

async function getTechnicalContext() {

  try {

    const headersList = await headers();

    const ipAddress = headersList.get("x-forwarded-for") ||

                      headersList.get("x-real-ip") ||

                      null;

    const userAgent = headersList.get("user-agent") || null;

 

    // Generate session ID from available headers (simplified)

    const sessionId = headersList.get("x-request-id") || null;

 

    return {

      ipAddress,

      userAgent,

      sessionId,

      requestId: sessionId, // Could be different in production

    };

  } catch (error) {

    console.error("[AUDIT] Error getting technical context:", error);

    return {

      ipAddress: null,

      userAgent: null,

      sessionId: null,

      requestId: null,

    };

  }

}

 

/**

 * Calculate changed fields between old and new values

 */

function getChangedFields(

  oldValues: Record<string, any> | null,

  newValues: Record<string, any> | null

): string[] {

  if (!oldValues || !newValues) return [];

 

  const changed: string[] = [];

  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

 

  for (const key of allKeys) {

    // Skip timestamp fields

    if (key === "createdAt" || key === "updatedAt") continue;

 

    const oldVal = oldValues[key];

    const newVal = newValues[key];

 

    // Compare values (simple comparison, could be enhanced)

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {

      changed.push(key);

    }

  }

 

  return changed;

}

 

// ============================================================================

// MAIN AUDIT LOGGING FUNCTIONS

// ============================================================================

 

/**

 * Log a standard audit event

 *

 * @param context - Audit context containing action details

 * @returns Promise<AuditLog> - The created audit log record

 *

 * @example

 * await auditLog.create({

 *   action: "UPDATE",

 *   tableName: "members",

 *   recordId: 123,

 *   severity: "INFO",

 *   oldValues: { firstName: "John" },

 *   newValues: { firstName: "Jane" },

 *   reason: "Member requested name change",

 * });

 */

export async function createAuditLog(context: AuditContext) {

  try {

    const userContext = await getUserContext();

    const techContext = await getTechnicalContext();

 

    const changedFields = getChangedFields(

      context.oldValues || null,

      context.newValues || null

    );

 

    const auditLogData: AuditLogInsert = {

      action: context.action,

      tableName: context.tableName,

      recordId: context.recordId || null,

      severity: context.severity || "INFO",

 

      // User context

      userId: userContext.userId,

      userName: userContext.userName,

      userRole: userContext.userRole,

 

      // Technical context

      ipAddress: techContext.ipAddress,

      userAgent: techContext.userAgent,

      sessionId: techContext.sessionId,

      requestId: techContext.requestId,

 

      // Change details

      oldValues: context.oldValues || null,

      newValues: context.newValues || null,

      changedFields,

 

      // Business context

      reason: context.reason || null,

      metadata: context.metadata || null,

    };

 

    const [auditLog] = await db

      .insert(auditLogs)

      .values(auditLogData)

      .returning();

 

    return auditLog;

  } catch (error) {

    console.error("[AUDIT] Error creating audit log:", error);

    // Don't throw - audit logging should not break business logic

    return null;

  }

}

 

/**

 * Log a critical audit event with enhanced tracking

 *

 * @param context - Critical audit context

 * @returns Promise<CriticalAuditLog> - The created critical audit log record

 *

 * @example

 * await createCriticalAuditLog({

 *   action: "OVERRIDE",

 *   tableName: "timeblock_restrictions",

 *   recordId: 456,

 *   operationType: "RESTRICTION_OVERRIDE",

 *   riskLevel: "HIGH",

 *   impactedMembers: [1, 2, 3],

 *   complianceFlags: ["SECURITY"],

 * });

 */

export async function createCriticalAuditLog(context: CriticalAuditContext) {

  try {

    // First, create standard audit log

    const auditLog = await createAuditLog(context);

 

    if (!auditLog) {

      console.error("[AUDIT] Failed to create audit log for critical operation");

      return null;

    }

 

    // Then, create critical audit log

    const criticalAuditData: CriticalAuditLogInsert = {

      auditLogId: auditLog.id,

      operationType: context.operationType,

      riskLevel: context.riskLevel || "MEDIUM",

      requiresApproval: "NO",

      impactedMembers: context.impactedMembers || null,

      impactedRecords: context.impactedRecords || null,

      financialImpact: context.financialImpact || null,

      complianceFlags: context.complianceFlags || null,

      retentionYears: 7, // Default retention

    };

 

    const [criticalLog] = await db

      .insert(criticalAuditLogs)

      .values(criticalAuditData)

      .returning();

 

    return criticalLog;

  } catch (error) {

    console.error("[AUDIT] Error creating critical audit log:", error);

    return null;

  }

}

 

// ============================================================================

// CONVENIENCE FUNCTIONS FOR COMMON OPERATIONS

// ============================================================================

 

export const auditLog = {

  /**

   * Log a CREATE operation

   */

  create: async (tableName: string, recordId: number, newValues: Record<string, any>, metadata?: Record<string, any>) => {

    return createAuditLog({

      action: "CREATE",

      tableName,

      recordId,

      newValues,

      metadata,

    });

  },

 

  /**

   * Log an UPDATE operation

   */

  update: async (

    tableName: string,

    recordId: number,

    oldValues: Record<string, any>,

    newValues: Record<string, any>,

    reason?: string

  ) => {

    return createAuditLog({

      action: "UPDATE",

      tableName,

      recordId,

      oldValues,

      newValues,

      reason,

    });

  },

 

  /**

   * Log a DELETE operation

   */

  delete: async (tableName: string, recordId: number, oldValues: Record<string, any>, reason?: string) => {

    return createAuditLog({

      action: "DELETE",

      tableName,

      recordId,

      oldValues,

      reason,

      severity: "WARN",

    });

  },

 

  /**

   * Log a PUBLISH operation

   */

  publish: async (tableName: string, recordId: number, metadata?: Record<string, any>) => {

    return createAuditLog({

      action: "PUBLISH",

      tableName,

      recordId,

      metadata,

    });

  },

 

  /**

   * Log an ASSIGN operation

   */

  assign: async (tableName: string, recordId: number, metadata?: Record<string, any>) => {

    return createAuditLog({

      action: "ASSIGN",

      tableName,

      recordId,

      metadata,

    });

  },

 

  /**

   * Log a CANCEL operation

   */

  cancel: async (tableName: string, recordId: number, reason?: string) => {

    return createAuditLog({

      action: "CANCEL",

      tableName,

      recordId,

      reason,

    });

  },

};

 

/**

 * Log critical operations with enhanced tracking

 */

export const criticalAuditLog = {

  /**

   * Log a member data update (PII)

   */

  memberUpdate: async (memberId: number, oldValues: Record<string, any>, newValues: Record<string, any>) => {

    return createCriticalAuditLog({

      action: "UPDATE",

      tableName: "members",

      recordId: memberId,

      operationType: "MEMBER_UPDATE",

      riskLevel: "HIGH",

      oldValues,

      newValues,

      complianceFlags: ["PII"],

    });

  },

 

  /**

   * Log a restriction override

   */

  restrictionOverride: async (restrictionId: number, memberId: number, reason: string) => {

    return createCriticalAuditLog({

      action: "OVERRIDE",

      tableName: "timeblock_restrictions",

      recordId: restrictionId,

      operationType: "RESTRICTION_OVERRIDE",

      riskLevel: "HIGH",

      impactedMembers: [memberId],

      reason,

      complianceFlags: ["SECURITY"],

    });

  },

 

  /**

   * Log a lottery processing operation

   */

  lotteryProcess: async (lotteryDate: string, impactedMembers: number[], metadata: Record<string, any>) => {

    return createCriticalAuditLog({

      action: "PROCESS",

      tableName: "lottery_entries",

      operationType: "LOTTERY_PROCESS",

      riskLevel: "MEDIUM",

      impactedMembers,

      impactedRecords: impactedMembers.length,

      metadata: { lotteryDate, ...metadata },

    });

  },

 

  /**

   * Log a financial transaction

   */

  financialCharge: async (tableName: string, recordId: number, amount: string, metadata?: Record<string, any>) => {

    return createCriticalAuditLog({

      action: "CREATE",

      tableName,

      recordId,

      operationType: "FINANCIAL_CHARGE",

      riskLevel: "HIGH",

      financialImpact: amount,

      metadata,

      complianceFlags: ["FINANCIAL"],

    });

  },

};