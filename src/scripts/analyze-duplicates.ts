//@ts-nocheck
import { parse } from "csv-parse";
import { createReadStream } from "fs";
import path from "path";

interface Member {
  memberNumber: string;
  firstName: string;
  lastName: string;
  class: string;
  email: string;
}

async function analyzeDuplicates() {
  const memberMap = new Map<string, Member[]>();
  const emptyMemberNumbers: Member[] = [];

  // Create a read stream from the CSV file
  const parser = createReadStream(path.join(process.cwd(), "users.csv")).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    }),
  );

  for await (const record of parser) {
    const member: Member = {
      memberNumber: record["Member Number"],
      firstName: record["First Name"],
      lastName: record["Last Name"],
      class: record["Class"],
      email: record["Email"],
    };

    // Handle empty or zero member numbers
    if (!member.memberNumber || member.memberNumber === "0") {
      emptyMemberNumbers.push(member);
      continue;
    }

    // Add to map
    const existing = memberMap.get(member.memberNumber) || [];
    existing.push(member);
    memberMap.set(member.memberNumber, existing);
  }

  // Print report
  console.log("\n=== Duplicate Member Numbers Report ===\n");

  // Report duplicates
  let hasDuplicates = false;
  memberMap.forEach((members, memberNumber) => {
    if (members.length > 1) {
      hasDuplicates = true;
      console.log(`\nMember Number: ${memberNumber}`);
      members.forEach((member, index) => {
        console.log(
          `${index + 1}. ${member.firstName} ${member.lastName} (${member.class})`,
        );
        console.log(`   Email: ${member.email || "No email"}`);
      });
    }
  });

  if (!hasDuplicates) {
    console.log(
      "No duplicate member numbers found (excluding empty/zero numbers).",
    );
  }

  // Report empty/zero member numbers
  console.log("\n=== Members with Empty or Zero Member Numbers ===\n");
  if (emptyMemberNumbers.length === 0) {
    console.log("No members with empty or zero member numbers found.");
  } else {
    emptyMemberNumbers.forEach((member, index) => {
      console.log(
        `${index + 1}. ${member.firstName} ${member.lastName} (${member.class})`,
      );
      console.log(`   Email: ${member.email || "No email"}`);
    });
  }

  // Print summary
  console.log("\n=== Summary ===");
  console.log(
    `Total members: ${[...memberMap.values()].flat().length + emptyMemberNumbers.length}`,
  );
  console.log(`Unique member numbers: ${memberMap.size}`);
  console.log(`Members with empty/zero numbers: ${emptyMemberNumbers.length}`);
  console.log(
    `Members with duplicate numbers: ${[...memberMap.values()].filter((m) => m.length > 1).flat().length}`,
  );
}

// Run the analysis
analyzeDuplicates().catch(console.error);
