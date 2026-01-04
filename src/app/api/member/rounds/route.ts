import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getMemberData } from "~/server/members-teesheet-client/data";
import { getMemberRoundsData } from "~/server/pace-of-play/data";

export async function GET() {
  try {
    const { sessionClaims } = await auth();
    if (!sessionClaims?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await getMemberData(sessionClaims.userId as string);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const data = await getMemberRoundsData(member.id);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching member rounds:", error);
    return NextResponse.json(
      { error: "Failed to fetch rounds data" },
      { status: 500 },
    );
  }
}
