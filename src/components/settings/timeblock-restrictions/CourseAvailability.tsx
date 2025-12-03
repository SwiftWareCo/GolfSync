"use client";

import { useState, useActionState, startTransition } from "react";
import { Ban, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { RestrictionCard } from "./RestrictionCard";
import { TimeblockRestrictionDialog } from "./TimeblockRestrictionDialog";
import type { MemberClass, TimeblockRestriction } from "~/server/db/schema";
import toast from "react-hot-toast";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";
import { deleteTimeblockRestriction } from "~/server/timeblock-restrictions/actions";

interface CourseAvailabilityProps {
  restrictions: TimeblockRestriction[];
  memberClasses?: MemberClass[];
}

export function CourseAvailability({
  restrictions,
  memberClasses = [],
}: CourseAvailabilityProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [selectedRestriction, setSelectedRestriction] = useState<
    TimeblockRestriction | undefined
  >();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [restrictionToDelete, setRestrictionToDelete] = useState<
    TimeblockRestriction | undefined
  >();

  // Use server action for delete
  const [deleteState, deleteAction, isDeletePending] = useActionState(
    async (prevState: any, restrictionId: number) => {
      const result = await deleteTimeblockRestriction(restrictionId);
      if (result && "error" in result) {
        toast.error(result.error || "Failed to delete restriction");
        return { success: false, error: result.error };
      }
      toast.success("Course availability restriction deleted successfully");
      setIsDeleteDialogOpen(false);
      setRestrictionToDelete(undefined);
      return { success: true };
    },
    null,
  );

  const handleOpenDialog = (restriction?: TimeblockRestriction) => {
    if (restriction) {
      setEditorMode("edit");
      setSelectedRestriction(restriction);
    } else {
      setEditorMode("create");
      setSelectedRestriction(undefined);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedRestriction(undefined);
  };

  const handleDeleteClick = (restriction: TimeblockRestriction) => {
    setRestrictionToDelete(restriction);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!restrictionToDelete) return;
    startTransition(() => {
      deleteAction(restrictionToDelete.id);
    });
  };

  const handleSuccess = () => {
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
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent className="flex max-h-[90vh] min-h-[600px] max-w-4xl flex-col p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>
                {editorMode === "create"
                  ? "Create Course Availability Restriction"
                  : "Edit Course Availability Restriction"}
              </DialogTitle>
            </DialogHeader>
            <TimeblockRestrictionDialog
              key={selectedRestriction?.id || "new"}
              mode={editorMode}
              existingRestriction={selectedRestriction}
              memberClasses={memberClasses}
              restrictionCategory="COURSE_AVAILABILITY"
              onSuccess={handleSuccess}
              onCancel={handleCloseDialog}
            />
          </DialogContent>
        </Dialog>
      )}

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
