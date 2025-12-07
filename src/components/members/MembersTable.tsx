"use client";

import { useState } from "react";
import { Pencil, Trash, History, Activity } from "lucide-react";
import type { Member } from "~/app/types/MemberTypes";
import {
  BaseDataTable,
  type ActionDef,
  type ColumnDef,
} from "~/components/ui/BaseDataTable";
import { getMemberBookingHistoryAction } from "~/server/members/actions";
import { BookingHistoryDialog } from "~/components/booking/BookingHistoryDialog";
import { PaceOfPlayHistoryDialog } from "~/components/pace-of-play/PaceOfPlayHistoryDialog";
import { getMemberPaceOfPlayHistoryAction } from "~/server/pace-of-play/actions";

interface MembersTableProps {
  members: Member[];
  onEdit?: (member: Member) => void;
  onDelete?: (member: Member) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showSearch?: boolean;
  title?: string;
  emptyMessage?: string;
}

export function MembersTable({
  members,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
  showSearch = false,
  emptyMessage = "No members found",
}: MembersTableProps) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [paceOfPlayHistoryDialogOpen, setPaceOfPlayHistoryDialogOpen] =
    useState(false);

  const handleViewHistory = (member: Member) => {
    setSelectedMember(member);
    setHistoryDialogOpen(true);
  };

  const handleViewPaceOfPlayHistory = (member: Member) => {
    setSelectedMember(member);
    setPaceOfPlayHistoryDialogOpen(true);
  };

  const columns: ColumnDef<Member>[] = [
    {
      header: "Member Number",
      accessorKey: "memberNumber",
    },
    {
      header: "Name",
      cell: (member) => `${member.firstName} ${member.lastName}`,
    },
    {
      header: "Class",
      cell: (member) => member.memberClass?.label ?? "—",
    },
    {
      header: "Email",
      accessorKey: "email",
    },
  ];

  const actions: ActionDef<Member>[] = [];

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

  const filterMembers = (member: Member, searchTerm: string) => {
    const term = searchTerm.toLowerCase();
    return (
      `${member.firstName} ${member.lastName}`.toLowerCase().includes(term) ||
      member.email.toLowerCase().includes(term) ||
      member.memberNumber.toLowerCase().includes(term) ||
      (member.memberClass?.label ?? "").toLowerCase().includes(term)
    );
  };

  const fetchMemberHistory = async (year?: number, month?: number) => {
    if (!selectedMember) return [];
    return await getMemberBookingHistoryAction(selectedMember.id, year, month);
  };

  const fetchMemberPaceOfPlayHistory = async () => {
    if (!selectedMember)
      return { success: false, data: [], error: "No member selected" };
    return await getMemberPaceOfPlayHistoryAction(selectedMember.id);
  };

  return (
    <>
      <BaseDataTable
        data={members}
        columns={columns}
        actions={actions}
        showSearch={showSearch}
        searchPlaceholder="Search members..."
        emptyMessage={emptyMessage}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        filterFunction={filterMembers}
      />

      {selectedMember && (
        <>
          <BookingHistoryDialog
            isOpen={historyDialogOpen}
            onClose={() => setHistoryDialogOpen(false)}
            title="Member Booking History"
            fetchHistory={fetchMemberHistory}
            entityName={`${selectedMember.firstName} ${selectedMember.lastName}`}
          />

          <PaceOfPlayHistoryDialog
            isOpen={paceOfPlayHistoryDialogOpen}
            onClose={() => setPaceOfPlayHistoryDialogOpen(false)}
            title="Member Pace of Play History"
            fetchHistory={fetchMemberPaceOfPlayHistory}
            entityName={`${selectedMember.firstName} ${selectedMember.lastName}`}
          />
        </>
      )}
    </>
  );
}
