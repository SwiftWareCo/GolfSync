// scripts/export-members-for-clerk.ts
//@ts-nocheck
import { db } from "~/server/db";
import { members } from "~/server/db/schema";
import * as fs from "fs";

async function exportMembersToJson() {
  // Get all members from database with their class info
  const allMembers = await db.query.members.findMany({
    with: {
      memberClass: true,
    },
  });

  // Format for Clerk migration
  const clerkUsers = allMembers.map((member) => ({
    userId: member.id.toString(),
    email: member.email || `${member.username}@placeholder.com`, // Fallback if no email
    username: member.username, // Add username as a separate field
    firstName: member.firstName,
    lastName: member.lastName,
    password: member.username, // Using username as password
    public_metadata: {
      isMember: true,
      memberNumber: member.memberNumber,
      class: member.memberClass?.label,
    },
  }));

  fs.writeFileSync("./users.json", JSON.stringify(clerkUsers, null, 2));
  console.log(`Exported ${clerkUsers.length} members to users.json`);
}

exportMembersToJson().catch(console.error);
