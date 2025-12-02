"use client";

import { useState } from "react";
import { EventCard } from "~/components/events/EventCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { EventWithRegistrations } from "~/server/events/data";
import type { MemberClass } from "~/server/db/schema";

interface EventsListProps {
  events: EventWithRegistrations[];
  memberClasses?: MemberClass[];
}

export default function EventsList({
  events,
  memberClasses,
}: EventsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterApproval, setFilterApproval] = useState<string>("ALL");

  // Count events with pending registrations
  const eventsWithPendingCount = events.filter(
    (event) =>
      event.pendingRegistrationsCount && event.pendingRegistrationsCount > 0,
  ).length;

  // Filter events based on search term and filters
  const filteredEvents = events.filter((event) => {
    // Search filter
    const matchesSearch =
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchTerm.toLowerCase());

    // Type filter
    const matchesType = filterType === "ALL" || event.eventType === filterType;

    // Status filter
    const matchesStatus =
      filterStatus === "ALL" ||
      (filterStatus === "ACTIVE" && event.isActive) ||
      (filterStatus === "INACTIVE" && !event.isActive) ||
      (filterStatus === "UPCOMING" && new Date(event.startDate) > new Date());

    // Approval filter
    const matchesApproval =
      filterApproval === "ALL" ||
      (filterApproval === "NEEDS_APPROVAL" &&
        event.pendingRegistrationsCount &&
        event.pendingRegistrationsCount > 0);

    return matchesSearch && matchesType && matchesStatus && matchesApproval;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full sm:w-1/2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-1/6">
          <Label htmlFor="type-filter">Type</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger id="type-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="TOURNAMENT">Tournament</SelectItem>
              <SelectItem value="DINNER">Dinner</SelectItem>
              <SelectItem value="SOCIAL">Social</SelectItem>
              <SelectItem value="MEETING">Meeting</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-1/6">
          <Label htmlFor="status-filter">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="UPCOMING">Upcoming</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-1/6">
          <Label htmlFor="approval-filter">Approvals</Label>
          <Select value={filterApproval} onValueChange={setFilterApproval}>
            <SelectTrigger id="approval-filter">
              <SelectValue placeholder="Filter by approvals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Events</SelectItem>
              <SelectItem value="NEEDS_APPROVAL">
                Needs Approval ({eventsWithPendingCount})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="bg-muted/10 rounded-md border p-8 text-center">
          <p className="text-muted-foreground">No events found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              linkPrefix="/admin/events"
              className="h-full"
              isAdmin={true}
              registrations={event.registrations || []}
              memberClasses={memberClasses}
            />
          ))}
        </div>
      )}

      <div className="text-muted-foreground mt-4 text-sm">
        Showing {filteredEvents.length} out of {events.length} events
      </div>
    </div>
  );
}
