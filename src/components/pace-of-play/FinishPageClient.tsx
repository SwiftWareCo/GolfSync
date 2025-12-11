"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { PaceOfPlayCard } from "~/components/pace-of-play/PaceOfPlayCard";
import { PaceOfPlayUpdateModal } from "~/components/pace-of-play/PaceOfPlayUpdateModal";
import { CombinedTurnFinishModal } from "~/components/pace-of-play/CombinedTurnFinishModal";
import { AdminPaceOfPlayModal } from "~/components/pace-of-play/AdminPaceOfPlayModal";
import { type TimeBlockWithPaceOfPlay } from "~/server/pace-of-play/data";
import { formatTime12Hour } from "~/lib/dates";

interface FinishPageClientProps {
  initialTimeBlocks:
    | TimeBlockWithPaceOfPlay[]
    | {
        regular: TimeBlockWithPaceOfPlay[];
        missedTurns: TimeBlockWithPaceOfPlay[];
      };
  isAdmin?: boolean;
}

export function FinishPageClient({
  initialTimeBlocks,
  isAdmin = false,
}: FinishPageClientProps) {
  const { user } = useUser();

  // Handle both data structures - simple array for members, object for admins
  const timeBlocks = Array.isArray(initialTimeBlocks)
    ? { regular: initialTimeBlocks, missedTurns: [] }
    : initialTimeBlocks;

  const [selectedTimeBlock, setSelectedTimeBlock] =
    useState<TimeBlockWithPaceOfPlay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCombinedModalOpen, setIsCombinedModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminModalMode, setAdminModalMode] = useState<
    "turn" | "finish" | "both"
  >("finish");

  const handleUpdateFinish = (timeBlock: TimeBlockWithPaceOfPlay) => {
    setSelectedTimeBlock(timeBlock);
    setIsModalOpen(true);
  };

  const handleCombinedUpdate = (timeBlock: TimeBlockWithPaceOfPlay) => {
    setSelectedTimeBlock(timeBlock);
    setIsCombinedModalOpen(true);
  };

  const handleAdminUpdate = (
    timeBlock: TimeBlockWithPaceOfPlay,
    mode: "turn" | "finish" | "both",
  ) => {
    setSelectedTimeBlock(timeBlock);
    setAdminModalMode(mode);
    setIsAdminModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsCombinedModalOpen(false);
    setIsAdminModalOpen(false);
    setSelectedTimeBlock(null);
  };

  return (
    <div>
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold">
            18th Hole Finish Check-In
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Update the pace of play status for groups that have completed their
            round.
          </p>
        </CardContent>
      </Card>

      {/* Two-column layout: Main content + Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left Column: Regular Finish Groups */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">
            Groups Ready for Finish
          </h2>
          <div className="space-y-4">
            {timeBlocks.regular.length === 0 ? (
              <div className="py-8 text-center">
                <h3 className="mb-2 text-xl font-bold">
                  No groups ready for finish
                </h3>
                <p className="text-muted-foreground">
                  There are currently no groups that have recorded their turn
                  time and need to check in at the finish.
                </p>
              </div>
            ) : (
              timeBlocks.regular.map((timeBlock) => (
                <PaceOfPlayCard
                  key={timeBlock.id}
                  timeBlock={timeBlock}
                  onUpdateFinish={() => handleUpdateFinish(timeBlock)}
                  onAdminUpdate={
                    isAdmin
                      ? () => handleAdminUpdate(timeBlock, "finish")
                      : undefined
                  }
                  showFinishButton={true}
                  isAdmin={isAdmin}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: Sticky Sidebar (Admin Controls & Missed Turns) */}
        {(isAdmin || timeBlocks.missedTurns.length > 0) && (
          <div className="lg:sticky lg:top-4 lg:h-fit">
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <ShieldAlert className="h-5 w-5" />
                  {isAdmin
                    ? "Advanced Controls & Missed Turns"
                    : "Groups Missing Turn Time"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-amber-700">
                  {isAdmin
                    ? "As an administrator, you can manually set times, handle missed turns, and override pace of play records."
                    : "This section allows administrators to handle exceptional cases where groups missed recording their turn time."}
                </p>
                <div className="space-y-3">
                  {timeBlocks.missedTurns.length === 0 ? (
                    <div className="rounded-lg bg-white p-4 text-center">
                      <p className="text-sm text-gray-600">
                        No groups with missed turns
                      </p>
                    </div>
                  ) : (
                    timeBlocks.missedTurns.map((timeBlock) => (
                      <div
                        key={timeBlock.id}
                        className="space-y-2 rounded-lg bg-white p-3"
                      >
                        {/* Miniaturized group info */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {formatTime12Hour(timeBlock.startTime)} Group
                            </p>
                            <p className="text-xs text-gray-600">
                              {timeBlock.players && timeBlock.players.length > 0
                                ? timeBlock.players
                                    .map((p) => p.name)
                                    .join(", ")
                                : "No players"}{" "}
                              ({timeBlock.numPlayers})
                            </p>
                          </div>
                        </div>

                        {/* Admin action buttons */}
                        {isAdmin && (
                          <div className="grid grid-cols-1 gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleAdminUpdate(timeBlock, "turn")
                              }
                              className="h-8 border-amber-300 text-xs text-amber-600 hover:bg-amber-50"
                            >
                              Set Turn Time
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleAdminUpdate(timeBlock, "finish")
                              }
                              className="h-8 border-green-300 text-xs text-green-600 hover:bg-green-50"
                            >
                              Set Finish Time
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleAdminUpdate(timeBlock, "both")
                              }
                              className="h-8 border-blue-300 text-xs text-blue-600 hover:bg-blue-50"
                            >
                              Set Both Times
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Regular Finish Modal */}
      <PaceOfPlayUpdateModal
        timeBlock={selectedTimeBlock}
        isOpen={isModalOpen}
        onClose={closeModal}
        mode="finish"
        userName={
          user?.fullName || user?.username || (isAdmin ? "Admin" : "Member")
        }
      />

      {/* Combined Turn & Finish Modal */}
      <CombinedTurnFinishModal
        timeBlock={selectedTimeBlock}
        isOpen={isCombinedModalOpen}
        onClose={closeModal}
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
          mode={adminModalMode}
          userName={user?.fullName || user?.username || "Admin"}
        />
      )}
    </div>
  );
}
