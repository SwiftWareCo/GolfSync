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

  // Restriction queries
  restrictions: {
    all: () => ['restrictions'] as const,
    check: (params: any) => ['restrictions', 'check', params] as const,
  },

  // Config queries
  configs: {
    all: () => ['configs'] as const,
    teesheet: () => ['configs', 'teesheet'] as const,
  },

  // Template queries
  templates: {
    all: () => ['templates'] as const,
    byId: (id: number) => ['templates', 'byId', id] as const,
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
} as const;