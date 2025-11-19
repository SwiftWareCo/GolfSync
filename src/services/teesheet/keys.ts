export const teesheetKeys = {
  all: ["teesheet"] as const,
  lists: () => [...teesheetKeys.all, "list"] as const,
  list: (filters: string) => [...teesheetKeys.lists(), { filters }] as const,
  details: () => [...teesheetKeys.all, "detail"] as const,
  detail: (date: string) => [...teesheetKeys.details(), date] as const,
};
