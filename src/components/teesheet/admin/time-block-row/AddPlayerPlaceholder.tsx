"use client";

import { UserPlus } from "lucide-react";

interface AddPlayerPlaceholderProps {
  onClick: () => void;
  compact?: boolean;
}

export function AddPlayerPlaceholder({ onClick }: AddPlayerPlaceholderProps) {
  return (
    <button
      className="flex items-center cursor-pointer gap-2 rounded-md border border-dashed border-blue-300 px-12 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <UserPlus className="h-4 w-4" />
      Add Player
    </button>
  );
}
