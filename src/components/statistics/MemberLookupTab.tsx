"use client";

import { Card, CardContent } from "~/components/ui/card";
import { Search } from "lucide-react";
import { MemberStatistics } from "./MemberStatistics";
import type { StatisticsData } from "~/lib/statistics/mock-data";

interface MemberLookupTabProps {
  memberData: StatisticsData | null;
  selectedMemberId: number | null;
}

export function MemberLookupTab({
  memberData,
  selectedMemberId,
}: MemberLookupTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats or empty state */}
      {selectedMemberId && memberData ? (
        <MemberStatistics data={memberData} />
      ) : selectedMemberId && !memberData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">No Data Available</h3>
            <p className="text-muted-foreground text-center text-sm">
              No statistics data found for the selected member in this date
              range.
            </p>
          </CardContent>
        </Card>
      ) : !selectedMemberId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">No Member Selected</h3>
            <p className="text-muted-foreground text-center text-sm">
              Search for a member above to view their statistics.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
