"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Filter } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { MembersTable } from "~/components/members/MembersTable";
import { SearchBar } from "~/components/ui/search-bar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import type { Member } from "~/app/types/MemberTypes";
import type { MemberClass } from "~/server/db/schema";
import { deleteMember, searchMembersAction } from "~/server/members/actions";
import toast from "react-hot-toast";
import { MemberForm } from "./MemberForm";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";

interface MembersHandlerProps {
  initialMembers: Member[];
  memberClasses: MemberClass[];
}

const ITEMS_PER_PAGE = 10;

export function MembersHandler({
  initialMembers,
  memberClasses,
}: MembersHandlerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery) {
        const results = await searchMembersAction(searchQuery);
        setMembers(results as Member[]);
        setCurrentPage(1);
      } else {
        setMembers(initialMembers);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, initialMembers]);

  // Apply class filter client-side
  const filteredMembers = useMemo(() => {
    if (selectedClassId === "all") {
      return members;
    }
    const classIdNum = parseInt(selectedClassId);
    return members.filter((m) => m.classId === classIdNum);
  }, [members, selectedClassId]);

  // Calculate total pages based on filtered members
  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);

  // Get current page members from filtered list
  const getCurrentPageMembers = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId]);

  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    try {
      await deleteMember(selectedMember.id);
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);
      toast.success("Member deleted successfully");
    } catch (error) {
      toast.error("Failed to delete member");
      console.error(error);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setSelectedMember(null);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedClassId("all");
  };

  const hasActiveFilters = searchQuery !== "" || selectedClassId !== "all";

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Manage club members and their information
              </p>
            </div>
            <Button
              onClick={() => {
                setSelectedMember(null);
                setIsFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[200px] flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search members by name or number..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="text-muted-foreground h-4 w-4" />
              <Select
                value={selectedClassId}
                onValueChange={setSelectedClassId}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {memberClasses.map((mc) => (
                    <SelectItem key={mc.id} value={mc.id.toString()}>
                      {mc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Filters:</span>
              {selectedClassId !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Class:{" "}
                  {
                    memberClasses.find(
                      (mc) => mc.id.toString() === selectedClassId,
                    )?.label
                  }
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{searchQuery}"
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-xs"
              >
                Clear all
              </Button>
              <span className="text-muted-foreground ml-auto text-sm">
                {filteredMembers.length} result
                {filteredMembers.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <MembersTable
            members={getCurrentPageMembers()}
            onEdit={(member) => {
              setSelectedMember(member);
              setIsFormOpen(true);
            }}
            onDelete={(member) => {
              setSelectedMember(member);
              setIsDeleteDialogOpen(true);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          else setIsFormOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMember ? "Edit Member" : "Add Member"}
            </DialogTitle>
          </DialogHeader>
          <MemberForm
            mode={selectedMember ? "edit" : "create"}
            member={selectedMember ?? undefined}
            memberClasses={memberClasses}
            onSuccess={resetForm}
            onCancel={resetForm}
          />
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteMember}
        title="Delete Member"
        description="This action cannot be undone and will permanently delete this member and all associated data."
        itemName={
          selectedMember
            ? `${selectedMember.firstName} ${selectedMember.lastName}`
            : undefined
        }
      />
    </>
  );
}
