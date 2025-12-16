"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { DateRangePicker } from "~/components/ui/date-range-picker";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import { memberQueryOptions } from "~/server/query-options/member-query-options";
import { type DateRange } from "~/app/types/UITypes";
import { cn } from "~/lib/utils";
import {
  getBCToday,
  formatDateToYYYYMMDD,
  addDays,
  parseDate,
} from "~/lib/dates";

interface StatisticsControlsProps {
  useMockData: boolean;
  onMockDataChange: (value: boolean) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  activeTab: string;
  selectedMemberId: number | null;
  onMemberSelect: (memberId: number | null) => void;
}

export function StatisticsControls({
  useMockData,
  onMockDataChange,
  dateRange,
  onDateRangeChange,
  activeTab,
  selectedMemberId,
  onMemberSelect,
}: StatisticsControlsProps) {
  const searchParams = useSearchParams();
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  // Helper to get preset date range strings (YYYY-MM-DD format)
  const getPresetRangeStrings = (preset: "7d" | "30d" | "90d" | "ytd") => {
    const today = getBCToday();
    let from: string;
    switch (preset) {
      case "7d":
        from = formatDateToYYYYMMDD(addDays(today, -7));
        break;
      case "30d":
        from = formatDateToYYYYMMDD(addDays(today, -30));
        break;
      case "90d":
        from = formatDateToYYYYMMDD(addDays(today, -90));
        break;
      case "ytd": {
        const todayDate = new Date();
        const yearStart = new Date(todayDate.getFullYear(), 0, 1);
        from = formatDateToYYYYMMDD(yearStart);
        break;
      }
    }
    return { from, to: today };
  };

  // Check if current URL params match a preset
  // Default to YTD if no date params exist
  const isPresetActive = (preset: "7d" | "30d" | "90d" | "ytd") => {
    if (!startDateParam || !endDateParam) {
      // If no date params, default to YTD
      return preset === "ytd";
    }
    const presetRange = getPresetRangeStrings(preset);
    return (
      startDateParam === presetRange.from && endDateParam === presetRange.to
    );
  };

  const handlePresetClick = (preset: "7d" | "30d" | "90d" | "ytd") => {
    const presetRangeStrings = getPresetRangeStrings(preset);

    // Convert preset strings to Date objects for the dateRange
    const fromDate = parseDate(presetRangeStrings.from);
    const toDate = parseDate(presetRangeStrings.to);

    onDateRangeChange({ from: fromDate, to: toDate });
  };

  // Fetch member details when selectedMemberId is present
  const { data: selectedMember } = useQuery(
    memberQueryOptions.byId(selectedMemberId ?? 0),
  );

  // Create member object for MemberSearchInput
  const memberForSearch = selectedMember
    ? {
        id: selectedMember.id,
        firstName: selectedMember.firstName ?? "",
        lastName: selectedMember.lastName ?? "",
        memberNumber: selectedMember.memberNumber ?? "",
      }
    : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Mock Data Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="mock-data"
              checked={useMockData}
              onCheckedChange={onMockDataChange}
            />
            <Label htmlFor="mock-data" className="text-sm font-medium">
              Use Mock Data
            </Label>
          </div>

          <div className="h-6 w-px bg-gray-300" />

          {/* Date Presets */}
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground text-sm">Range:</Label>
            <div className="flex gap-1">
              <Button
                variant={isPresetActive("7d") ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetClick("7d")}
                className={cn(
                  isPresetActive("7d") &&
                    "bg-org-primary hover:bg-org-primary/90",
                )}
              >
                7D
              </Button>
              <Button
                variant={isPresetActive("30d") ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetClick("30d")}
                className={cn(
                  isPresetActive("30d") &&
                    "bg-org-primary hover:bg-org-primary/90",
                )}
              >
                30D
              </Button>
              <Button
                variant={isPresetActive("90d") ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetClick("90d")}
                className={cn(
                  isPresetActive("90d") &&
                    "bg-org-primary hover:bg-org-primary/90",
                )}
              >
                90D
              </Button>
              <Button
                variant={isPresetActive("ytd") ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetClick("ytd")}
                className={cn(
                  isPresetActive("ytd") &&
                    "bg-org-primary hover:bg-org-primary/90",
                )}
              >
                YTD
              </Button>
            </div>
          </div>

          {/* Date Range Picker */}
          <DateRangePicker
            dateRange={dateRange}
            setDateRange={onDateRangeChange}
            className="h-10 max-w-[280px] min-w-[220px]"
          />

          {/* Member Search - Only show on member tab */}
          {activeTab === "member" && (
            <>
              <div className="h-6 w-px bg-gray-300" />
              <div className="min-w-[300px] flex-1">
                <MemberSearchInput
                  onSelect={(member) => onMemberSelect(member?.id ?? null)}
                  selectedMember={memberForSearch}
                  placeholder="Search members by name or member #..."
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
