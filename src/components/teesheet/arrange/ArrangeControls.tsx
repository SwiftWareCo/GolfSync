"use client";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Undo,
  Snowflake,
  ArrowUpDown,
  ClipboardList,
  Wand2,
} from "lucide-react";
import { formatDate } from "~/lib/dates";
import Link from "next/link";

interface ArrangeControlsProps {
  dateString: string;
  pendingChangesCount: number;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
  onFrostDelay: () => void;
  onFrostRemap: () => void;
  onViewLog: () => void;
  hasLog: boolean;
}

export function ArrangeControls({
  dateString,
  pendingChangesCount,
  isSaving,
  onSave,
  onReset,
  onFrostDelay,
  onFrostRemap,
  onViewLog,
  hasLog,
}: ArrangeControlsProps) {
  const hasChanges = pendingChangesCount > 0;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <ArrowUpDown className="text-primary h-5 w-5" />
          <span className="font-semibold">Arrange</span>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {formatDate(dateString, "EEE, MMM d")}
        </p>
      </div>

      {/* Pending changes badge */}
      {hasChanges && (
        <Badge
          variant="secondary"
          className="mb-3 w-full justify-center text-xs"
        >
          {pendingChangesCount} unsaved
        </Badge>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        {/* Save Button */}
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving || !hasChanges}
          className="w-full gap-2"
        >
          {isSaving ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save Changes
            </>
          )}
        </Button>

        {/* Reset Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={isSaving || !hasChanges}
          className="w-full gap-2"
        >
          <Undo className="h-3.5 w-3.5" />
          Reset
        </Button>

        {/* Frost Delay Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onFrostDelay}
          disabled={isSaving}
          className="w-full gap-2"
        >
          <Snowflake className="h-3.5 w-3.5 text-blue-500" />
          Frost Delay
        </Button>

        {/* Remap Blocks Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onFrostRemap}
          disabled={isSaving}
          className="w-full gap-2"
        >
          <Wand2 className="h-3.5 w-3.5 text-purple-500" />
          Remap Blocks
        </Button>

        {/* View Log Button */}
        {hasLog && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewLog}
            className="w-full gap-2"
          >
            <ClipboardList className="h-3.5 w-3.5 text-orange-500" />
            View Log
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="my-4 border-t" />

      {/* Back Link */}
      <Link href={`/admin/${dateString}`} className="w-full">
        <Button variant="ghost" size="sm" className="w-full gap-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Teesheet
        </Button>
      </Link>

      {/* Instructions */}
      <div className="mt-4 rounded-md bg-blue-50 p-2 text-xs text-blue-700">
        <strong>Tip:</strong> Click player → click another to swap, or click
        empty slot to move.
      </div>
    </div>
  );
}
