"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { FillTypes } from "~/app/types/TeeSheetTypes";
import type { FillType } from "~/app/types/TeeSheetTypes";

interface LotteryFillSelectorProps {
  onAddFill: (fillType: FillType, customName?: string) => void;
  isDisabled: boolean;
}

export function LotteryFillSelector({
  onAddFill,
  isDisabled,
}: LotteryFillSelectorProps) {
  const [selectedFillType, setSelectedFillType] = useState<FillType>(
    FillTypes.GUEST,
  );
  const [customFillName, setCustomFillName] = useState("");

  const handleAddFill = () => {
    if (selectedFillType === FillTypes.CUSTOM && !customFillName.trim()) {
      toast.error("Please enter a name for the custom fill");
      return;
    }

    onAddFill(
      selectedFillType,
      selectedFillType === FillTypes.CUSTOM ? customFillName : undefined,
    );

    // Reset form
    setCustomFillName("");
    setSelectedFillType(FillTypes.GUEST);
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <Select
        value={selectedFillType}
        onValueChange={(value) => setSelectedFillType(value as FillType)}
        disabled={isDisabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select fill type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FillTypes.GUEST}>Guest Fill</SelectItem>
          <SelectItem value={FillTypes.RECIPROCAL}>Reciprocal Fill</SelectItem>
          <SelectItem value={FillTypes.CUSTOM}>Other...</SelectItem>
        </SelectContent>
      </Select>

      {selectedFillType === FillTypes.CUSTOM && (
        <Input
          value={customFillName}
          onChange={(e) => setCustomFillName(e.target.value)}
          placeholder="Enter fill name..."
          disabled={isDisabled}
        />
      )}

      <Button
        type="button"
        onClick={handleAddFill}
        disabled={
          isDisabled ||
          (selectedFillType === FillTypes.CUSTOM && !customFillName.trim())
        }
        variant="outline"
        size="sm"
        className="w-full"
      >
        Add Fill
      </Button>
    </div>
  );
}
