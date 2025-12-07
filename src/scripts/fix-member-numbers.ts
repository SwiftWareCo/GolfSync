//ts-nocheck
import { parse } from "csv-parser";
import { createReadStream, writeFileSync } from "fs";
import path from "path";

interface Member {
  id: string;
  class: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  handicap: string;
  bagNumber: string;
}

interface Report {
  staffPrefixed: Member[];
  resignedPrefixed: Member[];
  emptyNumbered: Member[];
  skippedDuplicates: Member[];
  unchangedMembers: Member[];
}

async function fixMemberNumbers() {
  const report: Report = {
    staffPrefixed: [],
    resignedPrefixed: [],
    emptyNumbered: [],
    skippedDuplicates: [],
    unchangedMembers: [],
  };

  const memberMap = new Map<string, Member[]>();
  const members: Member[] = [];

  // Read and parse CSV
  const parser = createReadStream(path.join(process.cwd(), "users.csv")).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    }),
  );

  // First pass: collect all members and identify duplicates
  for await (const record of parser) {
    // Handle duplicate columns by using the first occurrence
    const member = {
      id: record["id"] || "",
      class: record["Class"] || record["class"] || "",
      memberNumber: record["Member Number"] || record["memberNumber"] || "",
      firstName: record["First Name"] || record["firstName"] || "",
      lastName: record["Last Name"] || record["lastName"] || "",
      username: record["Username"] || record["username"] || "",
      email: record["Email"] || record["email"] || "",
      gender: record["Gender"] || record["gender"] || "",
      dateOfBirth: record["Date of Birth"] || record["dateOfBirth"] || "",
      handicap: record["Handicap"] || record["handicap"] || "",
      bagNumber: record["Bag Number"] || record["bagNumber"] || "",
    };

    // Skip if all required fields are empty
    if (!member.memberNumber && !member.firstName && !member.lastName) {
      continue;
    }

    members.push(member);

    if (member.memberNumber) {
      const existing = memberMap.get(member.memberNumber) || [];
      existing.push(member);
      memberMap.set(member.memberNumber, existing);
    }
  }

  // Second pass: apply changes
  members.forEach((member) => {
    const duplicates = memberMap.get(member.memberNumber) || [];
    const isStaff = (member.class || "").includes("STAFF");
    const isResigned = (member.class || "").includes("RESIGNED");
    const isEmpty = !member.memberNumber || member.memberNumber === "0";
    const hasDuplicate = duplicates.length > 1;

    // Handle staff members
    if (isStaff) {
      member.memberNumber = `S-${member.memberNumber || "STAFF"}`;
      report.staffPrefixed.push(member);
    }
    // Handle resigned members
    else if (isResigned) {
      member.memberNumber = `R-${member.memberNumber || "RESIGNED"}`;
      report.resignedPrefixed.push(member);
    }
    // Handle empty numbers
    else if (isEmpty) {
      member.memberNumber = "EMPTY";
      report.emptyNumbered.push(member);
    }
    // Handle duplicates (skip for now)
    else if (hasDuplicate && !isStaff && !isResigned) {
      report.skippedDuplicates.push(member);
    }
    // Unchanged members
    else {
      report.unchangedMembers.push(member);
    }
  });

  // Generate new CSV with consistent column names
  const csvLines = [
    // Header - using camelCase for consistency
    "id,class,memberNumber,firstName,lastName,username,email,gender,dateOfBirth,handicap,bagNumber",
    // Data
    ...members.map((member) =>
      [
        member.id,
        member.class,
        member.memberNumber,
        member.firstName,
        member.lastName,
        member.username,
        member.email,
        member.gender,
        member.dateOfBirth,
        member.handicap,
        member.bagNumber,
      ]
        .map((value) => `"${value || ""}"`)
        .join(","),
    ),
  ];

  // Write new CSV
  writeFileSync("users_updated.csv", csvLines.join("\n"));

  // Generate detailed report
  console.log("\n=== Member Number Changes Report ===\n");

  console.log("1. Staff Members (Added S- prefix):");
  report.staffPrefixed.forEach((member) => {
    console.log(
      `   ${member.firstName} ${member.lastName}: ${member.memberNumber}`,
    );
  });

  console.log("\n2. Resigned Members (Added R- prefix):");
  report.resignedPrefixed.forEach((member) => {
    console.log(
      `   ${member.firstName} ${member.lastName}: ${member.memberNumber}`,
    );
  });

  console.log("\n3. Empty/Zero Numbers (Set to EMPTY):");
  report.emptyNumbered.forEach((member) => {
    console.log(
      `   ${member.firstName} ${member.lastName}: ${member.memberNumber}`,
    );
  });

  console.log("\n4. Skipped Duplicate Numbers:");
  report.skippedDuplicates.forEach((member) => {
    console.log(
      `   ${member.firstName} ${member.lastName}: ${member.memberNumber} (${member.class})`,
    );
  });

  console.log("\n=== Summary ===");
  console.log(`Total members processed: ${members.length}`);
  console.log(`Staff prefixes added: ${report.staffPrefixed.length}`);
  console.log(`Resigned prefixes added: ${report.resignedPrefixed.length}`);
  console.log(`Empty numbers standardized: ${report.emptyNumbered.length}`);
  console.log(`Duplicate numbers skipped: ${report.skippedDuplicates.length}`);
  console.log(`Unchanged members: ${report.unchangedMembers.length}`);
  console.log("\nNew CSV file created: users_updated.csv");
}

// Run the fix
fixMemberNumbers().catch(console.error);
