
export type BaseGuest = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

export interface TimeBlockGuest {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  checkedIn?: boolean;
  checkedInAt?: Date | null;
  invitedByMember?: {
    id: number;
    firstName: string;
    lastName: string;
    memberNumber: string;
  };
}

export type GuestFormValues = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};
