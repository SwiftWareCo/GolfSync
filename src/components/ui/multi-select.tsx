"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export type OptionType = {
  value: string;
  label: string;
};

interface MultiSelectProps {
  options: OptionType[];
  selected: string[];
  onChange: (selectedValues: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options",
  emptyMessage = "No options found.",
  disabled = false,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Create a set of selected values for faster lookups
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  // Get labels for the selected values for display
  const selectedLabels = React.useMemo(() => {
    return selected.map((value) => {
      const option = options.find((o) => o.value === value);
      return option ? option.label : value;
    });
  }, [selected, options]);

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [options, searchQuery]);

  // Focus input when popover opens
  React.useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else {
      setSearchQuery("");
    }
  }, [open]);

  // Handle selection/deselection of an option
  const handleSelect = (value: string) => {
    const newSelected = [...selected];
    const index = newSelected.indexOf(value);

    if (index > -1) {
      // Remove if already selected
      newSelected.splice(index, 1);
    } else {
      // Add if not selected
      newSelected.push(value);
    }

    onChange(newSelected);
  };

  // Remove a selected item via badge click
  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "hover:bg-org-secondary w-full justify-between",
            className,
          )}
          disabled={disabled}
          ref={triggerRef}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-muted">{placeholder}</span>
            ) : selected.length <= 3 ? (
              <div className="flex flex-wrap gap-1">
                {selected.map((value, i) => {
                  const option = options.find((o) => o.value === value);
                  return (
                    <Badge
                      variant="secondary"
                      key={value}
                      className="px-2 py-1"
                    >
                      {option?.label || value}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={(e) => handleRemove(value, e)}
                      />
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="px-2 py-1">
                  {selected.length} selected
                </Badge>
                <X
                  className="text-muted-foreground hover:text-foreground h-3 w-3 cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange([]);
                  }}
                />
              </div>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{
          width: triggerRef.current?.offsetWidth
            ? `${triggerRef.current.offsetWidth}px`
            : "auto",
        }}
        align="start"
        onWheel={(e) => {
          // Allow wheel events to bubble to the scrollable content
          e.stopPropagation();
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search options..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            ref={inputRef}
            className="h-9"
          />
          {filteredOptions.length === 0 && (
            <CommandEmpty>{emptyMessage}</CommandEmpty>
          )}
          <CommandGroup className="max-h-[200px] overflow-y-auto">
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                className={cn(
                  "flex cursor-pointer items-center",
                  selectedSet.has(option.value) && "bg-org-primary-light",
                )}
                onSelect={() => handleSelect(option.value)}
              >
                <div
                  className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                    selectedSet.has(option.value)
                      ? "border-org-primary bg-org-primary text-white"
                      : "border-org-primary-light",
                  )}
                >
                  {selectedSet.has(option.value) && (
                    <Check className="h-3 w-3" />
                  )}
                </div>
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
