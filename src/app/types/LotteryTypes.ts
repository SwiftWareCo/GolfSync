/**
 * Lottery System Types
 *
 * Simplified lottery system for mobile-first usage
 */

import type { TimeWindow, DynamicTimeWindowInfo } from "~/lib/lottery-utils";

// Re-export TimeWindow for backward compatibility
export type { TimeWindow };

// Backward compatibility: Export a default TIME_WINDOWS for components that still use it
// This will be deprecated in favor of dynamic time windows
export const TIME_WINDOWS: DynamicTimeWindowInfo[] = [
  {
    value: "MORNING",
    label: "Morning",
    description: "Early times",
    timeRange: "7:00 AM - 10:00 AM",
    icon: "☀️",
    startMinutes: 420, // 7:00 AM
    endMinutes: 600, // 10:00 AM
  },
  {
    value: "MIDDAY",
    label: "Midday",
    description: "Mid-day times",
    timeRange: "10:00 AM - 1:00 PM",
    icon: "🌞",
    startMinutes: 600, // 10:00 AM
    endMinutes: 780, // 1:00 PM
  },
  {
    value: "AFTERNOON",
    label: "Afternoon",
    description: "Later times",
    timeRange: "1:00 PM - 4:00 PM",
    icon: "🌤️",
    startMinutes: 780, // 1:00 PM
    endMinutes: 960, // 4:00 PM
  },
  {
    value: "EVENING",
    label: "Evening",
    description: "Latest times",
    timeRange: "4:00 PM - 7:00 PM",
    icon: "🌅",
    startMinutes: 960, // 4:00 PM
    endMinutes: 1140, // 7:00 PM
  },
];

// Entry status
export type LotteryStatus =
  | "PENDING" // Just submitted
  | "PROCESSING" // Being processed by algorithm
  | "ASSIGNED" // Tee time assigned
  | "CANCELLED"; // Cancelled by member

// Individual lottery entry
export interface LotteryEntry {
  id: string;
  memberId: string;
  lotteryDate: string;
  primaryTimeWindow: TimeWindow;
  backupTimeWindow?: TimeWindow;
  memberClass: string;
  status: "PENDING" | "ASSIGNED" | "CANCELLED";
  groupId?: string;
  assignedTimeBlockId?: string;
  submittedAt: Date;
  updatedAt: Date;
}

