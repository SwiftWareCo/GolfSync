import { FooterNavClient } from "./FooterNavClient";
import { getMemberData } from "~/server/members-teesheet-client/data";
import { auth } from "@clerk/nextjs/server";

export async function FooterNav() {
  const { sessionClaims } = await auth();

  const member = await getMemberData(sessionClaims?.userId as string);

  // Cast to any to resolve pushSubscription type mismatch (Drizzle returns unknown, but Member type expects Json)
  return <FooterNavClient member={member as any} />;
}
