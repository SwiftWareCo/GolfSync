export const teesheetKeys = {
  all: ["teesheet"] as const,
  details: () => [...teesheetKeys.all, "detail"] as const,
  detail: (date: string) => [...teesheetKeys.details(), date] as const,
};
