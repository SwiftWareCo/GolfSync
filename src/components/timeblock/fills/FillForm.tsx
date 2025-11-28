"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import toast from "react-hot-toast";

interface FillFormProps {
  onAddFill: (fillType: string, customName?: string) => void | Promise<void>;
  isDisabled?: boolean;
  isTimeBlockFull?: boolean;
}

const PRESET_FILL_TYPES = [
  { id: "guest", label: "Guest Fill" },
  { id: "reciprocal", label: "Reciprocal Fill" },
  { id: "custom", label: "Custom Fill" },
];

export function FillForm({
  onAddFill,
  isDisabled = false,
  isTimeBlockFull = false,
}: FillFormProps) {
  const [selectedFillType, setSelectedFillType] = useState<string>("guest");
  const [customFillName, setCustomFillName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCustomFill = selectedFillType === "custom";
  const isFull = isDisabled || isTimeBlockFull;

  const handleAddClick = async () => {
    if (isFull) {
      toast.error("No spaces available");
      return;
    }

    if (isCustomFill && !customFillName.trim()) {
      toast.error("Please enter a fill name");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = onAddFill(
        selectedFillType,
        isCustomFill ? customFillName : undefined,
      );

      // Handle both sync and async callbacks
      if (result instanceof Promise) {
        await result;
      }

      // Reset form
      setCustomFillName("");
      setSelectedFillType("guest");
      // Toast is shown by parent component (TimeBlockMemberManager)
    } catch (error) {
      console.error("Error adding fill:", error);
      toast.error("Failed to add fill");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-1">
      <div className="space-y-2">
        <Label htmlFor="fillType">Fill Type</Label>
        <Select
          value={selectedFillType}
          onValueChange={setSelectedFillType}
          disabled={isFull || isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select fill type" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_FILL_TYPES.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustomFill && (
        <div className="space-y-2">
          <Label htmlFor="customName">Fill Name</Label>
          <Input
            id="customName"
            value={customFillName}
            onChange={(e) => setCustomFillName(e.target.value)}
            placeholder="Enter fill name..."
            disabled={isFull || isSubmitting}
            required={isCustomFill}
          />
        </div>
      )}

      <Button
        type="button"
        onClick={handleAddClick}
        disabled={
          isFull || isSubmitting || (isCustomFill && !customFillName.trim())
        }
      >
        {isSubmitting ? "Adding..." : "Add Fill"}
      </Button>
    </div>
  );
}
