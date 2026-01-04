export const memberRoundsKeys = {
  all: ["member-rounds"] as const,
  active: () => [...memberRoundsKeys.all, "active"] as const,
  history: () => [...memberRoundsKeys.all, "history"] as const,
};
