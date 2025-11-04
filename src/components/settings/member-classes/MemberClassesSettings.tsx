"use client";

import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";
import { toast } from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import type { MemberClass } from "~/server/db/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memberClassesQueryOptions } from "~/server/query-options/member-classes-query-options";
import { memberClassesMutations } from "~/server/query-options/member-classes-mutation-options";

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
  initialMemberClasses: MemberClass[];
}

export function MemberClassesSettings({
  initialMemberClasses,
}: MemberClassesSettingsProps) {
  const queryClient = useQueryClient();

  // Use TanStack Query for member classes
  const { data: memberClasses = initialMemberClasses, isLoading } = useQuery(
    memberClassesQueryOptions.all()
  );

  const [showDialog, setShowDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<MemberClass | null>(null);
  const [form, setForm] = useState<MemberClassForm>(initialForm);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    memberClass: MemberClass | null;
  }>({
    open: false,
    memberClass: null,
  });

  // Setup mutations with factory pattern
  const createMutation = useMutation({
    ...memberClassesMutations.create(queryClient),
    onSuccess: () => {
      toast.success("Member class created successfully");
      setShowDialog(false);
      setForm(initialForm);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create member class");
    },
  });

  const updateMutation = useMutation({
    ...memberClassesMutations.update(queryClient),
    onSuccess: () => {
      toast.success("Member class updated successfully");
      setShowDialog(false);
      setEditingClass(null);
      setForm(initialForm);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update member class");
    },
  });

  const deleteMutation = useMutation({
    ...memberClassesMutations.delete(queryClient),
    onSuccess: () => {
      toast.success("Member class deleted successfully");
      setDeleteDialog({ open: false, memberClass: null });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete member class");
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingClass) {
      // Update existing class
      updateMutation.mutate({
        id: editingClass.id,
        data: form,
      });
    } else {
      // Create new class
      createMutation.mutate(form);
    }
  };

  // Handle edit
  const handleEdit = (memberClass: MemberClass) => {
    setEditingClass(memberClass);
    setForm({
      label: memberClass.label,
      isActive: memberClass.isActive,
      sortOrder: memberClass.sortOrder,
    });
    setShowDialog(true);
  };

  // Handle delete
  const handleDelete = (memberClass: MemberClass) => {
    deleteMutation.mutate(memberClass.id);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Member Classes</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Manage member class types and their display order
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingClass(null);
              setForm({ ...initialForm, sortOrder: memberClasses.length });
              setShowDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Member Class
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Order</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberClasses.map((memberClass, index) => (
                <TableRow key={memberClass.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{index + 1}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {memberClass.label}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={memberClass.isActive ? "default" : "secondary"}
                    >
                      {memberClass.isActive ? (
                        <>
                          <Eye className="mr-1 h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="mr-1 h-3 w-3" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {memberClass.isSystemGenerated && (
                      <Badge variant="outline">
                        <Shield className="mr-1 h-3 w-3" />
                        System
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(memberClass)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!memberClass.isSystemGenerated && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              memberClass,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingClass ? "Edit Member Class" : "Add Member Class"}
              </DialogTitle>
              <DialogDescription>
                {editingClass
                  ? "Update the member class details"
                  : "Create a new member class"}
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
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={form.isActive}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, isActive: checked })
                    }
                  />
                  <Label htmlFor="isActive">Active</Label>
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
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
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
