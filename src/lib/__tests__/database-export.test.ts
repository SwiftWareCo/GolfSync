/**

 * Tests for Database Export Functions

 */

 

import { describe, it, expect, vi, beforeEach } from "vitest";

import {

  exportMembers,

  exportActiveMembers,

  exportTeesheets,

  exportTimeBlocks,

  exportLotteryEntries,

  exportCharges,

  exportUnpaidCharges,

  exportAuditLogs,

  summarizeExports,

  type ExportResult,

} from "../database-export";

import { db } from "~/server/db";

 

// Mock the database

vi.mock("~/server/db", () => ({

  db: {

    member: {

      findMany: vi.fn(),

    },

    teesheet: {

      findMany: vi.fn(),

    },

    timeBlock: {

      findMany: vi.fn(),

    },

    lotteryEntry: {

      findMany: vi.fn(),

    },

    charge: {

      findMany: vi.fn(),

    },

    auditLog: {

      findMany: vi.fn(),

    },

  },

}));

 

// Mock the export utility functions

vi.mock("../export", () => ({

  toCSV: vi.fn((data) => {

    // Simple CSV mock

    if (data.length === 0) return "";

    const headers = Object.keys(data[0]!).join(",");

    const rows = data.map((row) => Object.values(row).join(",")).join("\n");

    return `${headers}\n${rows}`;

  }),

  writeCSVToFile: vi.fn(async (csv, filename) => ({

    success: true,

    filename: `exports/${filename}`,

    rowCount: csv.split("\n").length - 1,

  })),

  generateFilename: vi.fn((prefix) => `${prefix}-2025-11-13.csv`),

}));

 

describe("exportMembers", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  it("should export all members successfully", async () => {

    const mockMembers = [

      {

        id: "1",

        firstName: "John",

        lastName: "Smith",

        email: "john@example.com",

        status: "active",

      },

      {

        id: "2",

        firstName: "Jane",

        lastName: "Doe",

        email: "jane@example.com",

        status: "active",

      },

    ];

 

    vi.mocked(db.member.findMany).mockResolvedValue(mockMembers as any);

 

    const result = await exportMembers();

 

    expect(result.success).toBe(true);

    expect(result.filename).toBe("exports/members-2025-11-13.csv");

    expect(result.rowCount).toBe(2);

    expect(db.member.findMany).toHaveBeenCalledWith({

      orderBy: { id: "asc" },

    });

  });

 

  it("should handle no members found", async () => {

    vi.mocked(db.member.findMany).mockResolvedValue([]);

 

    const result = await exportMembers();

 

    expect(result.success).toBe(false);

    expect(result.error).toBe("No members found to export");

  });

 

  it("should handle database errors", async () => {

    vi.mocked(db.member.findMany).mockRejectedValue(

      new Error("Database connection failed")

    );

 

    const result = await exportMembers();

 

    expect(result.success).toBe(false);

    expect(result.error).toBe("Database connection failed");

  });

});

 

describe("exportActiveMembers", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  it("should export only active members", async () => {

    const mockMembers = [

      {

        id: "1",

        firstName: "John",

        lastName: "Smith",

        status: "active",

      },

    ];

 

    vi.mocked(db.member.findMany).mockResolvedValue(mockMembers as any);

 

    const result = await exportActiveMembers();

 

    expect(result.success).toBe(true);

    expect(db.member.findMany).toHaveBeenCalledWith({

      where: { status: "active" },

      orderBy: { lastName: "asc" },

    });

  });

 

  it("should handle no active members", async () => {

    vi.mocked(db.member.findMany).mockResolvedValue([]);

 

    const result = await exportActiveMembers();

 

    expect(result.success).toBe(false);

    expect(result.error).toBe("No active members found to export");

  });

});

 

describe("exportTeesheets", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  it("should export all teesheets successfully", async () => {

    const mockTeesheets = [

      {

        id: "1",

        date: new Date("2025-11-15"),

        title: "Morning Round",

        status: "open",

      },

      {

        id: "2",

        date: new Date("2025-11-16"),

        title: "Afternoon Round",

        status: "open",

      },

    ];

 

    vi.mocked(db.teesheet.findMany).mockResolvedValue(mockTeesheets as any);

 

    const result = await exportTeesheets();

 

    expect(result.success).toBe(true);

    expect(result.rowCount).toBe(2);

    expect(db.teesheet.findMany).toHaveBeenCalledWith({

      orderBy: { date: "desc" },

    });

  });

 

  it("should handle no teesheets found", async () => {

    vi.mocked(db.teesheet.findMany).mockResolvedValue([]);

 

    const result = await exportTeesheets();

 

    expect(result.success).toBe(false);

    expect(result.error).toBe("No teesheets found to export");

  });

});

 

