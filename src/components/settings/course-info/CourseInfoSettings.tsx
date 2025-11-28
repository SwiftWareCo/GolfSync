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
import { updateCourseInfo } from "~/server/settings/actions";
import { queryKeys } from "~/server/query-options/query-keys";
import type { CourseInfo } from "~/server/db/schema";

type CourseInfoProps = {
  courseInfo?: CourseInfo;
};

export function CourseInfoSettings({ courseInfo }: CourseInfoProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(courseInfo?.notes ?? "");

  // Setup inline mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { notes?: string }) => updateCourseInfo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.courseInfo(),
      });
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
