"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { UserMinus, Pencil, Trash, History, Activity } from "lucide-react";
import { useState } from "react";
import {
  BaseDataTable,
  type ActionDef,
  type ColumnDef,
} from "~/components/ui/BaseDataTable";
import { type BaseGuest, type TimeBlockGuest } from "~/app/types/GuestTypes";
import { getGuestBookingHistoryAction } from "~/server/guests/actions";
import { BookingHistoryDialog } from "~/components/booking/BookingHistoryDialog";
import { PaceOfPlayHistoryDialog } from "~/components/pace-of-play/PaceOfPlayHistoryDialog";
import { getGuestPaceOfPlayHistoryAction } from "~/server/pace-of-play/actions";

interface GuestTableProps {
  guests: BaseGuest[] | TimeBlockGuest[];
  variant?: "standard" | "timeblock";
  onEdit?: (guest: BaseGuest) => void;
  onDelete?: (guest: BaseGuest) => void;
  onRemove?: (guestId: number) => Promise<void>;
  onViewHistory?: (guest: BaseGuest) => void;
  showSearch?: boolean;
  title?: string;
  emptyMessage?: string;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function GuestTable({
  guests,
  variant = "standard",
  onEdit,
  onDelete,
  onRemove,
  onViewHistory,
  showSearch = false,
  title = "Guests",
  emptyMessage = "No guests found",
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: GuestTableProps) {
  const [selectedGuest, setSelectedGuest] = useState<BaseGuest | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [paceOfPlayHistoryDialogOpen, setPaceOfPlayHistoryDialogOpen] =
    useState(false);

  const handleViewHistory = (guest: BaseGuest) => {
    setSelectedGuest(guest);
    setHistoryDialogOpen(true);
  };

  const handleViewPaceOfPlayHistory = (guest: BaseGuest) => {
    setSelectedGuest(guest);
    setPaceOfPlayHistoryDialogOpen(true);
  };

  const fetchGuestHistory = async (year?: number, month?: number) => {
    if (!selectedGuest) return [];
    return await getGuestBookingHistoryAction(selectedGuest.id, year, month);
  };

  const fetchGuestPaceOfPlayHistory = async () => {
    if (!selectedGuest)
      return { success: false, data: [], error: "No guest selected" };
    return await getGuestPaceOfPlayHistoryAction(selectedGuest.id);
  };

  if (variant === "timeblock") {
    return (
      <>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            {guests.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              <div className="space-y-3">
                {guests.map((item) => {
                  const timeblockGuest = item as TimeBlockGuest;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1">
                        <div>
                          <p className="font-medium">
                            {item.firstName} {item.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item.email || item.phone || "No contact"}
                          </p>
                        </div>
                        {timeblockGuest.invitedByMember && (
                          <div>
                            <p className="font-medium">Invited by</p>
                            <p className="text-sm text-gray-500">
                              {timeblockGuest.invitedByMember.firstName}{" "}
                              {timeblockGuest.invitedByMember.lastName} (
                              {timeblockGuest.invitedByMember.memberNumber})
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistory(item)}
                        >
                          <History className="mr-2 h-4 w-4" />
                          History
                        </Button>
                        {onRemove && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onRemove(item.id)}
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedGuest && (
          <BookingHistoryDialog
            isOpen={historyDialogOpen}
            onClose={() => setHistoryDialogOpen(false)}
            title="Guest Booking History"
            fetchHistory={fetchGuestHistory}
            entityName={`${selectedGuest.firstName} ${selectedGuest.lastName}`}
          />
        )}
      </>
    );
  }

  const columns: ColumnDef<BaseGuest>[] = [
    {
      header: "Name",
      cell: (guest) => `${guest.firstName} ${guest.lastName}`,
    },
    {
      header: "Email",
      cell: (guest) => guest.email || "-",
    },
    {
      header: "Phone",
      cell: (guest) => guest.phone || "-",
    },
  ];

  const actions: ActionDef<BaseGuest>[] = [];

  actions.push({
    label: "Booking History",
    icon: <History className="mr-2 h-4 w-4" />,
    onClick: handleViewHistory,
  });

  actions.push({
    label: "Pace of Play History",
    icon: <Activity className="mr-2 h-4 w-4" />,
    onClick: handleViewPaceOfPlayHistory,
  });

  if (onEdit) {
    actions.push({
      label: "Edit",
      icon: <Pencil className="mr-2 h-4 w-4" />,
      onClick: onEdit,
    });
  }

  if (onDelete) {
    actions.push({
      label: "Delete",
      icon: <Trash className="mr-2 h-4 w-4" />,
      onClick: onDelete,
      className: "text-red-600",
    });
  }

  const filterGuests = (guest: BaseGuest, searchTerm: string) => {
    const term = searchTerm.toLowerCase();
    const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
    const email = (guest.email || "").toLowerCase();
    const phone = (guest.phone || "").toLowerCase();

    return (
      fullName.includes(term) || email.includes(term) || phone.includes(term)
    );
  };

  return (
    <>
      <BaseDataTable
        data={guests}
        columns={columns}
        actions={actions}
        showSearch={showSearch}
        searchPlaceholder="Search guests..."
        emptyMessage={emptyMessage}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        filterFunction={filterGuests}
      />

      {selectedGuest && (
        <>
          <BookingHistoryDialog
            isOpen={historyDialogOpen}
            onClose={() => setHistoryDialogOpen(false)}
            title="Guest Booking History"
            fetchHistory={fetchGuestHistory}
            entityName={`${selectedGuest.firstName} ${selectedGuest.lastName}`}
          />

          <PaceOfPlayHistoryDialog
            isOpen={paceOfPlayHistoryDialogOpen}
            onClose={() => setPaceOfPlayHistoryDialogOpen(false)}
            title="Guest Pace of Play History"
            fetchHistory={fetchGuestPaceOfPlayHistory}
            entityName={`${selectedGuest.firstName} ${selectedGuest.lastName}`}
          />
        </>
      )}
    </>
  );
}
