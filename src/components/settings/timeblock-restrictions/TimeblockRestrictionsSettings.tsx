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
import { LotteryRestrictions } from "./LotteryRestrictions";
import { Button } from "~/components/ui/button";
import { Search, FileText } from "lucide-react";
import { TimeblockRestrictionsSearch } from "./TimeblockRestrictionsSearchDialog";
import { OverridesSettings } from "~/components/settings/overrides/OverridesSettings";
import { getTimeblockOverrides } from "~/server/timeblock-restrictions/actions";
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
  lotterySettings: {
    lotteryAdvanceDays: number;
    lotteryMaxDaysAhead: number;
  };
}

export function TimeblockRestrictionsSettings({
  restrictions,
  allMemberClasses = [],
  lotterySettings,
}: TimeblockRestrictionsSettingsProps) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [overridesDialogOpen, setOverridesDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("memberClass");
  const [initialOverrides, setInitialOverrides] = useState<any[]>([]);

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

  const lotteryRestrictions = restrictions.filter(
    (r) => r.restrictionCategory === "LOTTERY",
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
        LOTTERY: "lottery",
      };

      const tab =
        tabMapping[foundRestriction.restrictionCategory] || "memberClass";
      setSelectedTab(tab);
      setSearchDialogOpen(false);
    }
  };

  const handleOpenOverridesDialog = async () => {
    setOverridesDialogOpen(true);
    // Fetch overrides when dialog opens
    const result = await getTimeblockOverrides({});
    if (!("error" in result)) {
      setInitialOverrides(result as any[]);
    }
  };

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">
              Restrictions
            </CardTitle>
            <CardDescription>
              Manage time, frequency, and lottery restrictions for members,
              guests, and lottery entries
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={overridesDialogOpen} onOpenChange={setOverridesDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" onClick={handleOpenOverridesDialog}>
                  <FileText className="h-4 w-4" />
                  Override Records
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Override Records</DialogTitle>
                </DialogHeader>
                <OverridesSettings initialOverrides={initialOverrides} />
              </DialogContent>
            </Dialog>
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
            <TabsTrigger value="lottery" className="flex-1">
              Lottery
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

          <TabsContent value="lottery">
            <LotteryRestrictions
              restrictions={lotteryRestrictions}
              allMemberClasses={allMemberClasses}
              lotterySettings={lotterySettings}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
