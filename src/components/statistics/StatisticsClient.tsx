"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { TrendingUp, Search, Settings } from "lucide-react";
import { StatisticsControls } from "./StatisticsControls";
import { StatisticsOverview } from "./StatisticsOverview";
import { StatisticsOperations } from "./StatisticsOperations";
import { MemberLookupTab } from "./MemberLookupTab";
import { getDateForDB } from "~/lib/dates";
import type { StatisticsData } from "~/lib/statistics/mock-data";
import type { DateRange } from "~/app/types/UITypes";

interface StatisticsClientProps {
  clubData: StatisticsData;
  memberData: StatisticsData | null;
  initialDateRange: { from: Date; to: Date };
}

export function StatisticsClient({
  clubData,
  memberData,
  initialDateRange,
}: StatisticsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state - sync with URL params
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(
    () => {
      const memberIdParam = searchParams.get("memberId");
      return memberIdParam ? parseInt(memberIdParam, 10) : null;
    },
  );
  const [activeTab, setActiveTab] = useState<string>(
    () => searchParams.get("tab") || "overview",
  );

  // Sync state with props when they change (from server component re-render)
  useEffect(() => {
    setDateRange(initialDateRange);
  }, [initialDateRange]);

  // Sync selectedMemberId with URL params
  useEffect(() => {
    const memberIdParam = searchParams.get("memberId");
    setSelectedMemberId(memberIdParam ? parseInt(memberIdParam, 10) : null);
  }, [searchParams]);

  // Update URL params helper
  const updateURLParams = (updates: {
    startDate?: string;
    endDate?: string;
    useMockData?: boolean;
    memberId?: number | null;
    tab?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.startDate) {
      params.set("startDate", updates.startDate);
    }
    if (updates.endDate) {
      params.set("endDate", updates.endDate);
    }
    if (updates.useMockData !== undefined) {
      params.set("useMockData", updates.useMockData.toString());
    }
    if (updates.memberId !== undefined) {
      if (updates.memberId === null) {
        params.delete("memberId");
      } else {
        params.set("memberId", updates.memberId.toString());
      }
    }
    if (updates.tab) {
      params.set("tab", updates.tab);
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRange) => {
    // Always update local state so UI reflects the selection
    setDateRange(range);

    // Only update URL params when both dates are selected (triggers server re-fetch)
    if (range.from && range.to) {
      updateURLParams({
        startDate: getDateForDB(range.from),
        endDate: getDateForDB(range.to),
      });
    }
  };

  // Handle mock toggle
  const handleMockToggle = (checked: boolean) => {
    updateURLParams({ useMockData: checked });
  };

  // Handle member selection
  const handleMemberSelect = (memberId: number | null) => {
    setSelectedMemberId(memberId);
    updateURLParams({ memberId });
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    updateURLParams({ tab: value });
  };

  // Get useMockData from URL
  const useMockData = searchParams.get("useMockData") === "true";

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        defaultValue={searchParams.get("tab") || "overview"}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="member" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Member Lookup
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Operations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <StatisticsControls
            useMockData={useMockData}
            onMockDataChange={handleMockToggle}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            activeTab={activeTab}
            selectedMemberId={selectedMemberId}
            onMemberSelect={handleMemberSelect}
          />
          <StatisticsOverview
            data={clubData}
            dateRange={{
              from: dateRange.from || initialDateRange.from,
              to: dateRange.to || initialDateRange.to,
            }}
          />
        </TabsContent>

        <TabsContent value="member" className="space-y-6">
          <StatisticsControls
            useMockData={useMockData}
            onMockDataChange={handleMockToggle}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            activeTab={activeTab}
            selectedMemberId={selectedMemberId}
            onMemberSelect={handleMemberSelect}
          />
          <MemberLookupTab
            memberData={memberData}
            selectedMemberId={selectedMemberId}
          />
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <StatisticsControls
            useMockData={useMockData}
            onMockDataChange={handleMockToggle}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            activeTab={activeTab}
            selectedMemberId={selectedMemberId}
            onMemberSelect={handleMemberSelect}
          />
          <StatisticsOperations data={clubData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
