"use client";

import { useState, useMemo } from "react";
import { useDebounce } from "use-debounce";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Loader2, Search, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fillSavedQueryOptions } from "~/server/query-options";
import { createFillSavedAction } from "~/server/fills-saved/actions";

interface FillFormProps {
  onAddFill: (fillType: string, customName?: string) => void | Promise<void>;
  isDisabled?: boolean;
  isTimeBlockFull?: boolean;
}

// Preset fill types that don't require templates
const PRESET_FILLS = [
  { id: "guest", label: "Guest Fill", type: "guest_fill" },
  { id: "reciprocal", label: "Reciprocal Fill", type: "reciprocal_fill" },
];

export function FillForm({
  onAddFill,
  isDisabled = false,
  isTimeBlockFull = false,
}: FillFormProps) {
  const queryClient = useQueryClient();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);

  // New template creation state
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFull = isDisabled || isTimeBlockFull;

  // Query saved fills
  const templatesQuery = useQuery({
    ...fillSavedQueryOptions.search(debouncedSearch),
  });

  // Filter presets based on search
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return PRESET_FILLS;
    const lower = searchQuery.toLowerCase();
    return PRESET_FILLS.filter(
      (p) =>
        p.label.toLowerCase().includes(lower) ||
        p.id.toLowerCase().includes(lower),
    );
  }, [searchQuery]);

  // Show create option when search has no exact matches
  const showCreateOption = useMemo(() => {
    if (!debouncedSearch.trim() || debouncedSearch.length < 2) return false;
    const templates = templatesQuery.data || [];
    const exactMatch = templates.some(
      (t) => t.name.toLowerCase() === debouncedSearch.toLowerCase(),
    );
    const presetMatch = PRESET_FILLS.some(
      (p) => p.label.toLowerCase() === debouncedSearch.toLowerCase(),
    );
    return !exactMatch && !presetMatch;
  }, [debouncedSearch, templatesQuery.data]);

  // Handle adding a preset fill
  const handleAddPreset = async (preset: (typeof PRESET_FILLS)[0]) => {
    if (isFull) {
      toast.error("No spaces available");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = onAddFill(preset.type);
      if (result instanceof Promise) await result;
      setSearchQuery("");
    } catch (error) {
      console.error("Error adding fill:", error);
      toast.error("Failed to add fill");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle adding a template fill
  const handleAddTemplate = async (template: { id: number; name: string }) => {
    if (isFull) {
      toast.error("No spaces available");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = onAddFill("custom_fill", template.name);
      if (result instanceof Promise) await result;
      setSearchQuery("");
    } catch (error) {
      console.error("Error adding fill:", error);
      toast.error("Failed to add fill");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle creating a new template and adding it
  const handleCreateAndAdd = async () => {
    const name = newTemplateName.trim() || debouncedSearch.trim();
    if (!name) {
      toast.error("Please enter a fill name");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createFillSavedAction(name);

      if (result.success && result.data) {
        // Invalidate saved fills cache
        await queryClient.invalidateQueries({ queryKey: ["fillsSaved"] });

        // Add the fill
        const addResult = onAddFill("custom_fill", result.data.name);
        if (addResult instanceof Promise) await addResult;

        toast.success(`Created and added "${name}"`);
        setSearchQuery("");
        setNewTemplateName("");
        setShowCreateNew(false);
      } else {
        toast.error(result.error || "Failed to create template");
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4 p-1">
      <div className="space-y-2">
        <Label>Search or Select Fill</Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search fills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            disabled={isFull || isSubmitting}
          />
        </div>
      </div>

      {/* Preset fills */}
      {filteredPresets.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Quick Add</Label>
          <div className="flex flex-wrap gap-2">
            {filteredPresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddPreset(preset)}
                disabled={isFull || isSubmitting}
              >
                <Plus className="mr-1 h-3 w-3" />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Template search results - only show when searching */}
      {debouncedSearch.trim() && templatesQuery.isLoading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {debouncedSearch.trim() && templatesQuery.data && templatesQuery.data.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Saved Fills</Label>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {templatesQuery.data.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleAddTemplate(template)}
                disabled={isFull || isSubmitting}
                className="flex w-full items-center justify-between rounded-md border bg-gray-50 px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                <span>{template.name}</span>
                <Badge variant="secondary" className="text-xs">
                  Template
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create new saved fill option */}
      {showCreateOption && !showCreateNew && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNewTemplateName(debouncedSearch);
            setShowCreateNew(true);
          }}
          disabled={isFull}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create "{debouncedSearch}" Saved Fill
        </Button>
      )}

      {/* Create new saved fill form */}
      {showCreateNew && (
        <div className="space-y-2 rounded-md border bg-gray-50 p-3">
          <Label className="text-xs text-gray-500">New Saved Fill Name</Label>
          <Input
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="Enter template name..."
            disabled={isCreating}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleCreateAndAdd}
              disabled={isCreating || !newTemplateName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Add"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateNew(false);
                setNewTemplateName("");
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
