"use client";

import { useState, useEffect } from "react";
import { Ban, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { RestrictionCard } from "./RestrictionCard";
import { TimeblockRestrictionDialog } from "./TimeblockRestrictionDialog";
import { type TimeblockRestriction } from "./TimeblockRestrictionsSettings";
import type { MemberClass } from "~/server/db/schema";
import toast from "react-hot-toast";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { restrictionsMutations } from "~/server/query-options/restrictions-mutation-options";

interface CourseAvailabilityProps {
  restrictions: TimeblockRestriction[];
  onUpdate: (restriction: TimeblockRestriction) => void;
  onAdd: (restriction: TimeblockRestriction) => void;
  onDelete: (restrictionId: number) => void;
  highlightId?: number | null;
  onDialogClose?: () => void;
  memberClasses?: MemberClass[];
}

export function CourseAvailability({
  restrictions,
  onUpdate,
  onAdd,
  onDelete,
  highlightId,
  onDialogClose,
  memberClasses = [],
}: CourseAvailabilityProps) {
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRestriction, setSelectedRestriction] = useState<
    TimeblockRestriction | undefined
  >();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [restrictionToDelete, setRestrictionToDelete] = useState<
    TimeblockRestriction | undefined
  >();

  // Setup delete mutation with factory pattern
  const deleteMutation = useMutation({
    ...restrictionsMutations.delete(queryClient),
    onSuccess: () => {
      toast.success("Course availability restriction deleted successfully");
      setIsDeleteDialogOpen(false);
      setRestrictionToDelete(undefined);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete restriction");
    },
  });

  useEffect(() => {
    if (highlightId) {
      const restriction = restrictions.find((r) => r.id === highlightId);
      if (restriction) {
        handleOpenDialog(restriction);
      }
    }
  }, [highlightId, restrictions]);

  const handleOpenDialog = (restriction?: TimeblockRestriction) => {
    setSelectedRestriction(restriction);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedRestriction(undefined);
    if (onDialogClose) {
      onDialogClose();
    }
  };

  const handleDeleteClick = (restriction: TimeblockRestriction) => {
    setRestrictionToDelete(restriction);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!restrictionToDelete) return;
    deleteMutation.mutate(restrictionToDelete.id);
  };

  const handleSuccess = (restriction: TimeblockRestriction) => {
    if (selectedRestriction) {
      onUpdate(restriction);
    } else {
      onAdd(restriction);
    }
    setIsDialogOpen(false);
    setSelectedRestriction(undefined);
  };

  return (
    <>
      <div className="mb-4 flex flex-row items-center justify-between">
        <h3 className="text-lg font-medium">
          Course Availability Restrictions
        </h3>
        <Button onClick={() => handleOpenDialog()} variant="default">
          <Plus className="mr-2 h-4 w-4" />
          Add Restriction
        </Button>
      </div>

      {restrictions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Ban className="mb-2 h-10 w-10" />
          <h3 className="text-lg font-medium">
            No course availability restrictions
          </h3>
          <p>
            Add restrictions for weather conditions, maintenance, or special
            events
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {restrictions.map((restriction) => (
            <RestrictionCard
              key={restriction.id}
              restriction={restriction}
              onEdit={() => handleOpenDialog(restriction)}
              onDelete={() => handleDeleteClick(restriction)}
              isHighlighted={restriction.id === highlightId}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <TimeblockRestrictionDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        existingRestriction={selectedRestriction}
        restrictionCategory="COURSE_AVAILABILITY"
        onSuccess={handleSuccess}
        memberClasses={memberClasses}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Course Restriction"
        description="This action cannot be undone and will permanently delete this restriction."
        itemName={restrictionToDelete?.name}
      />
    </>
  );
}
