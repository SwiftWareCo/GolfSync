"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";
import { toast } from "react-hot-toast";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import type { MemberClass } from "~/server/db/schema";
import {
  BaseDataTable,
  type ActionDef,
  type ColumnDef,
} from "~/components/ui/BaseDataTable";
import {
  createMemberClassAction,
  updateMemberClassAction,
  deleteMemberClassAction,
} from "~/server/member-classes/actions";

interface MemberClassForm {
  label: string;
  isActive: boolean;
  sortOrder: number;
}

const initialForm: MemberClassForm = {
  label: "",
  isActive: true,
  sortOrder: 0,
};

interface MemberClassesSettingsProps {
  MemberClasses: MemberClass[];
}

const ITEMS_PER_PAGE = 10;

export function MemberClassesSettings({
  MemberClasses,
}: MemberClassesSettingsProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<MemberClass | null>(null);
  const [form, setForm] = useState<MemberClassForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    memberClass: MemberClass | null;
  }>({
    open: false,
    memberClass: null,
  });

  // Pagination
  const totalPages = Math.ceil(MemberClasses.length / ITEMS_PER_PAGE);
  const paginatedClasses = MemberClasses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Column definitions for BaseDataTable
  const columns: ColumnDef<MemberClass>[] = [
    {
      header: "#",
      cell: (item) => (
        <span className="text-muted-foreground font-mono text-sm">
          {MemberClasses.indexOf(item) + 1}
        </span>
      ),
    },
    {
      header: "Label",
      cell: (item) => <span className="font-medium">{item.label}</span>,
    },
    {
      header: "Status",
      cell: (item) => (
        <Badge
          variant={item.isActive ? "default" : "secondary"}
          className="gap-1"
        >
          {item.isActive ? (
            <>
              <Eye className="h-3 w-3" />
              Active
            </>
          ) : (
            <>
              <EyeOff className="h-3 w-3" />
              Inactive
            </>
          )}
        </Badge>
      ),
    },
  ];

  // Action definitions for BaseDataTable
  const actions: ActionDef<MemberClass>[] = [
    {
      label: "Edit",
      icon: <Edit className="mr-2 h-4 w-4" />,
      onClick: handleEdit,
    },
    {
      label: "Delete",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: (item) => setDeleteDialog({ open: true, memberClass: item }),
      className: "text-destructive",
    },
  ];

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingClass) {
        const result = await updateMemberClassAction(editingClass.id, form);
        if (result.success) {
          toast.success("Member class updated");
          setShowDialog(false);
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to update member class");
        }
      } else {
        const result = await createMemberClassAction(form);
        if (result.success) {
          toast.success("Member class created");
          setShowDialog(false);
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to create member class");
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle edit
  function handleEdit(memberClass: MemberClass) {
    setEditingClass(memberClass);
    setForm({
      label: memberClass.label,
      isActive: memberClass.isActive,
      sortOrder: memberClass.sortOrder,
    });
    setShowDialog(true);
  }

  // Handle delete
  async function handleDelete(memberClass: MemberClass) {
    try {
      const result = await deleteMemberClassAction(memberClass.id);
      if (result.success) {
        toast.success("Member class deleted");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to delete member class");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setDeleteDialog({ open: false, memberClass: null });
    }
  }

  // Reset form when dialog closes
  function handleDialogChange(open: boolean) {
    setShowDialog(open);
    if (!open) {
      setEditingClass(null);
      setForm(initialForm);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Member Classes</CardTitle>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Manage membership categories and their visibility
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingClass(null);
              setForm({ ...initialForm, sortOrder: MemberClasses.length });
              setShowDialog(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Class
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <BaseDataTable
          data={paginatedClasses}
          columns={columns}
          actions={actions}
          emptyMessage="No member classes found. Create one to get started."
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={handleDialogChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingClass ? "Edit Member Class" : "Add Member Class"}
              </DialogTitle>
              <DialogDescription>
                {editingClass
                  ? "Update the member class details"
                  : "Create a new member class category"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="label">Display Label</Label>
                  <Input
                    id="label"
                    value={form.label}
                    onChange={(e) =>
                      setForm({ ...form, label: e.target.value })
                    }
                    placeholder="e.g., Unlimited Play Male"
                    required
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive" className="text-sm font-medium">
                      Active Status
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Inactive classes won't appear in selections
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={form.isActive}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, isActive: checked })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner className="mr-2 h-4 w-4" />
                      Saving...
                    </>
                  ) : editingClass ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialog.open}
          onOpenChange={(open) =>
            setDeleteDialog({ open, memberClass: deleteDialog.memberClass })
          }
          onConfirm={() =>
            deleteDialog.memberClass && handleDelete(deleteDialog.memberClass)
          }
          title="Delete Member Class"
          description={`Are you sure you want to delete "${deleteDialog.memberClass?.label}"? This action cannot be undone.`}
        />
      </CardContent>
    </Card>
  );
}
