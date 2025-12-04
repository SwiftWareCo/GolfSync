"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Save, RotateCcw, Info } from "lucide-react";
import { toast } from "react-hot-toast";

// TODO: Move DEFAULT_SPEED_BONUSES to ~/lib/lottery-utils or create a constants file
// For now, define locally until proper migration
const DEFAULT_SPEED_BONUSES: TimeWindowSpeedBonus[] = [
  { window: "MORNING", fastBonus: 5, averageBonus: 2, slowBonus: 0 },
  { window: "MIDDAY", fastBonus: 2, averageBonus: 1, slowBonus: 0 },
  { window: "AFTERNOON", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
  { window: "EVENING", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
];

type TimeWindowSpeedBonus = {
  window: string;
  fastBonus: number;
  averageBonus: number;
  slowBonus: number;
};

export function SpeedBonusConfiguration() {
  const [bonuses, setBonuses] = useState<TimeWindowSpeedBonus[]>(
    DEFAULT_SPEED_BONUSES,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleBonusChange = (
    windowIndex: number,
    tier: "fastBonus" | "averageBonus" | "slowBonus",
    value: string,
  ) => {
    const numValue = parseInt(value) || 0;

    // Validate range (0-50)
    if (numValue < 0 || numValue > 50) {
      toast.error("Bonus values must be between 0 and 50");
      return;
    }

    setBonuses((prev) =>
      prev.map((bonus, index) =>
        index === windowIndex ? { ...bonus, [tier]: numValue } : bonus,
      ),
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement save to database/settings
      // For now, just show success
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

      toast.success("Speed bonus configuration saved successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to save speed bonus configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setBonuses(DEFAULT_SPEED_BONUSES);
    toast.success("Reset to default speed bonus values");
  };

  const hasChanges =
    JSON.stringify(bonuses) !== JSON.stringify(DEFAULT_SPEED_BONUSES);

  const getWindowIcon = (window: string) => {
    switch (window) {
      case "MORNING":
        return "☀️";
      case "MIDDAY":
        return "🌞";
      case "AFTERNOON":
        return "🌤️";
      case "EVENING":
        return "🌅";
      default:
        return "⏰";
    }
  };

  const getWindowDescription = (window: string) => {
    switch (window) {
      case "MORNING":
        return "Early tee times (most important for pace)";
      case "MIDDAY":
        return "Mid-day tee times (moderate pace impact)";
      case "AFTERNOON":
        return "Later tee times (minimal pace impact)";
      case "EVENING":
        return "Latest tee times (no pace impact)";
      default:
        return "";
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Information Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 text-blue-600" />
          <div className="text-sm text-blue-800">
            <div className="mb-1 font-medium">Speed Bonus System</div>
            <div className="space-y-1">
              <p>
                • <strong>FAST players (≤3:55)</strong>: Get +5 morning, +2
                midday priority
              </p>
              <p>
                • <strong>AVERAGE players (3:56-4:05)</strong>: Get +2 morning,
                +1 midday priority
              </p>
              <p>
                • <strong>SLOW players (4:06+)</strong>: Get no speed bonuses
              </p>
              <p>• Higher bonuses = higher priority in lottery algorithm</p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            Time Window Bonus Configuration
          </h3>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary" className="text-xs">
                Unsaved changes
              </Badge>
            )}
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit Configuration
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          {bonuses.map((bonus, index) => (
            <Card key={bonus.window} className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-lg">{getWindowIcon(bonus.window)}</span>
                  {bonus.window} Window
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {getWindowDescription(bonus.window)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {/* Fast Bonus */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-green-700">
                      Fast Players (≤3:55)
                    </Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        value={bonus.fastBonus}
                        onChange={(e) =>
                          handleBonusChange(index, "fastBonus", e.target.value)
                        }
                        className="text-center font-medium"
                      />
                    ) : (
                      <div className="flex h-10 items-center justify-center rounded-md border bg-green-50 font-medium text-green-700">
                        +{bonus.fastBonus} points
                      </div>
                    )}
                  </div>

                  {/* Average Bonus */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-yellow-700">
                      Average Players (3:56-4:05)
                    </Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        value={bonus.averageBonus}
                        onChange={(e) =>
                          handleBonusChange(
                            index,
                            "averageBonus",
                            e.target.value,
                          )
                        }
                        className="text-center font-medium"
                      />
                    ) : (
                      <div className="flex h-10 items-center justify-center rounded-md border bg-yellow-50 font-medium text-yellow-700">
                        +{bonus.averageBonus} points
                      </div>
                    )}
                  </div>

                  {/* Slow Bonus */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Slow Players (4:06+)
                    </Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        value={bonus.slowBonus}
                        onChange={(e) =>
                          handleBonusChange(index, "slowBonus", e.target.value)
                        }
                        className="text-center font-medium"
                      />
                    ) : (
                      <div className="flex h-10 items-center justify-center rounded-md border bg-gray-50 font-medium text-gray-700">
                        +{bonus.slowBonus} points
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
