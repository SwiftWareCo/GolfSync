// Centralized query key factory to ensure consistency and prevent conflicts

export const queryKeys = {
  // Teesheet queries
  teesheets: {
    all: () => ['teesheets'] as const,
    byDate: (date: string) => ['teesheets', 'date', date] as const,
    withPaceOfPlay: (date: string) => ['teesheets', 'date', date, 'paceOfPlay'] as const,
  },

  // Member queries
  members: {
    all: () => ['members'] as const,
    search: (query: string) => ['members', 'search', query] as const,
    byId: (id: number) => ['members', 'byId', id] as const,
  },

  // Guest queries
  guests: {
    all: () => ['guests'] as const,
    search: (query: string) => ['guests', 'search', query] as const,
    byId: (id: number) => ['guests', 'byId', id] as const,
  },

  // Timeblock queries
  timeblocks: {
    all: () => ['timeblocks'] as const,
    byId: (id: number) => ['timeblocks', 'byId', id] as const,
    byDate: (date: string) => ['timeblocks', 'date', date] as const,
  },

  // Pace of play queries
  paceOfPlay: {
    all: () => ['paceOfPlay'] as const,
    byDate: (date: string) => ['paceOfPlay', 'date', date] as const,
  },

  // Restriction queries (timeblock restrictions)
  restrictions: {
    all: () => ['restrictions'] as const,
    check: (params: any) => ['restrictions', 'check', params] as const,
    timeblocks: () => ['restrictions', 'timeblocks'] as const,
    overrides: () => ['restrictions', 'overrides'] as const,
  },

  // Config queries
  configs: {
    all: () => ['configs'] as const,
    teesheet: () => ['configs', 'teesheet'] as const,
  },

  // Lottery queries
  lottery: {
    all: () => ['lottery'] as const,
    settings: () => ['lottery', 'settings'] as const,
  },

  // Weather queries
  weather: {
    all: () => ['weather'] as const,
    current: () => ['weather', 'current'] as const,
  },

  // Settings queries
  settings: {
    all: () => ['settings'] as const,
    courseInfo: () => ['settings', 'courseInfo'] as const,
    teesheetConfigs: () => ['settings', 'teesheetConfigs'] as const,
    teesheetVisibility: (teesheetId: number) => ['settings', 'teesheetVisibility', teesheetId] as const,
  },

  // Member classes queries
  memberClasses: {
    all: () => ['memberClasses'] as const,
    active: () => ['memberClasses', 'active'] as const,
    byId: (id: number) => ['memberClasses', 'byId', id] as const,
  },
} as const;