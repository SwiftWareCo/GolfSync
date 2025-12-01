import { Suspense } from "react";
import EventsList from "../../../../components/events/admin/EventsList";
import { PageHeader } from "~/components/ui/page-header";
import { getEvents } from "~/server/events/data";
import { getActiveMemberClasses } from "~/server/member-classes/data";
import { EventDialog } from "~/components/events/admin/EventDialog";

export default async function EventsPage() {
  const [events, memberClasses] = await Promise.all([
    getEvents(),
    getActiveMemberClasses(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Manage tournaments, dinners, social events and more"
      />

      <div className="flex justify-end">
        <EventDialog memberClasses={memberClasses} />
      </div>

      <Suspense fallback={<div>Loading events...</div>}>
        <EventsList initialEvents={events} memberClasses={memberClasses} />
      </Suspense>
    </div>
  );
}
