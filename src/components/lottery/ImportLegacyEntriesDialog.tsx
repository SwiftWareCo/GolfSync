"use client";

/**
 * Import Legacy Entries Dialog
 * [TESTING ONLY]
 *
 * Dialog for importing lottery entries from the legacy app's network response format.
 * Shows preview with member matching status before import.
 */

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Check, X, AlertTriangle, Upload, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import {
  validateAndConvertEntries,
  type ConversionValidationResult,
  type ConvertedLotteryEntry,
  type MemberReference,
} from "~/lib/lottery/convert-legacy-entries";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";
import { importLegacyLotteryEntries } from "~/server/lottery/actions";

// ============================================================================
// Types
// ============================================================================

interface ImportLegacyEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotteryDate: string;
  members: MemberReference[];
  availableConfigs: TeesheetConfigWithBlocks[];
  currentConfig: TeesheetConfigWithBlocks | null;
}

// ============================================================================
// Component
// ============================================================================

export function ImportLegacyEntriesDialog({
  open,
  onOpenChange,
  lotteryDate,
  members,
  availableConfigs,
  currentConfig,
}: ImportLegacyEntriesDialogProps) {
  const [selectedConfigId, setSelectedConfigId] = useState<string>(
    currentConfig?.id?.toString() ?? "",
  );
  const [jsonInput, setJsonInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ConversionValidationResult | null>(null);

  // Get selected config
  const selectedConfig = useMemo(() => {
    if (!selectedConfigId) return currentConfig;
    return (
      availableConfigs.find((c) => c.id.toString() === selectedConfigId) ??
      currentConfig
    );
  }, [selectedConfigId, availableConfigs, currentConfig]);

  // Calculate time windows for selected config
  const timeWindows = useMemo(() => {
    return calculateDynamicTimeWindows(selectedConfig);
  }, [selectedConfig]);

  // Handle validation
  const handleValidate = () => {
    if (!jsonInput.trim()) {
      toast.error("Please paste the JSON entries");
      return;
    }

    setIsValidating(true);
    try {
      const result = validateAndConvertEntries(
        jsonInput,
        lotteryDate,
        members,
        timeWindows,
      );
      setValidationResult(result);

      if (!result.valid) {
        toast.error("Validation failed: " + result.errors.join(", "));
      } else if (result.warnings.length > 0) {
        toast(`Validated with ${result.warnings.length} warning(s)`, {
          icon: "⚠️",
        });
      } else {
        toast.success(
          `Validated ${result.convertedEntries.length} entries successfully`,
        );
      }
    } catch (error) {
      toast.error(
        "Validation error: " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setIsValidating(false);
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!validationResult || !validationResult.valid) {
      toast.error("Please validate entries first");
      return;
    }

    if (validationResult.convertedEntries.length === 0) {
      toast.error("No valid entries to import");
      return;
    }

    setIsImporting(true);
    try {
      const result = await importLegacyLotteryEntries(
        lotteryDate,
        validationResult.convertedEntries,
      );

      if (result.success) {
        const data = result.data as { importedCount: number } | undefined;
        toast.success(
          `Successfully imported ${data?.importedCount ?? 0} entries`,
        );
        onOpenChange(false);
        // Reset state
        setJsonInput("");
        setValidationResult(null);
      } else {
        toast.error(result.error ?? "Failed to import entries");
      }
    } catch (error) {
      toast.error(
        "Import error: " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setJsonInput("");
      setValidationResult(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            🧪 Import Legacy Entries
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-orange-600">[TESTING ONLY]</span>{" "}
            Import lottery entries from the legacy app. Paste the JSON response
            from the network tab.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-4 sm:px-6">
          <div className="space-y-4">
            {/* Config Selector */}
            <div className="space-y-2">
              <Label htmlFor="config-select">Teesheet Configuration</Label>
              <Select
                value={selectedConfigId}
                onValueChange={setSelectedConfigId}
              >
                <SelectTrigger id="config-select">
                  <SelectValue placeholder="Select a configuration" />
                </SelectTrigger>
                <SelectContent>
                  {availableConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id.toString()}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {timeWindows.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {timeWindows.map((w) => (
                    <Badge key={w.value} variant="outline" className="text-xs">
                      {w.icon} {w.label}: {w.timeRange}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* JSON Input */}
            <div className="space-y-2">
              <Label htmlFor="json-input">Legacy JSON Data</Label>
              <textarea
                id="json-input"
                className="h-40 w-full resize-none rounded-md border p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder={'Paste JSON here, e.g.:\n{"entries": [...]}'}
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setValidationResult(null); // Reset validation when input changes
                }}
              />
            </div>

            {/* Validate Button */}
            <Button
              onClick={handleValidate}
              disabled={isValidating || !jsonInput.trim()}
              variant="outline"
              className="w-full"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Validate & Preview"
              )}
            </Button>

            {/* Validation Results */}
            {validationResult && (
              <div className="space-y-3">
                {/* Stats */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Total: {validationResult.totalEntries} entries
                  </Badge>
                  <Badge variant="default">
                    Valid: {validationResult.convertedEntries.length}
                  </Badge>
                  <Badge className="bg-green-100 text-green-800">
                    <Check className="mr-1 h-3 w-3" />
                    Exact: {validationResult.matchStats.exact}
                  </Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Fuzzy: {validationResult.matchStats.fuzzy}
                  </Badge>
                  <Badge className="bg-red-100 text-red-800">
                    <X className="mr-1 h-3 w-3" />
                    Unmatched: {validationResult.matchStats.unmatched}
                  </Badge>
                </div>

                {/* Errors */}
                {validationResult.errors.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <p className="mb-1 font-medium text-red-800">Errors:</p>
                    <ul className="list-inside list-disc text-sm text-red-700">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {validationResult.warnings.length > 0 && (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                    <p className="mb-1 font-medium text-yellow-800">Warnings:</p>
                    <ul className="list-inside list-disc text-sm text-yellow-700">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Player Matches Preview */}
                {validationResult.convertedEntries.length > 0 && (
                  <div className="space-y-2">
                    <Label>Player Matches Preview</Label>
                    <ScrollArea className="h-48 rounded-md border">
                      <div className="space-y-2 p-3">
                        {validationResult.convertedEntries.flatMap(
                          (entry, entryIdx) =>
                            entry.playerMatches.map((match, matchIdx) => (
                              <div
                                key={`${entryIdx}-${matchIdx}`}
                                className="flex items-center gap-2 text-sm"
                              >
                                {match.matchType === "exact" && (
                                  <Check className="h-4 w-4 text-green-600" />
                                )}
                                {match.matchType === "fuzzy" && (
                                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                )}
                                {match.matchType === "unmatched" && (
                                  <X className="h-4 w-4 text-red-600" />
                                )}
                                <span className="font-medium">
                                  {match.originalName}
                                </span>
                                {match.matchedName && (
                                  <>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-gray-600">
                                      {match.matchedName}
                                    </span>
                                  </>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`ml-auto text-xs ${
                                    match.matchType === "exact"
                                      ? "border-green-300"
                                      : match.matchType === "fuzzy"
                                        ? "border-yellow-300"
                                        : "border-red-300"
                                  }`}
                                >
                                  {match.matchType} (
                                  {Math.round(match.confidence * 100)}%)
                                </Badge>
                              </div>
                            )),
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              isImporting ||
              !validationResult?.valid ||
              validationResult.convertedEntries.length === 0
            }
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${validationResult?.convertedEntries.length ?? 0} Entries`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