// Group lottery entry
export interface LotteryGroup {
  id: number;
  organizerId: number;
  lotteryDate: string; // YYYY-MM-DD
  memberIds: number[]; // All members including organizer
  fills?: Array<{ fillType: string; customName?: string }>; // Array of fills
  preferredWindow: TimeWindow;
  alternateWindow?: TimeWindow | null;
  status: LotteryStatus;
  submissionTimestamp: Date;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

// Entry types for database inserts
export interface LotteryEntryInsert {
  memberId: number;
  lotteryDate: string;
  preferredWindow: TimeWindow;
  alternateWindow?: TimeWindow | null;
  status?: LotteryStatus;
  submittedBy?: number | null;
}

export interface LotteryGroupInsert {
  organizerId: number;
  lotteryDate: string;
  memberIds: number[];
  fills?: Array<{ fillType: string; customName?: string }>;
  preferredWindow: TimeWindow;
  alternateWindow?: TimeWindow | null;
  status?: LotteryStatus;
}

// Union type for lottery entry data returned from server
export type LotteryEntryData =
  | {
      type: "individual";
      entry: LotteryEntry;
    }
  | {
      type: "group";
      entry: LotteryGroup;
    }
  | {
      type: "group_member";
      entry: LotteryGroup;
    }
  | null;

// Form data types for submissions
export interface LotteryEntryFormData {
  lotteryDate: string;
  preferredWindow: TimeWindow;
  alternateWindow?: TimeWindow;
  memberIds?: number[]; // For group entries
  fills?: Array<{ fillType: string; customName?: string }>; // For fills
}

// Re-export time window info interface from lottery-utils
export type { DynamicTimeWindowInfo as TimeWindowInfo } from "~/lib/lottery-utils";

export interface LotteryEntryInput {
  lotteryDate: string;
  primaryTimeWindow: TimeWindow;
  backupTimeWindow?: TimeWindow;
  memberClass: string;
}

// ===== SPEED PROFILE TYPES =====

export type SpeedTier = "FAST" | "AVERAGE" | "SLOW";

export interface MemberSpeedProfile {
  id: number;
  memberId: number;
  averageMinutes: number | null;
  speedTier: SpeedTier;
  adminPriorityAdjustment: number; // -25 to +25
  manualOverride: boolean;
  lastCalculated: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface TimeWindowSpeedBonus {
  window: TimeWindow;
  fastBonus: number;
  averageBonus: number;
  slowBonus: number;
}

export interface MemberSpeedProfileView {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  averageMinutes: number | null;
  speedTier: SpeedTier;
  adminPriorityAdjustment: number;
  manualOverride: boolean;
  lastCalculated: Date | null;
  notes: string | null;
}

// Default speed bonuses for time windows
export const DEFAULT_SPEED_BONUSES: TimeWindowSpeedBonus[] = [
  { window: "MORNING", fastBonus: 5, averageBonus: 2, slowBonus: 0 },
  { window: "MIDDAY", fastBonus: 2, averageBonus: 1, slowBonus: 0 },
  { window: "AFTERNOON", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
  { window: "EVENING", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
];

// ===== FAIRNESS SCORE TYPES =====

export interface MemberFairnessScore {
  id: number;
  memberId: number;
  monthlyScore: number;
  lastResetDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

// ===== MEMBER PROFILE TYPES (COMBINED SPEED + FAIRNESS) =====

export interface MemberProfileWithFairness {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  memberClass: string;
  // Speed profile data
  averageMinutes: number | null;
  speedTier: SpeedTier;
  adminPriorityAdjustment: number;
  manualOverride: boolean;
  lastCalculated: Date | null;
  notes: string | null;
  // Fairness score data
  fairnessScore: {
    currentMonth: string;
    totalEntriesMonth: number;
    preferencesGrantedMonth: number;
    preferenceFulfillmentRate: number;
    daysWithoutGoodTime: number;
    fairnessScore: number;
    lastUpdated: Date | null;
  } | null;
}

// ===== ENHANCED LOTTERY PROCESSING TYPES =====

export interface LotteryProcessingMember {
  memberId: number;
  memberName: string;
  memberClass: string;
  fairnessScore: number;
  speedTier: SpeedTier;
  adminPriorityAdjustment: number;
  preferredWindow: TimeWindow;
  alternateWindow?: TimeWindow;
  submissionTime: Date;
  isGroupLeader?: boolean;
  groupId?: number;
  groupSize?: number;
}

export interface LotteryPriorityCalculation {
  memberId: number;
  totalScore: number;
  fairnessScore: number;
  speedBonus: number;
  adminAdjustment: number;
  submissionBonus: number;
  breakdown: {
    fairness: number;
    speed: number;
    admin: number;
    submission: number;
  };
}

export interface LotteryAssignmentResult {
  memberId: number;
  timeBlockId?: number;
  assignedWindow?: TimeWindow;
  preferenceMatched: boolean; // Got preferred window
  specificTimeMatched: boolean; // Got specific time request
  reason: "ASSIGNED" | "NO_SPACE" | "RESTRICTION" | "ERROR";
  alternateAssigned: boolean; // Assigned to alternate window instead
}

// ===== LOTTERY CONFIGURATION TYPES =====

export interface LotteryConfiguration {
  id: number;
  speedBonuses: TimeWindowSpeedBonus[];
  fairnessScoreWeighting: number; // Multiplier for fairness scores
  submissionTimeBonus: number; // Max bonus for early submission
  enableSpeedPriority: boolean;
  enableFairnessSystem: boolean;
  monthlyResetEnabled: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

// ===== LOTTERY STATISTICS TYPES =====

export interface LotteryProcessingStats {
  totalEntries: number;
  totalPlayers: number;
  assignedEntries: number;
  unassignedEntries: number;
  preferenceMatchRate: number; // % who got preferred window
  specificTimeMatchRate: number; // % who got specific time
  fairnessScoreDistribution: {
    min: number;
    max: number;
    average: number;
  };
  speedTierDistribution: {
    fast: number;
    average: number;
    slow: number;
  };
  processingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "ERROR";
  lastProcessedAt?: Date;
}
