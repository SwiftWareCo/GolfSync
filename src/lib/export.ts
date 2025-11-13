/**

 * Data Export Utilities

 *

 * Provides functions for exporting database tables to CSV format

 * for backup, analysis, and data portability.

 */

 

import { formatDate } from "./dates";

 

// ============================================================================

// TYPES

// ============================================================================

 

export type ExportOptions = {

  /** Include header row with column names */

  includeHeaders?: boolean;

  /** Date format for timestamp fields (default: ISO 8601) */

  dateFormat?: "iso" | "readable";

  /** Field delimiter (default: comma) */

  delimiter?: string;

  /** Quote character for fields containing delimiter (default: double quote) */

  quote?: string;

  /** Line ending (default: \n) */

  lineEnding?: string;

};

 

export type ExportResult = {

  success: boolean;

  filename?: string;

  rowCount?: number;

  error?: string;

  csv?: string;

};

 

// ============================================================================

// CSV FORMATTING

// ============================================================================

 

/**

 * Escape a field value for CSV format

 */

function escapeCSVField(value: any, options: Required<ExportOptions>): string {

  if (value === null || value === undefined) {

    return "";

  }

 

  // Convert to string

  let str = String(value);

 

  // Handle dates

  if (value instanceof Date) {

    str = options.dateFormat === "readable"

      ? formatDate(value)

      : value.toISOString();

  }

 

  // Handle objects/arrays

  if (typeof value === "object" && !(value instanceof Date)) {

    str = JSON.stringify(value);

  }

 

  // Escape if contains delimiter, quote, or newline

  if (

    str.includes(options.delimiter) ||

    str.includes(options.quote) ||

    str.includes("\n") ||

    str.includes("\r")

  ) {

    // Escape quotes by doubling them

    str = str.replace(new RegExp(options.quote, "g"), options.quote + options.quote);

    // Wrap in quotes

    str = options.quote + str + options.quote;

  }

 

  return str;

}

 

/**

 * Convert array of objects to CSV string

 */

export function toCSV<T extends Record<string, any>>(

  data: T[],

  options: ExportOptions = {}

): string {

  const opts: Required<ExportOptions> = {

    includeHeaders: options.includeHeaders ?? true,

    dateFormat: options.dateFormat ?? "iso",

    delimiter: options.delimiter ?? ",",

    quote: options.quote ?? '"',

    lineEnding: options.lineEnding ?? "\n",

  };

 

  if (data.length === 0) {

    return "";

  }

 

  const lines: string[] = [];

 

  // Add headers

  if (opts.includeHeaders) {

    const headers = Object.keys(data[0]!);

    lines.push(headers.map((h) => escapeCSVField(h, opts)).join(opts.delimiter));

  }

 

  // Add data rows

  for (const row of data) {

    const values = Object.values(row);

    lines.push(values.map((v) => escapeCSVField(v, opts)).join(opts.delimiter));

  }

 

  return lines.join(opts.lineEnding);

}

 

/**

 * Generate filename with timestamp

 */

export function generateFilename(prefix: string, extension: string = "csv"): string {

  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  return `${prefix}-${timestamp}.${extension}`;

}

 

// ============================================================================

// EXPORT TO FILE (Node.js only)

// ============================================================================

 

/**

 * Write CSV string to file

 *

 * Note: This function uses Node.js fs module and should only be used

 * in server-side code or scripts.

 */

export async function writeCSVToFile(

  csv: string,

  filename: string,

  directory: string = "exports"

): Promise<ExportResult> {

  try {

    // Dynamic import for Node.js modules

    const fs = await import("fs/promises");

    const path = await import("path");

 

    // Ensure export directory exists

    const exportDir = path.resolve(process.cwd(), directory);

    await fs.mkdir(exportDir, { recursive: true });

 

    // Write file

    const filepath = path.join(exportDir, filename);

    await fs.writeFile(filepath, csv, "utf-8");

 

    // Count rows (excluding header)

    const rowCount = csv.split("\n").length - 1;

 

    return {

      success: true,

      filename: filepath,

      rowCount,

    };

  } catch (error) {

    return {

      success: false,

      error: error instanceof Error ? error.message : "Failed to write file",

    };

  }

}

 

/**

 * Export data to CSV file

 */

