import { auth } from "@clerk/nextjs/server";
import { getMemberData } from "~/server/members-teesheet-client/data";
import { getMemberRoundsData } from "~/server/pace-of-play/data";
import { RoundsPageClient } from "~/components/member-rounds/RoundsPageClient";

export default async function RoundsPage() {
  const { sessionClaims } = await auth();
  const member = await getMemberData(sessionClaims?.userId as string);

  if (!member) {
    return (
      <div className="flex flex-col gap-6 px-4 pt-6 pb-24 sm:px-12">
        <p className="text-gray-500">Unable to load member data.</p>
      </div>
    );
  }

  const initialData = await getMemberRoundsData(member.id);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24 sm:px-12">
      <div>
        <h1 className="text-org-primary text-2xl font-bold">My Rounds</h1>
        <p className="text-gray-600">
          Track your pace of play and view round history
        </p>
      </div>

      <RoundsPageClient initialData={initialData} />
    </div>
  );
}
