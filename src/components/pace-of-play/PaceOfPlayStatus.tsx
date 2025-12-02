"use client";

import { Badge } from "~/components/ui/badge";

// Pace status type from schema
type PaceOfPlayStatus = string;

interface PaceOfPlayStatusProps {
  status: string;
  className?: string;
}

export function PaceOfPlayStatus({ status, className }: PaceOfPlayStatusProps) {
  // Status badge mapping
  const statusConfig: Record<
    PaceOfPlayStatus,
    {
      variant: "default" | "outline" | "secondary" | "destructive";
      label: string;
    }
  > = {
    pending: { variant: "outline", label: "Pending" },
    on_time: { variant: "secondary", label: "On Time" },
    behind: { variant: "destructive", label: "Behind" },
    ahead: { variant: "default", label: "Ahead" },
    completed: { variant: "default", label: "Done" },
    completed_on_time: { variant: "secondary", label: "Done On Time" },
    completed_early: { variant: "default", label: "Done Early" },
    completed_late: { variant: "destructive", label: "Done Late" },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config?.variant} className={className}>
      {config?.label}
    </Badge>
  );
}

// Re-export from pace-helpers for backwards compatibility
export { getPaceStatusColor as getStatusColor } from "~/lib/pace-helpers";