export async function exportToCSV<T extends Record<string, any>>(

  data: T[],

  filename: string,

  options: ExportOptions = {}

): Promise<ExportResult> {

  try {

    const csv = toCSV(data, options);

 

    if (!csv) {

      return {

        success: false,

        error: "No data to export",

      };

    }

 

    const result = await writeCSVToFile(csv, filename);

 

    return result;

  } catch (error) {

    return {

      success: false,

      error: error instanceof Error ? error.message : "Export failed",

    };

  }

}

 

// ============================================================================

// BROWSER DOWNLOAD

// ============================================================================

 

/**

 * Trigger browser download of CSV data

 *

 * This works in client-side code to download CSV files

 */

export function downloadCSV(csv: string, filename: string): void {

  // Create blob

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

 

  // Create download link

  const link = document.createElement("a");

  const url = URL.createObjectURL(blob);

 

  link.setAttribute("href", url);

  link.setAttribute("download", filename);

  link.style.visibility = "hidden";

 

  // Trigger download

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

 

  // Cleanup

  URL.revokeObjectURL(url);

}

 

/**

 * Export data and trigger browser download

 */

export function exportAndDownload<T extends Record<string, any>>(

  data: T[],

  filename: string,

  options: ExportOptions = {}

): ExportResult {

  try {

    const csv = toCSV(data, options);

 

    if (!csv) {

      return {

        success: false,

        error: "No data to export",

      };

    }

 

    downloadCSV(csv, filename);

 

    return {

      success: true,

      filename,

      rowCount: data.length,

      csv,

    };

  } catch (error) {

    return {

      success: false,

      error: error instanceof Error ? error.message : "Export failed",

    };

  }

}

 

// ============================================================================

// UTILITY FUNCTIONS

// ============================================================================

 

/**
* Parse a CSV line respecting quoted fields

 */

function parseCSVLine(line: string, delimiter: string, quote: string): string[] {

  const values: string[] = [];

  let current = "";

  let inQuotes = false;

  let i = 0;

 

  while (i < line.length) {

    const char = line[i]!;

    const nextChar = line[i + 1];

 

    if (char === quote) {

      if (inQuotes && nextChar === quote) {

        // Escaped quote (two quotes in a row)

        current += quote;

        i += 2;

        continue;

      } else {

        // Toggle quote state

        inQuotes = !inQuotes;

        i++;

        continue;

      }

    }

 

    if (char === delimiter && !inQuotes) {

      // End of field

      values.push(current);

      current = "";

      i++;

      continue;

    }

 

    // Regular character

    current += char;

    i++;

  }

 

  // Push the last field

  values.push(current);

 

  return values;

}

 

/**

 * Parse CSV string to array of objects

 */

export function fromCSV<T extends Record<string, any>>(

  csv: string,

  options: ExportOptions = {}

): T[] {

  const opts: Required<ExportOptions> = {

    includeHeaders: options.includeHeaders ?? true,

    dateFormat: options.dateFormat ?? "iso",

    delimiter: options.delimiter ?? ",",

    quote: options.quote ?? '"',

    lineEnding: options.lineEnding ?? "\n",

  };

 

  const lines = csv.split(opts.lineEnding).filter((line) => line.trim());

 

  if (lines.length === 0) {

    return [];

  }

 

  // Parse headers

  const headers = opts.includeHeaders

    ? parseCSVLine(lines[0]!, opts.delimiter, opts.quote).map((h) => h.trim())

    : [];

 

  const dataLines = opts.includeHeaders ? lines.slice(1) : lines;

 

  // Parse data rows

  const data: T[] = [];

 

  for (const line of dataLines) {

    const values = parseCSVLine(line, opts.delimiter, opts.quote);

    const row: any = {};

 

    for (let i = 0; i < values.length; i++) {

      const key = headers[i] || `column_${i}`;

      let value: any = values[i]?.trim() || "";

      // Try to parse as JSON for objects/arrays

      if (value.startsWith("{") || value.startsWith("[")) {

        try {

          value = JSON.parse(value);

        } catch {

          // Keep as string if not valid JSON

        }

      }

 

      row[key] = value;

    }

 

    data.push(row);

  }

 

  return data;

}

 

/**

 * Get CSV file size in bytes

 */

export function getCSVSize(csv: string): number {

  return new Blob([csv]).size;

}

 

/**

 * Format CSV size to human-readable string

 */

export function formatSize(bytes: number): string {

  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;

  if (bytes < 1024 * 1024 * 1024)

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;

}