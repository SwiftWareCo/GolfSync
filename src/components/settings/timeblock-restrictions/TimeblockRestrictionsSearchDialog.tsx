import React, { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { type TimeblockRestriction } from "~/server/db/schema";

interface TimeblockRestrictionsSearchProps {
  restrictions: TimeblockRestriction[];
  onSelect: (restrictionId: number) => void;
}

export function TimeblockRestrictionsSearch({
  restrictions,
  onSelect,
}: TimeblockRestrictionsSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [restrictionType, setRestrictionType] = useState<string>("all");

  // Filter the restrictions based on search term and filters
  const filteredRestrictions = useMemo(() => {
    return restrictions.filter((restriction) => {
      const matchesSearch =
        searchTerm === "" ||
        restriction.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (restriction.description &&
          restriction.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()));

      const matchesCategory =
        selectedCategory === "all" ||
        restriction.restrictionCategory === selectedCategory;

      const matchesType =
        restrictionType === "all" ||
        restriction.restrictionType === restrictionType;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [restrictions, searchTerm, selectedCategory, restrictionType]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="searchRestrictions">Search</Label>
          <Input
            id="searchRestrictions"
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryFilter">Category</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger id="categoryFilter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="MEMBER_CLASS">Member Class</SelectItem>
              <SelectItem value="GUEST">Guest</SelectItem>
              <SelectItem value="LOTTERY">Lottery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="typeFilter">Restriction Type</Label>
          <Select value={restrictionType} onValueChange={setRestrictionType}>
            <SelectTrigger id="typeFilter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="TIME">Time</SelectItem>
              <SelectItem value="FREQUENCY">Frequency</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRestrictions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  No restrictions found
                </TableCell>
              </TableRow>
            ) : (
              filteredRestrictions.map((restriction) => (
                <TableRow key={restriction.id}>
                  <TableCell className="font-medium">
                    {restriction.name}
                  </TableCell>
                  <TableCell>
                    {getCategoryDisplayName(restriction.restrictionCategory)}
                  </TableCell>
                  <TableCell>
                    {getTypeDisplayName(restriction.restrictionType)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={restriction.isActive ? "default" : "outline"}
                    >
                      {restriction.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelect(restriction.id)}
                    >
                      View
                    </Button>
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

// Helper functions
function getCategoryDisplayName(category: string): string {
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
}

function getTypeDisplayName(type: string): string {
  switch (type) {
    case "TIME":
      return "Time";
    case "FREQUENCY":
      return "Frequency";
    default:
      return type;
  }
}
