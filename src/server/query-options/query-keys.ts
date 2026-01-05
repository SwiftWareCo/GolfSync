// Centralized query key factory to ensure consistency and prevent conflicts

export const queryKeys = {
  // Teesheet queries
  teesheets: {
    all: () => ["teesheets"] as const,
    byDate: (date: string) => ["teesheets", "date", date] as const,
    withPaceOfPlay: (date: string) =>
      ["teesheets", "date", date, "paceOfPlay"] as const,
  },

  // Member queries
  members: {
    all: () => ["members"] as const,
    search: (query: string) => ["members", "search", query] as const,
    byId: (id: number) => ["members", "byId", id] as const,
  },

  // Guest queries
  guests: {
    all: () => ["guests"] as const,
    search: (query: string) => ["guests", "search", query] as const,
    byId: (id: number) => ["guests", "byId", id] as const,
    frequent: (memberId: number) => ["guests", "frequent", memberId] as const,
  },
  // Lottery queries
  lottery: {
    all: () => ["lottery"] as const,
    settings: () => ["lottery", "settings"] as const,
  },

  // Saved fills queries
  fillsSaved: {
    all: () => ["fillsSaved"] as const,
    search: (query: string) => ["fillsSaved", "search", query] as const,
  },

  // Weather queries
  weather: {
    all: () => ["weather"] as const,
    current: () => ["weather", "current"] as const,
  },

  // Settings queries
  settings: {
    all: () => ["settings"] as const,
    courseInfo: () => ["settings", "courseInfo"] as const,
    teesheetConfigs: () => ["settings", "teesheetConfigs"] as const,
    teesheetVisibility: (teesheetId: number) =>
      ["settings", "teesheetVisibility", teesheetId] as const,
  },
} as const;
