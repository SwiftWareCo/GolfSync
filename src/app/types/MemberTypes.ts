export interface MemberClass {
  id: number;
  label: string;
  isActive: boolean;
  sortOrder: number;
  isSystemGenerated: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface Member {
  id: number;
  classId: number;
  memberClass?: MemberClass | null;
  memberNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  gender: string | null;
  dateOfBirth: Date | string | null;
  handicap: string | null;
  bagNumber: string | null;
  pushNotificationsEnabled?: boolean;
  pushSubscription?: any;
  createdAt: Date;
  updatedAt: Date | null;
}
