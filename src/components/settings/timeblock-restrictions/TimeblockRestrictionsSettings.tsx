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
import type { MemberClass, TimeblockRestriction } from "~/server/db/schema";

interface TimeblockRestrictionsSettingsProps {
  restrictions: TimeblockRestriction[];
  allMemberClasses?: MemberClass[];
}

export function TimeblockRestrictionsSettings({
  restrictions,
  allMemberClasses = [],
}: TimeblockRestrictionsSettingsProps) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("memberClass");

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
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

  const handleRestrictionsSearch = (restrictionId: number) => {
    const foundRestriction = restrictions.find(
      (r) => r.id === restrictionId,
    );
    if (foundRestriction) {
      // Set the tab based on the restriction category
      const tabMapping: Record<string, string> = {
        MEMBER_CLASS: "memberClass",
        GUEST: "guest",
        COURSE_AVAILABILITY: "courseAvailability",
      };

      const tab =
        tabMapping[foundRestriction.restrictionCategory] || "memberClass";
      setSelectedTab(tab);
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
              allMemberClasses={allMemberClasses}
            />
          </TabsContent>

          <TabsContent value="guest">
            <GuestRestrictions
              restrictions={guestRestrictions}
              memberClasses={allMemberClasses}
            />
          </TabsContent>

          <TabsContent value="courseAvailability">
            <CourseAvailability
              restrictions={courseAvailabilityRestrictions}
              memberClasses={allMemberClasses}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
