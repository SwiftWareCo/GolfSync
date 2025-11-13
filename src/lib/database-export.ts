/**

 * Database Table Export Functions

 *

 * Provides functions for exporting specific database tables to CSV format.

 * Uses generic export utilities from ./export.ts

 */

 

import { db } from "~/server/db";

import {

  type ExportOptions,

  type ExportResult,

  toCSV,

  writeCSVToFile,

  generateFilename,

} from "./export";

 

// ============================================================================

// TYPES

// ============================================================================

 

/**

 * Options for database exports

 */

export type DatabaseExportOptions = ExportOptions & {

  /** Directory to save export files (default: "exports") */

  directory?: string;

  /** Custom filename (default: auto-generated with timestamp) */

  filename?: string;

};

 

/**

 * Export metadata

 */

export type ExportMetadata = {

  table: string;

  exportedAt: string;

  rowCount: number;

  filename: string;

};

 

// ============================================================================

// MEMBER EXPORTS

// ============================================================================

 

/**

 * Export all members to CSV

 */

export async function exportMembers(

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    // Fetch all members

    const members = await db.member.findMany({

      orderBy: { id: "asc" },

    });

 

    if (members.length === 0) {

      return {

        success: false,

        error: "No members found to export",

      };

    }

 

    // Convert to CSV

    const csv = toCSV(members, options);

 

    // Generate filename

    const filename = options.filename || generateFilename("members");

 

    // Write to file

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error: error instanceof Error ? error.message : "Failed to export members",

    };

  }

}

 

/**

 * Export active members only

 */

export async function exportActiveMembers(

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    const members = await db.member.findMany({

      where: { status: "active" },

      orderBy: { lastName: "asc" },

    });

 

    if (members.length === 0) {

      return {

        success: false,

        error: "No active members found to export",

      };

    }

 

    const csv = toCSV(members, options);

    const filename = options.filename || generateFilename("members-active");

 

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error:

        error instanceof Error ? error.message : "Failed to export active members",

    };

  }

}

 

// ============================================================================

// TEESHEET EXPORTS

// ============================================================================

 

/**

 * Export all teesheets to CSV

 */

export async function exportTeesheets(

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    const teesheets = await db.teesheet.findMany({

      orderBy: { date: "desc" },

    });

 

    if (teesheets.length === 0) {

      return {

        success: false,

        error: "No teesheets found to export",

      };

    }

 

    const csv = toCSV(teesheets, options);

    const filename = options.filename || generateFilename("teesheets");

 

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error:

        error instanceof Error ? error.message : "Failed to export teesheets",

    };

  }

}

 

/**

 * Export teesheets for a specific date range

 */

export async function exportTeesheetsByDateRange(

  startDate: Date,

  endDate: Date,

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    const teesheets = await db.teesheet.findMany({

      where: {

        date: {

          gte: startDate,

          lte: endDate,

        },

      },

      orderBy: { date: "asc" },

    });

 

    if (teesheets.length === 0) {

      return {

        success: false,

        error: "No teesheets found in date range",

      };

    }

 

    const csv = toCSV(teesheets, options);

    const filename =

      options.filename ||

      generateFilename(

        `teesheets-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}`

      );

 

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error:

        error instanceof Error

          ? error.message

          : "Failed to export teesheets by date range",

    };

  }

}

 

// ============================================================================

// TIME BLOCK EXPORTS

// ============================================================================

 

/**

 * Export all time blocks (bookings) to CSV

 */