describe("exportTimeBlocks", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  it("should export time blocks with member and teesheet data", async () => {

    const mockTimeBlocks = [

      {

        id: "1",

        teesheetId: "ts1",

        memberId: "m1",

        startTime: "09:00",

        endTime: "09:10",

        status: "booked",

        bookingType: "regular",

        createdAt: new Date("2025-11-13"),

        updatedAt: new Date("2025-11-13"),

        member: {

          id: "m1",

          firstName: "John",

          lastName: "Smith",

          membershipNumber: "M001",

        },

        teesheet: {

          id: "ts1",

          date: new Date("2025-11-15"),

          title: "Morning Round",

        },

      },

    ];

 

    vi.mocked(db.timeBlock.findMany).mockResolvedValue(mockTimeBlocks as any);

 

    const result = await exportTimeBlocks();

 

    expect(result.success).toBe(true);

    expect(result.rowCount).toBe(1);

    expect(db.timeBlock.findMany).toHaveBeenCalledWith({

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

  });

 

  it("should handle no time blocks found", async () => {

    vi.mocked(db.timeBlock.findMany).mockResolvedValue([]);

 

    const result = await exportTimeBlocks();

 

    expect(result.success).toBe(false);

    expect(result.error).toBe("No time blocks found to export");

  });

});

 

describe("exportLotteryEntries", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  it("should export lottery entries with member and teesheet data", async () => {

    const mockEntries = [

      {

        id: "1",

        teesheetId: "ts1",

        memberId: "m1",

        status: "pending",

        priority: 1,

        createdAt: new Date("2025-11-13"),

        updatedAt: new Date("2025-11-13"),

        member: {

          id: "m1",

          firstName: "John",

          lastName: "Smith",

          membershipNumber: "M001",

        },

        teesheet: {

          id: "ts1",

          date: new Date("2025-11-15"),

          title: "Weekend Lottery",

        },

      },

    ];

 

    vi.mocked(db.lotteryEntry.findMany).mockResolvedValue(mockEntries as any);

 

    const result = await exportLotteryEntries();

 

    expect(result.success).toBe(true);

    expect(result.rowCount).toBe(1);

  });

 

  it("should handle no lottery entries found", async () => {

    vi.mocked(db.lotteryEntry.findMany).mockResolvedValue([]);

 

    const result = await exportLotteryEntries();

 

    expect(result.success).toBe(false);

    expect(result.error).toBe("No lottery entries found to export");

  });

});

 

describe("exportCharges", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  it("should export all charges with member data", async () => {

    const mockCharges = [

      {

        id: "1",

        memberId: "m1",

        amount: 50.0,

        description: "Cart rental",

        chargeDate: new Date("2025-11-13"),

        status: "pending",

        createdAt: new Date("2025-11-13"),

        updatedAt: new Date("2025-11-13"),

        member: {

          id: "m1",

          firstName: "John",

          lastName: "Smith",

          membershipNumber: "M001",

        },

      },

    ];

 

    vi.mocked(db.charge.findMany).mockResolvedValue(mockCharges as any);

 

    const result = await exportCharges();

 

    expect(result.success).toBe(true);

    expect(result.rowCount).toBe(1);

  });

 

  it("should handle no charges found", async () => {

    vi.mocked(db.charge.findMany).mockResolvedValue([]);

 

    const result = await exportCharges();

 

    expect(result.success).toBe(false);

    expect(result.error).toBe("No charges found to export");

  });

});

 

describe("exportUnpaidCharges", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  it("should export only unpaid charges", async () => {

    const mockCharges = [

      {

        id: "1",

        memberId: "m1",

        amount: 50.0,

        description: "Cart rental",

        chargeDate: new Date("2025-11-13"),

        status: "pending",

        createdAt: new Date("2025-11-13"),

        member: {

          id: "m1",

          firstName: "John",

          lastName: "Smith",

          membershipNumber: "M001",

        },

      },

    ];

 

    vi.mocked(db.charge.findMany).mockResolvedValue(mockCharges as any);

 

    const result = await exportUnpaidCharges();

 

    expect(result.success).toBe(true);

    expect(db.charge.findMany).toHaveBeenCalledWith({

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

  });

});

 

describe("exportAuditLogs", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  it("should export audit logs successfully", async () => {

    const mockLogs = [

      {

        id: "1",

        action: "CREATE",

        userId: "u1",

        targetType: "member",

        targetId: "m1",

        changes: { status: "active" },

        ipAddress: "192.168.1.1",

        userAgent: "Mozilla/5.0",

        timestamp: new Date("2025-11-13"),

      },

    ];

 

    vi.mocked(db.auditLog.findMany).mockResolvedValue(mockLogs as any);

 

    const result = await exportAuditLogs();

 

    expect(result.success).toBe(true);

    expect(result.rowCount).toBe(1);

  });

 

  it("should handle no audit logs found", async () => {

    vi.mocked(db.auditLog.findMany).mockResolvedValue([]);

 

    const result = await exportAuditLogs();

 

    expect(result.success).toBe(false);

    expect(result.error).toBe("No audit logs found to export");

  });

});

 

describe("summarizeExports", () => {

  it("should summarize successful exports", () => {

    const results: ExportResult[] = [

      { success: true, filename: "members.csv", rowCount: 100 },

      { success: true, filename: "teesheets.csv", rowCount: 50 },

    ];

 

    const summary = summarizeExports(results);

 

    expect(summary).toContain("Successful: 2");

    expect(summary).toContain("Failed: 0");

    expect(summary).toContain("Total rows exported: 150");

    expect(summary).toContain("members.csv (100 rows)");

    expect(summary).toContain("teesheets.csv (50 rows)");

  });

 

  it("should summarize failed exports", () => {

    const results: ExportResult[] = [

      { success: true, filename: "members.csv", rowCount: 100 },

      { success: false, error: "Database connection failed" },

    ];

 

    const summary = summarizeExports(results);

 

    expect(summary).toContain("Successful: 1");

    expect(summary).toContain("Failed: 1");

    expect(summary).toContain("Database connection failed");

  });

 

  it("should handle all failed exports", () => {

    const results: ExportResult[] = [

      { success: false, error: "Error 1" },

      { success: false, error: "Error 2" },

    ];

 

    const summary = summarizeExports(results);

 

    expect(summary).toContain("Successful: 0");

    expect(summary).toContain("Failed: 2");

    expect(summary).toContain("Total rows exported: 0");

  });

 

  it("should handle empty results", () => {

    const summary = summarizeExports([]);

 

    expect(summary).toContain("Successful: 0");

    expect(summary).toContain("Failed: 0");

    expect(summary).toContain("Total rows exported: 0");

  });

});