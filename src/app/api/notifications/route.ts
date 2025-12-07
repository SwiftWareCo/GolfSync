import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUnreadNotifications } from "~/server/notifications/data";
import { getMemberData } from "~/server/members-teesheet-client/data";

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

    const notifications = await getUnreadNotifications(member.id);

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}
