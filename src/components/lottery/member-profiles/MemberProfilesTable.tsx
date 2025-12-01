"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Edit,
  Clock,
  TrendingUp,
  Timer,
  AlertTriangle,
  Target,
  Trophy,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SpeedProfileEditDialog } from "~/components/lottery/SpeedProfileEditDialog";
import type { MemberProfile } from "~/server/lottery/member-profiles-data";

interface MemberProfilesTableProps {
  profiles: MemberProfile[];
}

const PAGE_SIZE = 20;

export function MemberProfilesTable({ profiles }: MemberProfilesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingProfile, setEditingProfile] = useState<MemberProfile | null>(
    null,
  );

  const currentPage = parseInt(searchParams.get("page") || "1");
  const currentSearch = searchParams.get("search") || "";
  const currentSpeedTier = searchParams.get("speedTier") || "ALL";
  const currentPriority = searchParams.get("priority") || "ALL";

  // Filter profiles based on search and filter criteria
  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        profile.memberName.toLowerCase().includes(currentSearch.toLowerCase()) ||
        profile.memberNumber
          .toLowerCase()
          .includes(currentSearch.toLowerCase());

      const matchesSpeedFilter =
        currentSpeedTier === "ALL" || profile.speedTier === currentSpeedTier;

      const matchesPriorityFilter = () => {
        if (currentPriority === "ALL") return true;
        const fairnessScore = profile.fairnessScore ?? 0;
        if (currentPriority === "HIGH") return fairnessScore > 20;
        if (currentPriority === "MEDIUM")
          return fairnessScore >= 10 && fairnessScore <= 20;
        if (currentPriority === "LOW") return fairnessScore < 10;
        return true;
      };

      return matchesSearch && matchesSpeedFilter && matchesPriorityFilter();
    });
  }, [
    profiles,
    currentSearch,
    currentSpeedTier,
    currentPriority,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredProfiles.length / PAGE_SIZE);
  const validPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const startIndex = (validPage - 1) * PAGE_SIZE;
  const paginatedProfiles = filteredProfiles.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    router.push(`?${params.toString()}`);
  };

  const formatPaceTime = (minutes: number | null) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  const getSpeedTierBadge = (tier: "FAST" | "AVERAGE" | "SLOW") => {
    switch (tier) {
      case "FAST":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <TrendingUp className="mr-1 h-3 w-3" />
            Fast
          </Badge>
        );
      case "AVERAGE":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Timer className="mr-1 h-3 w-3" />
            Average
          </Badge>
        );
      case "SLOW":
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <Clock className="mr-1 h-3 w-3" />
            Slow
          </Badge>
        );
    }
  };

  const getAdminAdjustmentBadge = (adjustment: number) => {
    if (adjustment === 0) {
      return <span className="text-gray-500">0</span>;
    }

    const isPositive = adjustment > 0;
    return (
      <Badge
        variant={isPositive ? "default" : "destructive"}
        className={isPositive ? "bg-blue-100 text-blue-800" : ""}
      >
        <AlertTriangle className="mr-1 h-3 w-3" />
        {isPositive ? "+" : ""}
        {adjustment}
      </Badge>
    );
  };

  const getPriorityBadge = (score: number) => {
    if (score > 20) {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <Target className="mr-1 h-3 w-3" />
          High ({score.toFixed(1)})
        </Badge>
      );
    } else if (score >= 10) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Calendar className="mr-1 h-3 w-3" />
          Medium ({score.toFixed(1)})
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <Trophy className="mr-1 h-3 w-3" />
          Low ({score.toFixed(1)})
        </Badge>
      );
    }
  };

  if (filteredProfiles.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-500">
          <Timer className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">No member profiles found</p>
          <p className="text-sm">
            Try adjusting your filters or search terms.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Results summary */}
        <div className="text-sm text-gray-600">
          Showing {paginatedProfiles.length} of {filteredProfiles.length} members
          {filteredProfiles.length !== profiles.length &&
            ` (filtered from ${profiles.length} total)`}
        </div>

        {/* Table */}
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Member
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Avg Pace
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Speed Tier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Fairness Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Fulfillment Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Admin Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Override
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50">
                    {/* Member Info */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {profile.memberName}
                        </div>
                        <div className="text-sm text-gray-500">
                          #{profile.memberNumber} • {profile.memberClass}
                        </div>
                      </div>
                    </td>

                    {/* Average Pace */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPaceTime(profile.averageMinutes)}
                      </div>
                      {profile.averageMinutes && (
                        <div className="text-xs text-gray-500">
                          {profile.averageMinutes.toFixed(0)} minutes
                        </div>
                      )}
                    </td>

                    {/* Speed Tier */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getSpeedTierBadge(profile.speedTier)}
                    </td>

                    {/* Fairness Score */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {profile.fairnessCurrentMonth ? (
                        getPriorityBadge(profile.fairnessScore)
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          No Data
                        </Badge>
                      )}
                    </td>

                    {/* Fulfillment Rate */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {profile.fairnessCurrentMonth ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {(
                              (profile.fairnessPreferenceFulfillmentRate || 0) *
                              100
                            ).toFixed(0)}
                            %
                          </div>
                          <div className="text-xs text-gray-500">
                            {profile.fairnessPreferencesGrantedMonth}/
                            {profile.fairnessTotalEntriesMonth} granted
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    {/* Admin Priority Adjustment */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getAdminAdjustmentBadge(profile.adminPriorityAdjustment)}
                    </td>

                    {/* Manual Override */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {profile.manualOverride ? (
                        <Badge
                          variant="outline"
                          className="border-orange-200 text-orange-700"
                        >
                          Manual
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-green-200 text-green-700"
                        >
                          Auto
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 text-sm font-medium whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingProfile(profile)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Summary and Pagination */}
          <div className="border-t bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Total: {filteredProfiles.length} members</span>
                <span>
                  Fast:{" "}
                  {
                    filteredProfiles.filter((p) => p.speedTier === "FAST")
                      .length
                  }
                </span>
                <span>
                  Average:{" "}
                  {
                    filteredProfiles.filter((p) => p.speedTier === "AVERAGE")
                      .length
                  }
                </span>
                <span>
                  Slow:{" "}
                  {
                    filteredProfiles.filter((p) => p.speedTier === "SLOW")
                      .length
                  }
                </span>
                <span>
                  High Priority:{" "}
                  {
                    filteredProfiles.filter((p) => p.fairnessScore > 20)
                      .length
                  }
                </span>
                <span>
                  Manual Overrides:{" "}
                  {filteredProfiles.filter((p) => p.manualOverride).length}
                </span>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(validPage - 1)}
                  disabled={validPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium">
                  Page {validPage} of {Math.max(totalPages, 1)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(validPage + 1)}
                  disabled={validPage === totalPages || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      {editingProfile && (
        <SpeedProfileEditDialog
          profile={editingProfile as any}
          isOpen={!!editingProfile}
          onClose={() => setEditingProfile(null)}
          onSave={() => {
            setEditingProfile(null);
          }}
        />
      )}
    </>
  );
}
