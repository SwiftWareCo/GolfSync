"use client";

import { Search } from "lucide-react";
import { Input } from "~/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  autoFocus = false,
}: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="text-org-tertiary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`pl-9 ${className}`}
        autoFocus={autoFocus}
      />
    </div>
  );
}
