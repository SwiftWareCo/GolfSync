import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Edit, Check } from "lucide-react";
import toast from "react-hot-toast";
import { updateTeesheetGeneralNotes } from "~/server/teesheet/actions";
import type { Teesheet } from "~/server/db/schema";

interface TeesheetGeneralNotesProps {
  teesheet: Teesheet;
}

export function TeesheetGeneralNotes({ teesheet }: TeesheetGeneralNotesProps) {
  // Store notes as a simple string rather than a complex JSON structure
  const [generalNotes, setGeneralNotes] = useState<string>(
    teesheet.generalNotes || "",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(generalNotes);

  // Save notes to the database as plain text
  const saveGeneralNotes = async (notes: string) => {
    try {
      const result = await updateTeesheetGeneralNotes(teesheet.id, notes);
      if (result.success) {
        setGeneralNotes(notes);
        setIsEditing(false);
        toast.success("Notes saved successfully");
      } else {
        toast.error(result.error || "Failed to save notes");
      }
    } catch (error) {
      toast.error("An unexpected error occurred while saving notes");
    }
  };

  const handleSave = () => {
    saveGeneralNotes(editValue);
  };

  const handleCancel = () => {
    setEditValue(generalNotes);
    setIsEditing(false);
  };

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Teesheet General Notes
        </h3>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-7 p-1"
          >
            <Edit className="mr-1 h-3 w-3" />
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col space-y-2">
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Enter general notes for this teesheet..."
            className="min-h-[100px] text-sm"
            autoFocus
          />
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs"
            >
              <Check className="mr-1 h-3 w-3" />
              Save Notes
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-white p-3 shadow-sm">
          {generalNotes ? (
            <div className="border-l-4 border-org-primary pl-2 text-sm text-gray-600">
              {generalNotes}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">
              No general notes yet. Add notes to provide important information
              for the day.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