export async function exportTimeBlocks(

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    const timeBlocks = await db.timeBlock.findMany({

      include: {

        member: {

          select: {

            id: true,

            firstName: true,

            lastName: true,

            membershipNumber: true,

          },

        },

        teesheet: {

          select: {

            id: true,

            date: true,

            title: true,

          },

        },

      },

      orderBy: [{ teesheetId: "desc" }, { startTime: "asc" }],

    });

 

    if (timeBlocks.length === 0) {

      return {

        success: false,

        error: "No time blocks found to export",

      };

    }

 

    // Flatten the data for CSV export

    const flatData = timeBlocks.map((block) => ({

      id: block.id,

      teesheetId: block.teesheetId,

      teesheetDate: block.teesheet.date.toISOString(),

      teesheetTitle: block.teesheet.title,

      memberId: block.memberId,

      memberFirstName: block.member?.firstName || "",

      memberLastName: block.member?.lastName || "",

      membershipNumber: block.member?.membershipNumber || "",

      startTime: block.startTime,

      endTime: block.endTime,

      status: block.status,

      bookingType: block.bookingType,

      createdAt: block.createdAt.toISOString(),

      updatedAt: block.updatedAt.toISOString(),

    }));

 

    const csv = toCSV(flatData, options);

    const filename = options.filename || generateFilename("time-blocks");

 

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error:

        error instanceof Error ? error.message : "Failed to export time blocks",

    };

  }

}

 

// ============================================================================

// LOTTERY EXPORTS

// ============================================================================

 

/**

 * Export all lottery entries to CSV

 */

export async function exportLotteryEntries(

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    const entries = await db.lotteryEntry.findMany({

      include: {

        member: {

          select: {

            id: true,

            firstName: true,

            lastName: true,

            membershipNumber: true,

          },

        },

        teesheet: {

          select: {

            id: true,

            date: true,

            title: true,

          },

        },

      },

      orderBy: [{ teesheetId: "desc" }, { createdAt: "asc" }],

    });

 

    if (entries.length === 0) {

      return {

        success: false,

        error: "No lottery entries found to export",

      };

    }

 

    // Flatten the data for CSV export

    const flatData = entries.map((entry) => ({

      id: entry.id,

      teesheetId: entry.teesheetId,

      teesheetDate: entry.teesheet.date.toISOString(),

      teesheetTitle: entry.teesheet.title,

      memberId: entry.memberId,

      memberFirstName: entry.member.firstName,

      memberLastName: entry.member.lastName,

      membershipNumber: entry.member.membershipNumber,

      status: entry.status,

      priority: entry.priority,

      createdAt: entry.createdAt.toISOString(),

      updatedAt: entry.updatedAt.toISOString(),

    }));

 

    const csv = toCSV(flatData, options);

    const filename = options.filename || generateFilename("lottery-entries");

 

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error:

        error instanceof Error

          ? error.message

          : "Failed to export lottery entries",

    };

  }

}

 

// ============================================================================

// CHARGES EXPORTS

// ============================================================================

 

/**

 * Export all charges to CSV

 */

export async function exportCharges(

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    const charges = await db.charge.findMany({

      include: {

        member: {

          select: {

            id: true,

            firstName: true,

            lastName: true,

            membershipNumber: true,

          },

        },

      },

      orderBy: [{ createdAt: "desc" }],

    });

 

    if (charges.length === 0) {

      return {

        success: false,

        error: "No charges found to export",

      };

    }

 

    // Flatten the data for CSV export

    const flatData = charges.map((charge) => ({

      id: charge.id,

      memberId: charge.memberId,

      memberFirstName: charge.member.firstName,

      memberLastName: charge.member.lastName,

      membershipNumber: charge.member.membershipNumber,

      amount: charge.amount,

      description: charge.description,

      chargeDate: charge.chargeDate.toISOString(),

      status: charge.status,

      createdAt: charge.createdAt.toISOString(),

      updatedAt: charge.updatedAt.toISOString(),

    }));

 

    const csv = toCSV(flatData, options);

    const filename = options.filename || generateFilename("charges");

 

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error: error instanceof Error ? error.message : "Failed to export charges",

    };

  }

}

 

/**

 * Export unpaid charges

 */

