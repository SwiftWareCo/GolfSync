/**

 * Tests for Data Export Utilities

 */

 

import { describe, it, expect } from "vitest";

import {

  toCSV,

  fromCSV,

  generateFilename,

  getCSVSize,

  formatSize,

  type ExportOptions,

} from "../export";

 

describe("toCSV", () => {

  it("should convert array of objects to CSV with headers", () => {

    const data = [

      { id: 1, name: "John", age: 30 },

      { id: 2, name: "Jane", age: 25 },

    ];

 

    const result = toCSV(data);

 

    expect(result).toBe('id,name,age\n1,John,30\n2,Jane,25');

  });

 

  it("should convert array of objects without headers", () => {

    const data = [

      { id: 1, name: "John" },

      { id: 2, name: "Jane" },

    ];

 

    const result = toCSV(data, { includeHeaders: false });

 

    expect(result).toBe('1,John\n2,Jane');

  });

 

  it("should handle empty array", () => {

    const result = toCSV([]);

    expect(result).toBe("");

  });

 

  it("should escape fields with commas", () => {

    const data = [{ name: "Smith, John", age: 30 }];

    const result = toCSV(data);

    expect(result).toContain('"Smith, John"');

  });

 

  it("should escape fields with quotes", () => {

    const data = [{ name: 'John "Johnny" Smith', age: 30 }];

    const result = toCSV(data);

    expect(result).toContain('"John ""Johnny"" Smith"');

  });

 

  it("should escape fields with newlines", () => {

    const data = [{ name: "John\nSmith", age: 30 }];

    const result = toCSV(data);

    expect(result).toContain('"John\nSmith"');

  });

 

  it("should handle null and undefined values", () => {

    const data = [{ id: 1, name: null, age: undefined }];

    const result = toCSV(data);

    expect(result).toBe('id,name,age\n1,,');

  });

 

  it("should handle Date objects with ISO format", () => {

    const date = new Date("2025-01-15T10:30:00Z");

    const data = [{ id: 1, createdAt: date }];

    const result = toCSV(data, { dateFormat: "iso" });

    expect(result).toContain(date.toISOString());

  });

 

  it("should handle objects by JSON stringifying them", () => {

    const data = [{ id: 1, metadata: { key: "value" } }];

    const result = toCSV(data);

    expect(result).toContain('"{""key"":""value""}"');

  });

 

  it("should use custom delimiter", () => {

    const data = [

      { id: 1, name: "John" },

      { id: 2, name: "Jane" },

    ];

    const result = toCSV(data, { delimiter: ";" });

    expect(result).toBe('id;name\n1;John\n2;Jane');

  });

 

  it("should use custom line ending", () => {

    const data = [

      { id: 1, name: "John" },

      { id: 2, name: "Jane" },

    ];

    const result = toCSV(data, { lineEnding: "\r\n" });

    expect(result).toBe('id,name\r\n1,John\r\n2,Jane');

  });

 

  it("should handle complex nested data", () => {

    const data = [

      {

        id: 1,

        name: "John",

        address: { street: "123 Main St", city: "Boston" },

      },

    ];

    const result = toCSV(data);

    expect(result).toContain('"{""street"":""123 Main St"",""city"":""Boston""}"');

  });

});

 

