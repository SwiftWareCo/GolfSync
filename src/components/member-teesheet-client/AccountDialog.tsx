import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { type Member, type MemberClass, type Guest } from "~/server/db/schema";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Trophy,
  CreditCard,
  UserCircle,
  Hash,
  Users,
  LogOut,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { NotificationPreferences } from "./NotificationPreferences";

// Full TimeBlockMember with nested member relation
type TimeBlockMemberFull = {
  id: number;
  timeBlockId: number;
  memberId: number;
  checkedIn: boolean;
  bookingDate: string;
  bookingTime: string;
  bagNumber: string | null;
  createdAt: Date;
  member: Member & { memberClass: MemberClass | null };
};

// Full TimeBlockGuest with nested guest and invitedByMember relations
type TimeBlockGuestFull = {
  id: number;
  timeBlockId: number;
  guestId: number;
  invitedByMemberId: number;
  checkedIn: boolean;
  bookingDate: string;
  bookingTime: string;
  createdAt: Date;
  guest: Guest;
  invitedByMember: Member;
};

type AccountData = TimeBlockMemberFull | TimeBlockGuestFull;

interface AccountDialogProps {
  player: AccountData;
  isOpen: boolean;
  onClose: () => void;
  accessFromMember?: boolean;
}

// Type guard functions
const isMember = (data: AccountData): data is TimeBlockMemberFull => {
  return "member" in data && data.member !== undefined;
};

const isGuest = (data: AccountData): data is TimeBlockGuestFull => {
  return "guest" in data && data.guest !== undefined;
};

export function AccountDialog({
  player,
  isOpen,
  onClose,
  accessFromMember,
}: AccountDialogProps) {
  const { signOut } = useClerk();

  const handleSignOut = () => {
    signOut(() => {
      window.location.href = "/";
    });
  };

  const isGuestAccount = isGuest(player);
  const isMemberAccount = isMember(player);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm sm:max-w-lg">
        <DialogHeader className="space-y-2 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            {isGuestAccount ? (
              <Users className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5" />
            ) : (
              <UserCircle className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
            )}
            {isGuestAccount ? "Guest Information" : "Member Account"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto">
          {/* Main Info Card */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-3 pb-3">
              <div className="space-y-3">
                {/* Name */}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 flex-shrink-0 text-gray-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-600">Name</p>
                    <p className="truncate text-sm font-semibold sm:text-base">
                      {isMemberAccount
                        ? `${player.member.firstName} ${player.member.lastName}`
                        : `${player.guest.firstName} ${player.guest.lastName}`}
                    </p>
                  </div>
                </div>

                {/* Member-specific fields */}
                {isMemberAccount && (
                  <>
                    {/* Username */}
                    {player.member.username && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Username
                          </p>
                          <p className="truncate text-sm font-medium">
                            {player.member.username}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Email */}
                    {player.member.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Email
                          </p>
                          <p className="truncate text-sm font-medium">
                            {player.member.email}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Member Number */}
                    {player.member.memberNumber && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Member #
                          </p>
                          <p className="text-sm font-medium">
                            {player.member.memberNumber}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Member Class */}
                    {player.member.memberClass && (
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Member Class
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {player.member.memberClass.label}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Gender */}
                    {player.member.gender && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Gender
                          </p>
                          <p className="text-sm font-medium">
                            {player.member.gender}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Date of Birth */}
                    {player.member.dateOfBirth && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Date of Birth
                          </p>
                          <p className="text-sm font-medium">
                            {new Date(
                              player.member.dateOfBirth,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Handicap */}
                    {player.member.handicap && (
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Handicap
                          </p>
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {player.member.handicap}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Bag Number */}
                    {player.member.bagNumber && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Bag #
                          </p>
                          <p className="text-sm font-medium">
                            {player.member.bagNumber}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Guest-specific fields */}
                {isGuestAccount && (
                  <>
                    {/* Email */}
                    {player.guest.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Email
                          </p>
                          <p className="truncate text-sm font-medium">
                            {player.guest.email}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Phone */}
                    {player.guest.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Phone
                          </p>
                          <p className="text-sm font-medium">
                            {player.guest.phone}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Invited By */}
                    {player.invitedByMember && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-600">
                            Invited By
                          </p>
                          <p className="text-sm font-medium">
                            {player.invitedByMember.firstName}{" "}
                            {player.invitedByMember.lastName}
                            <span className="ml-1 text-xs text-gray-500">
                              (#{player.invitedByMember.memberNumber})
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences - Only for players */}
          {isMemberAccount && accessFromMember && <NotificationPreferences />}

          {/* Action Buttons */}
          <div className="sticky bottom-0 flex justify-between bg-white pt-2">
            <div className="flex gap-2">
              {/* Sign Out Button - Only for players */}
              {isMemberAccount && accessFromMember && (
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              )}
            </div>
            <Button variant="ghost" onClick={onClose} className="px-6 text-sm">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
