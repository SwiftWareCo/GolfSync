/**
 * Legacy Lottery Entry Conversion Utility
 * [TESTING ONLY]
 *
 * Converts lottery entries from the legacy app's network response format
 * to the current schema format.
 */

import type { DynamicTimeWindowInfo } from "~/lib/lottery-utils";

// ============================================================================
// Types
// ============================================================================

/** Legacy player format from network response */
export interface LegacyPlayer {
  player_type: string;
  player_id: number;
  first_name: string;
  last_name: string;
}

/** Legacy entry format from network response */
export interface LegacyEntry {
  id: number;
  block_id: number;
  user_id: number;
  earliest_time: string; // "HH:MM"
  latest_time: string; // "HH:MM"
  desired_time: string; // "HH:MM"
  is_cancelled: boolean;
  is_assigned: boolean;
  created_at?: string;
  players: LegacyPlayer[];
}

/** Legacy response wrapper */
export interface LegacyEntriesResponse {
  entries: LegacyEntry[];
}

/** Member reference for matching */
export interface MemberReference {
  id: number;
  firstName: string;
  lastName: string;
}

/** Result of matching a player to a member */
export interface PlayerMatchResult {
  playerId: number;
  originalName: string;
  matchType: "exact" | "fuzzy" | "unmatched";
  memberId?: number;
  matchedName?: string;
  confidence: number;
}

/** Converted entry ready for database */
export interface ConvertedLotteryEntry {
  memberIds: number[];
  organizerId: number;
  lotteryDate: string;
  preferredWindow: "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING";
  alternateWindow: "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING" | null;
  status: "PENDING" | "ASSIGNED" | "CANCELLED";
  submissionTimestamp: Date;
  playerMatches: PlayerMatchResult[];
}

