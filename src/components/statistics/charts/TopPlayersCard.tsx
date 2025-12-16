"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Users } from "lucide-react";

interface TopPlayer {
  memberId: number;
  memberName: string;
  roundsPlayed: number;
}

interface TopPlayersCardProps {
  players: TopPlayer[];
}

export function TopPlayersCard({ players }: TopPlayersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Top Players This Period
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {players.slice(0, 5).map((player, index) => (
            <div
              key={player.memberId}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    index === 0
                      ? "bg-yellow-100 text-yellow-700"
                      : index === 1
                        ? "bg-gray-100 text-gray-600"
                        : index === 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-50 text-gray-500"
                  }`}
                >
                  {index + 1}
                </div>
                <span className="font-medium">{player.memberName}</span>
              </div>
              <div className="text-right">
                <span className="text-org-primary text-lg font-bold">
                  {player.roundsPlayed}
                </span>
                <span className="text-muted-foreground ml-1 text-sm">
                  rounds
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
