import { auth } from "@clerk/nextjs/server";
import { getMemberData } from "~/server/members-teesheet-client/data";
import {
  getEventsForClass,
  getMemberEventRegistrations,
  getMemberRegistrationForEvent,
} from "~/server/events/data";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import EventsListMember from "~/components/events/members/EventsListMember";

export default async function EventsPage() {
  const { sessionClaims } = await auth();
  const member = await getMemberData(sessionClaims?.userId as string);

  // Get all events for the member's class
  const events = await getEventsForClass(member?.class!);

  // Get member registrations for these events
  const memberRegistrations = member?.id
    ? await getMemberEventRegistrations(member.id)
    : [];

  // Create a map of eventIds to registration status
  const registrationStatusMap = new Map();
  memberRegistrations.forEach((reg: { eventId: number; status: string }) => {
    registrationStatusMap.set(reg.eventId, reg.status);
  });

  // Fetch full registration data for each registered event
  const registrationDataMap = new Map();
  if (member?.id) {
    await Promise.all(
      events.map(async (event) => {
        if (registrationStatusMap.has(event.id)) {
          const regData = await getMemberRegistrationForEvent(event.id, member.id);
          if (regData) {
            registrationDataMap.set(event.id, regData);
          }
        }
      })
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-16 sm:px-12 md:pt-24">
      <div className="flex items-center gap-4">
        <Link
          href="/members"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold">All Events</h1>
      </div>

      <EventsListMember
        initialEvents={events}
        memberId={member?.id}
        memberRegistrations={registrationStatusMap}
        memberRegistrationData={registrationDataMap}
      />
    </div>
  );
}
