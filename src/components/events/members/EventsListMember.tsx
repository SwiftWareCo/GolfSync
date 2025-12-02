"use client";

import { EventCard } from "~/components/events/EventCard";
import type { Event, EventRegistration } from "~/server/events/data";

interface EventsListMemberProps {
  initialEvents: Event[];
  memberId?: number;
  memberRegistrations: Map<number, string>;
  memberRegistrationData: Map<number, EventRegistration>;
}

export default function EventsListMember({
  initialEvents,
  memberId,
  memberRegistrations,
  memberRegistrationData,
}: EventsListMemberProps) {
  return (
    <div className="space-y-8">
      {initialEvents.length === 0 ? (
        <div className="bg-muted/10 rounded-md border p-8 text-center">
          <p className="text-muted-foreground">No events found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {initialEvents.map((event) => {
            const isReg = memberRegistrations.has(event.id);
            const regStatus = memberRegistrations.get(event.id);
            const regData = memberRegistrationData.get(event.id) || null;

            console.log(`Event ${event.name}:`, {
              isRegistered: isReg,
              status: regStatus,
              hasData: !!regData,
            });

            return (
              <EventCard
                key={event.id}
                event={event}
                className="h-full"
                isMember={true}
                memberId={memberId}
                isRegistered={isReg}
                registrationStatus={regStatus}
                registrationData={regData}
                variant="compact"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
