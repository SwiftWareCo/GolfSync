"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Search } from "lucide-react";
import { useTransition } from "react";

export function SearchAndFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") || "";
  const currentSpeedTier = searchParams.get("speedTier") || "ALL";
  const currentPriority = searchParams.get("priority") || "ALL";

  const handleSearchChange = (value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
      router.push(`?${params.toString()}`);
    });
  };

  const handleSpeedTierChange = (tier: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (tier === "ALL") {
        params.delete("speedTier");
      } else {
        params.set("speedTier", tier);
      }
      router.push(`?${params.toString()}`);
    });
  };

  const handlePriorityChange = (priority: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (priority === "ALL") {
        params.delete("priority");
      } else {
        params.set("priority", priority);
      }
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search members..."
            value={currentSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            disabled={isPending}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Speed:</span>
          {(["ALL", "FAST", "AVERAGE", "SLOW"] as const).map((tier) => (
            <Badge
              key={tier}
              variant={currentSpeedTier === tier ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleSpeedTierChange(tier)}
            >
              {tier}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Priority:</span>
          {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
            <Badge
              key={priority}
              variant={currentPriority === priority ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handlePriorityChange(priority)}
            >
              {priority}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
