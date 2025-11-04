"use client";

import { useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MemberClassRestrictions } from "./MemberClassRestrictions";
import { GuestRestrictions } from "./GuestRestrictions";
import { CourseAvailability } from "./CourseAvailability";
import { Button } from "~/components/ui/button";
import { Search } from "lucide-react";
import { TimeblockRestrictionsSearch } from "./TimeblockRestrictionsSearchDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { MemberClass } from "~/server/db/schema";
import { useQuery } from "@tanstack/react-query";
import { restrictionsQueryOptions } from "~/server/query-options/restrictions-query-options";

export type TimeblockRestriction = {
  id: number;
  name: string;
  description: string | null;
  restrictionCategory: "MEMBER_CLASS" | "GUEST" | "COURSE_AVAILABILITY";
  restrictionType: "TIME" | "FREQUENCY" | "AVAILABILITY";
  memberClasses?: string[];
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  startDate?: Date | null;
  endDate?: Date | null;
  maxCount?: number;
  periodDays?: number;
  applyCharge?: boolean;
  chargeAmount?: number;
  isFullDay?: boolean;
  weatherStatus?: string;
  rainfall?: string;
  availabilityNotes?: string;
  isActive: boolean;
  canOverride: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date | null;
  lastUpdatedBy?: string;
};

interface TimeblockRestrictionsSettingsProps {
  initialRestrictions: TimeblockRestriction[];
  memberClasses: string[];
  allMemberClasses?: MemberClass[];
}

export function TimeblockRestrictionsSettings({
  initialRestrictions,
  memberClasses,
  allMemberClasses = [],
}: TimeblockRestrictionsSettingsProps) {
  // Use TanStack Query for restrictions
  const { data: restrictions = initialRestrictions, isLoading } = useQuery(
    restrictionsQueryOptions.all()
  );

  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("memberClass");
  const [selectedRestrictionId, setSelectedRestrictionId] = useState<
    number | null
  >(null);

  // Reset selectedRestrictionId when tabs change
  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    // Clear any selected restriction to prevent dialog from opening
    setSelectedRestrictionId(null);
  };

  // Handle when a dialog is closed in any of the child components
  const handleDialogClosed = () => {
    // Clear the selected restriction ID when any dialog is closed
    setSelectedRestrictionId(null);
  };

  // Filter restrictions by category
  const memberClassRestrictions = restrictions.filter(
    (r) => r.restrictionCategory === "MEMBER_CLASS",
  );

  const guestRestrictions = restrictions.filter(
    (r) => r.restrictionCategory === "GUEST",
  );

  const courseAvailabilityRestrictions = restrictions.filter(
    (r) => r.restrictionCategory === "COURSE_AVAILABILITY",
  );

  // These callbacks are no longer needed as the child components
  // will use TanStack Query mutations that automatically update the cache
  const handleRestrictionUpdate = () => {
    // Cache will be automatically invalidated by mutation
  };

  const handleRestrictionAdd = () => {
    // Cache will be automatically invalidated by mutation
  };

  const handleRestrictionDelete = () => {
    // Cache will be automatically invalidated by mutation
  };

  const handleRestrictionsSearch = (restrictionId: number) => {
    const foundRestriction = restrictions.find((r) => r.id === restrictionId);
    if (foundRestriction) {
      // Set the tab based on the restriction category
      const tabMapping = {
        MEMBER_CLASS: "memberClass",
        GUEST: "guest",
        COURSE_AVAILABILITY: "courseAvailability",
      };

      const tab =
        tabMapping[foundRestriction.restrictionCategory] || "memberClass";
      setSelectedTab(tab);
      setSelectedRestrictionId(restrictionId);
      setSearchDialogOpen(false);
    }
  };

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">
              Timeblock Restrictions
            </CardTitle>
            <CardDescription>
              Manage time, frequency, and availability restrictions for members,
              guests, and course
            </CardDescription>
          </div>
          <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Search className="h-4 w-4" />
                Search Restrictions
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Search Restrictions</DialogTitle>
              </DialogHeader>
              <TimeblockRestrictionsSearch
                restrictions={restrictions}
                onSelect={handleRestrictionsSearch}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="pb-6">
        <Tabs
          value={selectedTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="mx-auto mb-4 w-full max-w-[600px]">
            <TabsTrigger value="memberClass" className="flex-1">
              Member Classes
            </TabsTrigger>
            <TabsTrigger value="guest" className="flex-1">
              Guests
            </TabsTrigger>
            <TabsTrigger value="courseAvailability" className="flex-1">
              Course Availability
            </TabsTrigger>
          </TabsList>

          <TabsContent value="memberClass">
            <MemberClassRestrictions
              restrictions={memberClassRestrictions}
              memberClasses={memberClasses}
              onUpdate={handleRestrictionUpdate}
              onAdd={handleRestrictionAdd}
              onDelete={handleRestrictionDelete}
              highlightId={
                selectedTab === "memberClass" ? selectedRestrictionId : null
              }
              onDialogClose={handleDialogClosed}
              allMemberClasses={allMemberClasses}
            />
          </TabsContent>

          <TabsContent value="guest">
            <GuestRestrictions
              restrictions={guestRestrictions}
              onUpdate={handleRestrictionUpdate}
              onAdd={handleRestrictionAdd}
              onDelete={handleRestrictionDelete}
              highlightId={
                selectedTab === "guest" ? selectedRestrictionId : null
              }
              onDialogClose={handleDialogClosed}
              memberClasses={allMemberClasses}
            />
          </TabsContent>

          <TabsContent value="courseAvailability">
            <CourseAvailability
              restrictions={courseAvailabilityRestrictions}
              onUpdate={handleRestrictionUpdate}
              onAdd={handleRestrictionAdd}
              onDelete={handleRestrictionDelete}
              highlightId={
                selectedTab === "courseAvailability"
                  ? selectedRestrictionId
                  : null
              }
              onDialogClose={handleDialogClosed}
              memberClasses={allMemberClasses}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
