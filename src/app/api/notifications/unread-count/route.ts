import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUnreadNotificationCount } from "~/server/notifications/data";
import { getMemberData } from "~/server/members-teesheet-client/data";

export async function GET() {
  try {
    const { sessionClaims } = await auth();
    if (!sessionClaims?.userId) {
      return NextResponse.json({ count: 0 });
    }

    const member = await getMemberData(sessionClaims.userId as string);
    if (!member) {
      return NextResponse.json({ count: 0 });
    }

    const count = await getUnreadNotificationCount(member.id);

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching notification count:", error);
    return NextResponse.json({ count: 0 });
  }
}
