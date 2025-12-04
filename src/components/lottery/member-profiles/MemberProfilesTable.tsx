"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Edit, ChevronLeft, ChevronRight, Timer } from "lucide-react";
import { SpeedProfileEditDialog } from "~/components/lottery/SpeedProfileEditDialog";
import {
  formatPaceTime,
  getSpeedTierBadge,
  getAdminAdjustmentBadge,
  getPriorityBadge,
} from "~/lib/lottery-display-utils";

interface MemberProfilesTableProps {
  profiles: Awaited<
    ReturnType<
      typeof import("~/server/lottery/member-profiles-data").getMemberProfilesWithFairness
    >
  >["profiles"];
}

const PAGE_SIZE = 10;

export function MemberProfilesTable({ profiles }: MemberProfilesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingProfile, setEditingProfile] = useState<
    MemberProfilesTableProps["profiles"][number] | null
  >(null);

  const currentPage = parseInt(searchParams.get("page") || "1");
  const currentSearch = searchParams.get("search") || "";
  const currentSpeedTier = searchParams.get("speedTier") || "ALL";
  const currentPriority = searchParams.get("priority") || "ALL";

  // Internal state for immediate input value
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Debounced URL update (300ms delay)
  const debouncedSearch = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.delete("page"); // Reset to page 1 on search
    router.push(`?${params.toString()}`);
  }, 300);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Filter profiles based on search and filter criteria
  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        profile.memberName
          .toLowerCase()
          .includes(currentSearch.toLowerCase()) ||
        profile.memberNumber
          .toLowerCase()
          .includes(currentSearch.toLowerCase());

      const matchesSpeedFilter =
        currentSpeedTier === "ALL" ||
        (profile.memberSpeedProfile?.speedTier ?? "AVERAGE") ===
          currentSpeedTier;

      const matchesPriorityFilter = () => {
        if (currentPriority === "ALL") return true;
        const fairnessScore = profile.fairnessScore?.fairnessScore ?? 0;
        if (currentPriority === "HIGH") return fairnessScore > 20;
        if (currentPriority === "MEDIUM")
          return fairnessScore >= 10 && fairnessScore <= 20;
        if (currentPriority === "LOW") return fairnessScore < 10;
        return true;
      };

      return matchesSearch && matchesSpeedFilter && matchesPriorityFilter();
    });
  }, [profiles, currentSearch, currentSpeedTier, currentPriority]);

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

  const handleSpeedTierChange = (tier: string) => {
    const params = new URLSearchParams(searchParams);
    if (tier === "ALL") {
      params.delete("speedTier");
    } else {
      params.set("speedTier", tier);
    }
    params.delete("page"); // Reset to page 1
    router.push(`?${params.toString()}`);
  };

  const handlePriorityChange = (priority: string) => {
    const params = new URLSearchParams(searchParams);
    if (priority === "ALL") {
      params.delete("priority");
    } else {
      params.set("priority", priority);
    }
    params.delete("page"); // Reset to page 1
    router.push(`?${params.toString()}`);
  };

  if (filteredProfiles.length === 0 && currentSearch) {
    return (
      <div className="space-y-4">
        {/* Search and Filters - always visible */}
        <div className="flex flex-col gap-4">
          <div className="relative max-w-sm flex-1">
            <Timer className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or member number..."
              value={searchInput}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Speed:</span>
              {(["ALL", "FAST", "AVERAGE", "SLOW"] as const).map((tier) => (
                <Badge
                  key={tier}
                  variant={currentSpeedTier === tier ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleSpeedTierChange(tier)}
                >
                  {tier}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Priority:</span>
              {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
                <Badge
                  key={priority}
                  variant={currentPriority === priority ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handlePriorityChange(priority)}
                >
                  {priority}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-gray-500">
            <Timer className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-lg font-medium">No member profiles found</p>
            <p className="text-sm">
              Try adjusting your filters or search terms.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col gap-4">
          <div className="relative max-w-sm flex-1">
            <Timer className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or member number..."
              value={searchInput}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Speed:</span>
              {(["ALL", "FAST", "AVERAGE", "SLOW"] as const).map((tier) => (
                <Badge
                  key={tier}
                  variant={currentSpeedTier === tier ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleSpeedTierChange(tier)}
                >
                  {tier}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Priority:</span>
              {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
                <Badge
                  key={priority}
                  variant={currentPriority === priority ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handlePriorityChange(priority)}
                >
                  {priority}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Results summary */}
        <div className="text-sm text-gray-600">
          Showing {paginatedProfiles.length} of {filteredProfiles.length}{" "}
          members
          {filteredProfiles.length !== profiles.length &&
            ` (filtered from ${profiles.length} total)`}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-org-primary p-2">
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
                          #{profile.memberNumber} • {profile.memberClassName}
                        </div>
                      </div>
                    </td>

                    {/* Average Pace */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPaceTime(
                          profile.memberSpeedProfile?.averageMinutes ?? null,
                        )}
                      </div>
                      {profile.memberSpeedProfile?.averageMinutes && (
                        <div className="text-xs text-gray-500">
                          {profile.memberSpeedProfile.averageMinutes.toFixed(0)}{" "}
                          minutes
                        </div>
                      )}
                    </td>

                    {/* Speed Tier */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getSpeedTierBadge(
                        (profile.memberSpeedProfile?.speedTier ?? "AVERAGE") as
                          | "FAST"
                          | "AVERAGE"
                          | "SLOW",
                      )}
                    </td>

                    {/* Fairness Score */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {profile.fairnessScore?.currentMonth ? (
                        getPriorityBadge(
                          profile.fairnessScore.fairnessScore ?? 0,
                        )
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          No Data
                        </Badge>
                      )}
                    </td>

                    {/* Fulfillment Rate */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {profile.fairnessScore?.currentMonth ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {(
                              (profile.fairnessScore
                                .preferenceFulfillmentRate || 0) * 100
                            ).toFixed(0)}
                            %
                          </div>
                          <div className="text-xs text-gray-500">
                            {profile.fairnessScore.preferencesGrantedMonth ?? 0}
                            /{profile.fairnessScore.totalEntriesMonth ?? 0}{" "}
                            granted
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    {/* Admin Priority Adjustment */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getAdminAdjustmentBadge(
                        profile.memberSpeedProfile?.adminPriorityAdjustment ??
                          0,
                      )}
                    </td>

                    {/* Manual Override */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {profile.memberSpeedProfile?.manualOverride ? (
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
                    filteredProfiles.filter(
                      (p) =>
                        (p.memberSpeedProfile?.speedTier ?? "AVERAGE") ===
                        "FAST",
                    ).length
                  }
                </span>
                <span>
                  Average:{" "}
                  {
                    filteredProfiles.filter(
                      (p) =>
                        (p.memberSpeedProfile?.speedTier ?? "AVERAGE") ===
                        "AVERAGE",
                    ).length
                  }
                </span>
                <span>
                  Slow:{" "}
                  {
                    filteredProfiles.filter(
                      (p) =>
                        (p.memberSpeedProfile?.speedTier ?? "AVERAGE") ===
                        "SLOW",
                    ).length
                  }
                </span>
                <span>
                  High Priority:{" "}
                  {
                    filteredProfiles.filter(
                      (p) => (p.fairnessScore?.fairnessScore ?? 0) > 20,
                    ).length
                  }
                </span>
                <span>
                  Manual Overrides:{" "}
                  {
                    filteredProfiles.filter(
                      (p) => p.memberSpeedProfile?.manualOverride ?? false,
                    ).length
                  }
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
          profile={editingProfile}
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
