import { auth } from "@clerk/nextjs/server";
import {
  getMemberData,
  getUpcomingTeeTimes,
} from "~/server/members-teesheet-client/data";
import { getCourseInfo } from "~/server/settings/data";
import {
  getUpcomingEvents,
  getMemberEventRegistrations,
} from "~/server/events/data";
import { CourseInfoClient } from "~/components/course-info/CourseInfoClient";
import { WeatherDisplay } from "~/components/weather/WeatherDisplay";
import { UpcomingTeeTimes } from "~/components/member-teesheet-client/UpcomingTeeTimes";
import { type Member } from "~/app/types/MemberTypes";
import { EventTimetableRow } from "~/components/events/EventTimetableRow";
import Link from "next/link";
import { InstallPrompt } from "~/components/pwa/InstallPrompt";

export default async function MembersHome() {
  const { sessionClaims } = await auth();

  const member = await getMemberData(sessionClaims?.userId as string);

  // Get course info
  const courseInfo = await getCourseInfo();

  // Get upcoming tee times
  const upcomingTeeTimes = await getUpcomingTeeTimes(member as Member);

  // Get upcoming events for member's class
  const upcomingEvents = await getUpcomingEvents(3, member?.memberClass?.label);

  // Get member registrations for these events
  const memberRegistrations = member?.id
    ? await getMemberEventRegistrations(member.id)
    : [];

  // Create a map of eventIds to registration status
  const registrationMap = new Map();
  memberRegistrations.forEach((reg: { eventId: number; status: string }) => {
    registrationMap.set(reg.eventId, reg.status);
  });

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24 sm:px-12">
      <InstallPrompt />

      {/* Welcome Header */}
      {member?.firstName && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-org-primary text-2xl font-bold">
              Quilchena Golf Course
            </h1>
            <p className="text-lg text-gray-600">
              Welcome, {member.firstName}!
            </p>
          </div>
        </div>
      )}

      {/* Weather */}
      <WeatherDisplay />

      {/* Course Info */}
      {courseInfo && !("success" in courseInfo) && (
        <CourseInfoClient data={courseInfo} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-3 text-lg font-medium">Upcoming Tee Times</h3>
          <UpcomingTeeTimes teeTimes={upcomingTeeTimes} />
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-medium">Upcoming Events</h3>
            <Link
              href="/events"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All Events
            </Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-0">
              {upcomingEvents.map((event) => (
                <EventTimetableRow
                  key={event.id}
                  event={{
                    id: event.id,
                    name: event.name,
                    description: event.description,
                    eventType: event.eventType,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    location: event.location,
                    capacity: event.capacity,
                    requiresApproval: event.requiresApproval,
                    registrationDeadline: event.registrationDeadline,
                    isActive: event.isActive,
                    memberClassIds: event.memberClassIds,
                    teamSize: event.teamSize,
                    guestsAllowed: event.guestsAllowed,
                    createdAt: event.createdAt,
                    updatedAt: event.updatedAt,
                    details: event.details
                      ? {
                          format: event.details.format ?? undefined,
                          rules: event.details.rules ?? undefined,
                          prizes: event.details.prizes ?? undefined,
                          entryFee: event.details.entryFee ?? undefined,
                          additionalInfo:
                            event.details.additionalInfo ?? undefined,
                        }
                      : null,
                    registrationsCount: event.registrationsCount,
                    pendingRegistrationsCount:
                      event.pendingRegistrationsCount,
                  }}
                  memberId={member?.id}
                  isRegistered={registrationMap.has(event.id)}
                  registrationStatus={registrationMap.get(event.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No upcoming events.</p>
          )}
        </div>
      </div>
    </div>
  );
}
