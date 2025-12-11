"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

import { PaceOfPlayCard } from "~/components/pace-of-play/PaceOfPlayCard";
import { PaceOfPlayUpdateModal } from "~/components/pace-of-play/PaceOfPlayUpdateModal";
import { AdminPaceOfPlayModal } from "~/components/pace-of-play/AdminPaceOfPlayModal";
import { type TimeBlockWithPaceOfPlay } from "~/server/pace-of-play/data";

interface TurnPageClientProps {
  initialTimeBlocks: TimeBlockWithPaceOfPlay[];
  isAdmin?: boolean;
}

export function TurnPageClient({
  initialTimeBlocks,
  isAdmin = false,
}: TurnPageClientProps) {
  const { user } = useUser();
  const [selectedTimeBlock, setSelectedTimeBlock] =
    useState<TimeBlockWithPaceOfPlay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const handleUpdateTurn = (timeBlock: TimeBlockWithPaceOfPlay) => {
    setSelectedTimeBlock(timeBlock);
    setIsModalOpen(true);
  };

  const handleAdminUpdateTurn = (timeBlock: TimeBlockWithPaceOfPlay) => {
    setSelectedTimeBlock(timeBlock);
    setIsAdminModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsAdminModalOpen(false);
    setSelectedTimeBlock(null);
  };

  return (
    <div>
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold">
            9th Hole Turn Check-In
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Update the pace of play status for groups that have reached the turn
            (9th hole).
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {initialTimeBlocks.length === 0 ? (
          <div className="py-12 text-center">
            <h3 className="mb-2 text-xl font-bold">No groups at the turn</h3>
            <p className="text-muted-foreground">
              There are currently no groups that need to check in at the turn.
            </p>
          </div>
        ) : (
          initialTimeBlocks.map((timeBlock) => (
            <PaceOfPlayCard
              key={timeBlock.id}
              timeBlock={timeBlock}
              onUpdateTurn={() => handleUpdateTurn(timeBlock)}
              onAdminUpdate={
                isAdmin ? () => handleAdminUpdateTurn(timeBlock) : undefined
              }
              showTurnButton={true}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>

      <PaceOfPlayUpdateModal
        timeBlock={selectedTimeBlock}
        isOpen={isModalOpen}
        onClose={closeModal}
        mode="turn"
        userName={
          user?.fullName || user?.username || (isAdmin ? "Admin" : "Member")
        }
      />

      {/* Admin Enhanced Modal */}
      {isAdmin && (
        <AdminPaceOfPlayModal
          timeBlock={selectedTimeBlock}
          isOpen={isAdminModalOpen}
          onClose={closeModal}
          mode="turn"
          userName={user?.fullName || user?.username || "Admin"}
        />
      )}
    </div>
  );
}
