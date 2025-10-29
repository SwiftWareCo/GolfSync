"use client";
import { useState, useTransition } from "react";
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

// Server actions need to be directly imported in client components
import { updateCourseInfo } from "~/server/settings/actions";

type CourseInfoProps = {
  initialData?: {
    id?: number;
    notes?: string;
  };
};

export function CourseInfoSettings({ initialData }: CourseInfoProps) {
  const [isPending, startTransition] = useTransition();

  const [notes, setNotes] = useState(initialData?.notes || "");

  // Save course info
  const saveChanges = () => {
    startTransition(async () => {
      try {
        const result = await updateCourseInfo({
          notes,
        });

        if (result.success) {
          toast.success("Course info saved successfully");
        } else {
          toast.error(result.error || "Failed to save course info");
        }
      } catch (error) {
        toast.error("An error occurred while saving");
        console.error(error);
      }
    });
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
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
