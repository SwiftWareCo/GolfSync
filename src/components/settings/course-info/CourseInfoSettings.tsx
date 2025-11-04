"use client";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import toast from "react-hot-toast";
import { NotesEditor } from "./NotesEditor";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsMutations } from "~/server/query-options/settings-mutation-options";

type CourseInfoProps = {
  initialData?: {
    id?: number;
    notes?: string;
  };
};

export function CourseInfoSettings({ initialData }: CourseInfoProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Setup mutation with factory pattern
  const updateMutation = useMutation({
    ...settingsMutations.updateCourseInfo(queryClient),
    onSuccess: () => {
      toast.success("Course info saved successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save course info");
    },
  });

  // Save course info
  const saveChanges = () => {
    updateMutation.mutate({ notes });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Course Information</CardTitle>
          <CardDescription>
            Set the current course information that will be displayed to members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Course Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Course Notes</Label>
            <NotesEditor value={notes} onChange={setNotes} />
            <p className="text-muted-foreground text-sm">
              Add information such as course conditions, cart rules, hours, etc.
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={saveChanges}
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
