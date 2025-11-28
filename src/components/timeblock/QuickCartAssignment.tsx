"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { CarIcon } from "lucide-react";

interface Member {
  id: number;
  firstName: string;
  lastName: string;
}

type QuickCartAssignmentData = {
  memberId: number;
  numHoles: 9 | 18;
  isSplit: boolean;
  splitWithMemberId?: number;
  isMedical: boolean;
  staffInitials: string;
  date: Date;
};

interface QuickCartAssignmentProps {
  memberId: number;
  onAssign: (data: QuickCartAssignmentData) => void;
  otherMembers?: Member[];
}

export function QuickCartAssignment({
  memberId,
  onAssign,
  otherMembers = [],
}: QuickCartAssignmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [isMedical, setIsMedical] = useState(false);
  const [numHoles, setNumHoles] = useState<9 | 18>(18);
  const [splitWithMemberId, setSplitWithMemberId] = useState<
    number | undefined
  >(undefined);

  const handleSubmit = () => {
    onAssign({
      memberId,
      numHoles,
      isSplit,
      splitWithMemberId,
      isMedical,
      staffInitials: "",
      date: new Date(),
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 h-5 w-5 p-0 text-gray-500 hover:bg-blue-100 hover:text-blue-600"
        >
          <CarIcon className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Cart Assignment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Holes</Label>
            <div className="col-span-3 flex gap-2">
              <Button
                variant={numHoles === 9 ? "default" : "outline"}
                onClick={() => setNumHoles(9)}
                className="flex-1"
              >
                9 Holes
              </Button>
              <Button
                variant={numHoles === 18 ? "default" : "outline"}
                onClick={() => setNumHoles(18)}
                className="flex-1"
              >
                18 Holes
              </Button>
            </div>
          </div>

          {otherMembers.length > 0 && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Split Cart</Label>
              <Switch
                checked={isSplit}
                onCheckedChange={(checked) => {
                  setIsSplit(checked);
                  if (!checked) setSplitWithMemberId(undefined);
                }}
                className="col-span-3"
              />
            </div>
          )}

          {isSplit && otherMembers.length > 0 && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Split With</Label>
              <div className="col-span-3 flex flex-wrap gap-2">
                {otherMembers.map((member) => (
                  <Button
                    key={member.id}
                    variant={
                      splitWithMemberId === member.id ? "default" : "outline"
                    }
                    onClick={() => setSplitWithMemberId(member.id)}
                    className="text-sm"
                  >
                    {member.firstName} {member.lastName}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Medical</Label>
            <Switch
              checked={isMedical}
              onCheckedChange={setIsMedical}
              className="col-span-3"
            />
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Assign Cart</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
