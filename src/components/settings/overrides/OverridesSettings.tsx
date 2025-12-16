"use client";

import { useState, useEffect } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { DatePicker } from "~/components/ui/date-picker";
import { getTimeblockOverrides } from "~/server/timeblock-restrictions/actions";
import { formatDate } from "~/lib/dates";
import { Search } from "lucide-react";
import toast from "react-hot-toast";

export type TimeblockOverrideWithRelations = {
  id: number;
  restrictionId: number;
  timeBlockId: number | null;
  memberId: number | null;
  guestId: number | null;
  overriddenBy: string;
  reason: string | null;
  createdAt: Date;
  restriction: {
    id: number;
    name: string;
    restrictionCategory: "MEMBER_CLASS" | "GUEST" | "LOTTERY";
  };
  timeBlock?: {
    id: number;
    startTime: string;
    date: string;
  } | null;
  member?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  guest?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
};

interface OverridesSettingsProps {
  initialOverrides: TimeblockOverrideWithRelations[];
}

export function OverridesSettings({
  initialOverrides,
}: OverridesSettingsProps) {
  const [overrides, setOverrides] = useState<TimeblockOverrideWithRelations[]>(
    initialOverrides || [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Search function
  const performSearch = async () => {
    setIsLoading(true);
    try {
      const result = await getTimeblockOverrides({
        // Don't pass searchTerm to server - we'll filter client-side for comprehensive search
        startDate,
        endDate,
      });

      if ("error" in result) {
        toast.error(result.error);
      } else {
        setOverrides(result as TimeblockOverrideWithRelations[]);
      }
    } catch (error) {
      console.error("Error searching overrides:", error);
      toast.error("Failed to search overrides");
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  };

  // Trigger search when date filters change (but not on initial mount)
  useEffect(() => {
    // Don't search on initial mount - wait for user interaction
    if (!hasSearched && !startDate && !endDate) {
      return;
    }

    // Add a small delay to prevent too many requests when changing dates
    const delaySearch = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [startDate, endDate]);

  // Trigger search when searchTerm changes and we have data
  useEffect(() => {
    if (hasSearched && searchTerm !== "") {
      // No need to call server - client-side filtering will handle it
      return;
    }
    if (!hasSearched && searchTerm !== "") {
      // First search with a search term - get initial data
      performSearch();
    }
  }, [searchTerm]);

  const getCategoryDisplayName = (
    category: "MEMBER_CLASS" | "GUEST" | "LOTTERY",
  ) => {
    switch (category) {
      case "MEMBER_CLASS":
        return "Member Class";
      case "GUEST":
        return "Guest";
      case "LOTTERY":
        return "Lottery";
      default:
        return category;
    }
  };

  // Filter overrides based on search term (client-side filtering for comprehensive search)
  const filteredOverrides = overrides.filter((override) => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();

    // Search in restriction name
    if (override.restriction.name.toLowerCase().includes(searchLower))
      return true;

    // Search in category
    if (
      getCategoryDisplayName(override.restriction.restrictionCategory)
        .toLowerCase()
        .includes(searchLower)
    )
      return true;

    // Search in person name
    if (override.member) {
      const memberName =
        `${override.member.firstName} ${override.member.lastName}`.toLowerCase();
      if (memberName.includes(searchLower)) return true;
    }

    if (override.guest) {
      const guestName =
        `${override.guest.firstName} ${override.guest.lastName}`.toLowerCase();
      if (guestName.includes(searchLower)) return true;
    }

    // Search in reason
    if (override.reason && override.reason.toLowerCase().includes(searchLower))
      return true;

    // Search in overridden by
    if (override.overriddenBy.toLowerCase().includes(searchLower)) return true;

    return false;
  });

  return (
    <div className="space-y-6">
        {/* Search and Filter Controls */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500" />
              <Input
                id="search"
                placeholder="Search all fields..."
                className="h-10 pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <DatePicker
              date={startDate}
              setDate={setStartDate}
              placeholder="From date"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <DatePicker
              date={endDate}
              setDate={setEndDate}
              placeholder="To date"
              className="h-10"
            />
          </div>
        </div>

        {/* Results Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Restriction</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Overridden By</TableHead>
                <TableHead className="w-1/3">Override Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-24 text-center"
                  >
                    Searching...
                  </TableCell>
                </TableRow>
              ) : filteredOverrides.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {hasSearched || searchTerm || startDate || endDate
                      ? "No override records found"
                      : "Use the search and filter options above to find override records"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOverrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell>
                      {formatDate(
                        override.createdAt,
                        "MMM d, yyyy 'at' h:mm a",
                      )}
                    </TableCell>
                    <TableCell>{override.restriction.name}</TableCell>
                    <TableCell>
                      {getCategoryDisplayName(
                        override.restriction.restrictionCategory,
                      )}
                    </TableCell>
                    <TableCell>
                      {override.member
                        ? `${override.member.firstName} ${override.member.lastName}`
                        : override.guest
                          ? `${override.guest.firstName} ${override.guest.lastName} (Guest)`
                          : "N/A"}
                    </TableCell>
                    <TableCell>{override.overriddenBy}</TableCell>
                    <TableCell>
                      {override.reason || "No reason provided"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
    </div>
  );
}