export async function exportUnpaidCharges(

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    const charges = await db.charge.findMany({

      where: { status: "pending" },

      include: {

        member: {

          select: {

            id: true,

            firstName: true,

            lastName: true,

            membershipNumber: true,

          },

        },

      },

      orderBy: [{ chargeDate: "asc" }],

    });

 

    if (charges.length === 0) {

      return {

        success: false,

        error: "No unpaid charges found to export",

      };

    }

 

    const flatData = charges.map((charge) => ({

      id: charge.id,

      memberId: charge.memberId,

      memberFirstName: charge.member.firstName,

      memberLastName: charge.member.lastName,

      membershipNumber: charge.member.membershipNumber,

      amount: charge.amount,

      description: charge.description,

      chargeDate: charge.chargeDate.toISOString(),

      status: charge.status,

      createdAt: charge.createdAt.toISOString(),

    }));

 

    const csv = toCSV(flatData, options);

    const filename = options.filename || generateFilename("charges-unpaid");

 

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error:

        error instanceof Error

          ? error.message

          : "Failed to export unpaid charges",

    };

  }

}

 

// ============================================================================

// AUDIT LOG EXPORTS

// ============================================================================

 

/**

 * Export audit logs to CSV

 */

export async function exportAuditLogs(

  options: DatabaseExportOptions = {}

): Promise<ExportResult> {

  try {

    const logs = await db.auditLog.findMany({

      orderBy: { timestamp: "desc" },

    });

 

    if (logs.length === 0) {

      return {

        success: false,

        error: "No audit logs found to export",

      };

    }

 

    // Flatten the data for CSV export

    const flatData = logs.map((log) => ({

      id: log.id,

      action: log.action,

      userId: log.userId,

      targetType: log.targetType,

      targetId: log.targetId,

      changes: JSON.stringify(log.changes),

      ipAddress: log.ipAddress,

      userAgent: log.userAgent,

      timestamp: log.timestamp.toISOString(),

    }));

 

    const csv = toCSV(flatData, options);

    const filename = options.filename || generateFilename("audit-logs");

 

    const result = await writeCSVToFile(

      csv,

      filename,

      options.directory || "exports"

    );

 

    return result;

  } catch (error) {

    return {

      success: false,

      error:

        error instanceof Error ? error.message : "Failed to export audit logs",

    };

  }

}

 

// ============================================================================

// BULK EXPORT

// ============================================================================

 

/**

 * Export all critical tables to CSV

 * Returns array of export results

 */

export async function exportAll(

  options: DatabaseExportOptions = {}

): Promise<ExportResult[]> {

  const results: ExportResult[] = [];

 

  // Export members

  results.push(await exportMembers(options));

 

  // Export teesheets

  results.push(await exportTeesheets(options));

 

  // Export time blocks

  results.push(await exportTimeBlocks(options));

 

  // Export lottery entries

  results.push(await exportLotteryEntries(options));

 

  // Export charges

  results.push(await exportCharges(options));

 

  // Export audit logs

  results.push(await exportAuditLogs(options));

 

  return results;

}

 

/**

 * Get summary of export results

 */

export function summarizeExports(results: ExportResult[]): string {

  const successful = results.filter((r) => r.success).length;

  const failed = results.filter((r) => !r.success).length;

  const totalRows = results

    .filter((r) => r.success)

    .reduce((sum, r) => sum + (r.rowCount || 0), 0);

 

  let summary = `Export Summary:\n`;

  summary += `  Successful: ${successful}\n`;

  summary += `  Failed: ${failed}\n`;

  summary += `  Total rows exported: ${totalRows}\n\n`;

 

  if (successful > 0) {

    summary += `Successfully exported:\n`;

    results

      .filter((r) => r.success)

      .forEach((r) => {

        summary += `  ✓ ${r.filename} (${r.rowCount} rows)\n`;

      });

  }

 

  if (failed > 0) {

    summary += `\nFailed exports:\n`;

    results

      .filter((r) => !r.success)

      .forEach((r) => {

        summary += `  ✗ ${r.error}\n`;

      });

  }

 

  return summary;

}