/** Validation result for a batch of conversions */
export interface ConversionValidationResult {
  valid: boolean;
  totalEntries: number;
  convertedEntries: ConvertedLotteryEntry[];
  warnings: string[];
  errors: string[];
  matchStats: {
    exact: number;
    fuzzy: number;
    unmatched: number;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export function parseTimeToMinutes(time: string): number | null {
  if (!time) return null;

  const parts = time.split(":");
  if (parts.length < 2) return null;

  const hours = parseInt(parts[0] || "0", 10);
  const minutes = parseInt(parts[1] || "0", 10);

  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Convert time in minutes to the appropriate time window
 */
export function convertTimeToWindow(
  timeMinutes: number,
  windows: DynamicTimeWindowInfo[],
): "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING" {
  // Find the window that contains this time
  for (const window of windows) {
    if (timeMinutes >= window.startMinutes && timeMinutes < window.endMinutes) {
      return window.value;
    }
  }

  // Fallback: if before all windows, use first; if after, use last
  if (windows.length > 0) {
    const firstWindow = windows[0]!;
    const lastWindow = windows[windows.length - 1]!;

    if (timeMinutes < firstWindow.startMinutes) {
      return firstWindow.value;
    }
    return lastWindow.value;
  }

  // Ultimate fallback
  return "MORNING";
}

/**
 * Normalize a name for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Match a legacy player to a member in the database
 * Returns match result with confidence score
 */
export function matchPlayerToMember(
  player: LegacyPlayer,
  members: MemberReference[],
): PlayerMatchResult {
  const playerFirstName = normalizeName(player.first_name);
  const playerLastName = normalizeName(player.last_name);
  const playerFullName = `${playerFirstName} ${playerLastName}`;

  // Try exact match first
  for (const member of members) {
    const memberFirstName = normalizeName(member.firstName);
    const memberLastName = normalizeName(member.lastName);
    const memberFullName = `${memberFirstName} ${memberLastName}`;

    if (playerFullName === memberFullName) {
      return {
        playerId: player.player_id,
        originalName: `${player.first_name} ${player.last_name}`,
        matchType: "exact",
        memberId: member.id,
        matchedName: `${member.firstName} ${member.lastName}`,
        confidence: 1.0,
      };
    }
  }

  // Try fuzzy matches
  const fuzzyMatches: { member: MemberReference; score: number }[] = [];

  for (const member of members) {
    const memberFirstName = normalizeName(member.firstName);
    const memberLastName = normalizeName(member.lastName);

    let score = 0;

    // First name exact match
    if (playerFirstName === memberFirstName) {
      score += 0.5;
    } else if (
      playerFirstName.startsWith(memberFirstName) ||
      memberFirstName.startsWith(playerFirstName)
    ) {
      score += 0.3;
    }

    // Last name exact match
    if (playerLastName === memberLastName) {
      score += 0.5;
    } else if (
      playerLastName.startsWith(memberLastName) ||
      memberLastName.startsWith(playerLastName)
    ) {
      score += 0.3;
    }

    if (score > 0.3) {
      fuzzyMatches.push({ member, score });
    }
  }

  // Sort by score descending
  fuzzyMatches.sort((a, b) => b.score - a.score);

  if (fuzzyMatches.length > 0 && fuzzyMatches[0]!.score >= 0.5) {
    const bestMatch = fuzzyMatches[0]!;
    return {
      playerId: player.player_id,
      originalName: `${player.first_name} ${player.last_name}`,
      matchType: "fuzzy",
      memberId: bestMatch.member.id,
      matchedName: `${bestMatch.member.firstName} ${bestMatch.member.lastName}`,
      confidence: bestMatch.score,
    };
  }

  // No match found
  return {
    playerId: player.player_id,
    originalName: `${player.first_name} ${player.last_name}`,
    matchType: "unmatched",
    confidence: 0,
  };
}

/**
 * Legacy entries are always imported as "PENDING" regardless of their old status.
 * The legacy is_assigned/is_cancelled flags only indicate status in the OLD system.
 * In the NEW system, entries must be processed through processLotteryForDate()
 * to create actual timeBlockMembers records and appear in the teesheet.
 */

/**
 * Split member IDs into balanced groups with a maximum size
 * Ensures groups are as evenly sized as possible
 *
 * @example
 * splitIntoBalancedGroups([1,2,3,4,5,6,7], 4) => [[1,2,3,4], [5,6,7]]
 * splitIntoBalancedGroups([1,2,3,4,5], 4) => [[1,2,3], [4,5]]
 */
function splitIntoBalancedGroups(memberIds: number[], maxSize: number): number[][] {
  if (memberIds.length <= maxSize) {
    return [memberIds];
  }

  const numGroups = Math.ceil(memberIds.length / maxSize);
  const baseSize = Math.floor(memberIds.length / numGroups);
  const remainder = memberIds.length % numGroups;

  const groups: number[][] = [];
  let currentIndex = 0;

  for (let i = 0; i < numGroups; i++) {
    // First 'remainder' groups get baseSize + 1 members
    const groupSize = i < remainder ? baseSize + 1 : baseSize;
    groups.push(memberIds.slice(currentIndex, currentIndex + groupSize));
    currentIndex += groupSize;
  }

  return groups;
}

/**
 * Convert a single legacy entry to our format
 * Returns an array because entries with >4 players are split into multiple groups
 */
export function convertLegacyEntry(
  entry: LegacyEntry,
  lotteryDate: string,
  members: MemberReference[],
  windows: DynamicTimeWindowInfo[],
): ConvertedLotteryEntry[] | null {
  // Match all players
  const playerMatches = entry.players.map((player) =>
    matchPlayerToMember(player, members),
  );

  // Get member IDs (only from matched players)
  const memberIds = playerMatches
    .filter((match) => match.memberId !== undefined)
    .map((match) => match.memberId!);

  // If no members matched, we can't create the entry
  if (memberIds.length === 0) {
    return null;
  }

  // Convert times to windows (shared across all split groups)
  const desiredMinutes = parseTimeToMinutes(entry.desired_time);
  const earliestMinutes = parseTimeToMinutes(entry.earliest_time);
  const latestMinutes = parseTimeToMinutes(entry.latest_time);

  const preferredWindow = desiredMinutes
    ? convertTimeToWindow(desiredMinutes, windows)
    : earliestMinutes
      ? convertTimeToWindow(earliestMinutes, windows)
      : "MORNING";

  // Determine alternate window (if latest time is in a different window)
  let alternateWindow: "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING" | null =
    null;
  if (latestMinutes) {
    const latestWindow = convertTimeToWindow(latestMinutes, windows);
    if (latestWindow !== preferredWindow) {
      alternateWindow = latestWindow;
    }
  }

  // Always import as PENDING - legacy status flags are ignored
  const status = "PENDING" as const;
  const submissionTimestamp = entry.created_at
    ? new Date(entry.created_at)
    : new Date();

  // Split into groups if more than 4 players
  // Never create INDIVIDUAL entries (min group size is 2)
  if (memberIds.length > 4) {
    const memberGroups = splitIntoBalancedGroups(memberIds, 4);

    return memberGroups.map((groupMemberIds) => {
      // Use first member of this group as organizer (ensures unique organizer per entry)
      const organizerId = groupMemberIds[0]!;

      // Filter player matches to only those in this group
      const groupPlayerMatches = playerMatches.filter(
        (match) => match.memberId && groupMemberIds.includes(match.memberId)
      );

      return {
        memberIds: groupMemberIds,
        organizerId,
        lotteryDate,
        preferredWindow,
        alternateWindow,
        status,
        submissionTimestamp,
        playerMatches: groupPlayerMatches,
      };
    });
  }

  // For 4 or fewer players, create a single entry
  // Find organizer (first matched player or user_id based)
  const organizerMatch = playerMatches.find(
    (m) => m.playerId === entry.user_id,
  );
  const organizerId = organizerMatch?.memberId ?? memberIds[0]!;

  return [
    {
      memberIds,
      organizerId,
      lotteryDate,
      preferredWindow,
      alternateWindow,
      status,
      submissionTimestamp,
      playerMatches,
    },
  ];
}

/**
 * Validate and convert a batch of legacy entries
 */
export function validateAndConvertEntries(
  legacyJson: string,
  lotteryDate: string,
  members: MemberReference[],
  windows: DynamicTimeWindowInfo[],
): ConversionValidationResult {
  const result: ConversionValidationResult = {
    valid: true,
    totalEntries: 0,
    convertedEntries: [],
    warnings: [],
    errors: [],
    matchStats: {
      exact: 0,
      fuzzy: 0,
      unmatched: 0,
    },
  };

  // Parse JSON
  let parsed: LegacyEntriesResponse;
  try {
    parsed = JSON.parse(legacyJson) as LegacyEntriesResponse;
  } catch (e) {
    result.valid = false;
    result.errors.push(
      `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
    return result;
  }

  // Validate structure
  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    result.valid = false;
    result.errors.push('JSON must have an "entries" array');
    return result;
  }

  result.totalEntries = parsed.entries.length;

  // Check for empty windows
  if (windows.length === 0) {
    result.warnings.push(
      "No time windows provided - using default MORNING for all entries",
    );
  }

  // Convert each entry
  for (let i = 0; i < parsed.entries.length; i++) {
    const legacy = parsed.entries[i]!;

    const converted = convertLegacyEntry(legacy, lotteryDate, members, windows);

    if (converted) {
      // convertLegacyEntry now returns an array (could be multiple entries if split)
      result.convertedEntries.push(...converted);

      // Count match types for all entries
      for (const entry of converted) {
        for (const match of entry.playerMatches) {
          if (match.matchType === "exact") result.matchStats.exact++;
          else if (match.matchType === "fuzzy") result.matchStats.fuzzy++;
          else result.matchStats.unmatched++;
        }
      }

      // Add info message if entry was split
      if (converted.length > 1) {
        result.warnings.push(
          `Entry ${i + 1} (ID: ${legacy.id}) with ${legacy.players.length} players was split into ${converted.length} groups`,
        );
      }
    } else {
      result.warnings.push(
        `Entry ${i + 1} (ID: ${legacy.id}) has no matched members - will be skipped`,
      );
    }
  }

  // Add summary warnings
  if (result.matchStats.fuzzy > 0) {
    result.warnings.push(
      `${result.matchStats.fuzzy} player(s) matched with fuzzy matching - please verify`,
    );
  }

  if (result.matchStats.unmatched > 0) {
    result.warnings.push(
      `${result.matchStats.unmatched} player(s) could not be matched to any member`,
    );
  }

  return result;
}