describe("fromCSV", () => {

  it("should parse CSV with headers", () => {

    const csv = 'id,name,age\n1,John,30\n2,Jane,25';

    const result = fromCSV(csv);

 

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({ id: "1", name: "John", age: "30" });

    expect(result[1]).toEqual({ id: "2", name: "Jane", age: "25" });

  });

 

  it("should parse CSV without headers", () => {

    const csv = '1,John,30\n2,Jane,25';

    const result = fromCSV(csv, { includeHeaders: false });

 

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({ column_0: "1", column_1: "John", column_2: "30" });

  });

 

  it("should handle empty CSV", () => {

    const result = fromCSV("");

    expect(result).toHaveLength(0);

  });

 

  it("should handle quoted fields", () => {

    const csv = 'name,age\n"Smith, John",30';

    const result = fromCSV(csv);

 

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({ name: "Smith, John", age: "30" });

  });

 

  it("should handle escaped quotes", () => {

    const csv = 'name,age\n"John ""Johnny"" Smith",30';

    const result = fromCSV(csv);

 

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({ name: 'John "Johnny" Smith', age: "30" });

  });

 

  it("should parse JSON objects in fields", () => {

    const csv = 'id,metadata\n1,"{""key"":""value""}"';

    const result = fromCSV(csv);

 

    expect(result).toHaveLength(1);

    expect(result[0]?.metadata).toEqual({ key: "value" });

  });

 

  it("should use custom delimiter", () => {

    const csv = 'id;name;age\n1;John;30';

    const result = fromCSV(csv, { delimiter: ";" });

 

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({ id: "1", name: "John", age: "30" });

  });

});

 

describe("generateFilename", () => {

  it("should generate filename with timestamp and default extension", () => {

    const filename = generateFilename("members");

    const today = new Date().toISOString().split("T")[0];

 

    expect(filename).toBe(`members-${today}.csv`);

  });

 

  it("should generate filename with custom extension", () => {

    const filename = generateFilename("members", "txt");

    const today = new Date().toISOString().split("T")[0];

 

    expect(filename).toBe(`members-${today}.txt`);

  });

 

  it("should generate filename with prefix containing special characters", () => {

    const filename = generateFilename("members-active-2025");

    expect(filename).toMatch(/^members-active-2025-\d{4}-\d{2}-\d{2}\.csv$/);

  });

});

 

describe("getCSVSize", () => {

  it("should return correct size for simple CSV", () => {

    const csv = "id,name\n1,John";

    const size = getCSVSize(csv);

 

    expect(size).toBeGreaterThan(0);

    expect(size).toBe(new Blob([csv]).size);

  });

 

  it("should return 0 for empty CSV", () => {

    const size = getCSVSize("");

    expect(size).toBe(0);

  });

 

  it("should handle large CSV strings", () => {

    const csv = "id,name\n" + Array(1000).fill("1,John").join("\n");

    const size = getCSVSize(csv);

 

    expect(size).toBeGreaterThan(1000);

  });

});

 

describe("formatSize", () => {

  it("should format bytes", () => {

    expect(formatSize(100)).toBe("100 B");

    expect(formatSize(500)).toBe("500 B");

  });

 

  it("should format kilobytes", () => {

    expect(formatSize(1024)).toBe("1.00 KB");

    expect(formatSize(2048)).toBe("2.00 KB");

    expect(formatSize(1536)).toBe("1.50 KB");

  });

 

  it("should format megabytes", () => {

    expect(formatSize(1024 * 1024)).toBe("1.00 MB");

    expect(formatSize(1024 * 1024 * 2.5)).toBe("2.50 MB");

  });

 

  it("should format gigabytes", () => {

    expect(formatSize(1024 * 1024 * 1024)).toBe("1.00 GB");

    expect(formatSize(1024 * 1024 * 1024 * 2)).toBe("2.00 GB");

  });

});

 

describe("CSV round-trip", () => {

  it("should convert to CSV and back without data loss", () => {

    const original = [

      { id: 1, name: "John", age: 30 },

      { id: 2, name: "Jane", age: 25 },

    ];

 

    const csv = toCSV(original);

    const parsed = fromCSV(csv);

 

    expect(parsed).toHaveLength(2);

    expect(parsed[0]).toEqual({

      id: "1",

      name: "John",

      age: "30",

    });

  });

 

  it("should handle complex data in round-trip", () => {

    const original = [

      {

        id: 1,

        name: 'Smith, "Johnny"',

        metadata: { key: "value" },

      },

    ];

 

    const csv = toCSV(original);

    const parsed = fromCSV(csv);

 

    expect(parsed).toHaveLength(1);

    expect(parsed[0]?.name).toBe('Smith, "Johnny"');

    expect(parsed[0]?.metadata).toEqual({ key: "value" });

  });

});