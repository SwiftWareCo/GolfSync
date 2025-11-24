import { type TimeBlockGuest } from "./GuestTypes";

export const FillTypes = {
  GUEST: "guest_fill",
  RECIPROCAL: "reciprocal_fill",
  CUSTOM: "custom_fill",
} as const;

export type FillType = (typeof FillTypes)[keyof typeof FillTypes];

// New Config Types
export enum ConfigTypes {
  REGULAR = "REGULAR",
  CUSTOM = "CUSTOM",
}

export type ConfigType = (typeof ConfigTypes)[keyof typeof ConfigTypes];

export interface TimeBlockFill {
  id: number;
  timeBlockId: number;
  fillType: FillType;
  customName?: string | null;
  createdAt: Date;
}

export interface TeeSheet {
  id: number;
  date: string;
  configId: number;
  generalNotes?: string | null;
  lotteryEnabled: boolean;
  lotteryDisabledMessage?: string | null;
  isPublic: boolean;
  privateMessage?: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface TimeBlock {
  id: number;
  teesheetId: number;
  startTime: string;
  endTime: string;
  displayName?: string | null; // For custom display ("Hole 1 - 9:00 AM")
  templateId?: number; // Reference to template if using one
  maxMembers: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
  type: ConfigTypes;
  notes?: string | null;
  date?: string;
}

export interface TimeBlockMemberView {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
  class?: string;
  bagNumber?: string | null;
  username: string;
  email: string;
  gender?: string | null;
  dateOfBirth?: Date | string | null;
  handicap?: string | null;
  checkedIn?: boolean;
  checkedInAt?: Date | null;
}

// Database relation types from Drizzle ORM
export interface TimeBlockMemberRelation {
  memberId: number;
  timeBlockId: number;
  bookingDate: string;
  bookingTime: string;
  bagNumber: string | null;
  checkedIn: boolean;
  checkedInAt: Date | null;
  member: TimeBlockMemberView;
}

export interface TimeBlockGuestRelation {
  guestId: number;
  timeBlockId: number;
  checkedIn: boolean;
  checkedInAt: Date | null;
  invitedByMember: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  guest: TimeBlockGuest;
}

export interface TimeBlockWithMembers extends TimeBlock {
  timeBlockMembers?: TimeBlockMemberRelation[];
  timeBlockGuests?: TimeBlockGuestRelation[];
  fills?: TimeBlockFill[];
  // Keep old properties for backwards compatibility
  members?: TimeBlockMemberView[];
  guests?: TimeBlockGuest[];
  notes?: string | null;
  date?: string;
}

// Add new template types
export interface TemplateBlock {
  displayName: string | null;
  startTime: string;
  maxPlayers: number;
}

export interface TimeBlockTemplate {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  displayName: string;
  maxMembers: number;
  sortOrder: number;
  configId: number;
  createdAt?: Date;
  updatedAt?: Date | null;
}

export interface Template {
  id: number;
  name: string;
  type: ConfigTypes;
  // For REGULAR templates
  startTime?: string;
  endTime?: string;
  interval?: number;
  maxMembersPerBlock?: number;
  // For CUSTOM templates
  blocks?: TemplateBlock[];
  createdAt?: Date;
  updatedAt?: Date | null;
}

