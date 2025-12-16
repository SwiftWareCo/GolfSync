import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Activity,
  UserPlus,
  Car,
  Calendar,
  Timer,
  Clock,
  CalendarDays,
  Trophy,
  Users,
  Sun,
  Share2,
} from "lucide-react";
import { PaceOfPlayChart } from "./charts/PaceOfPlayChart";
import { PreferredTeeTimesChart } from "./charts/PreferredTeeTimesChart";
import type { StatisticsData } from "~/lib/statistics/mock-data";

interface MemberStatisticsProps {
  data: StatisticsData;
}

export function MemberStatistics({ data }: MemberStatisticsProps) {
  // Calculate preferred day of week
  const preferredDay =
    data.bookingsByDayOfWeek.length > 0
      ? data.bookingsByDayOfWeek.reduce((prev, current) =>
          prev.count > current.count ? prev : current,
        )
      : null;

  // Calculate most frequent tee time
  const mostFrequentTeeTime =
    data.bookingsBySlot.length > 0
      ? data.bookingsBySlot.reduce((prev, current) =>
          prev.count > current.count ? prev : current,
        )
      : null;

  // Format average round duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Member KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rounds Played</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalRounds}</div>
            <p className="text-muted-foreground text-xs">
              {data.summary.guestRounds > 0
                ? `${data.summary.guestRounds} with guests`
                : "Member rounds"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Round Time
            </CardTitle>
            <Timer className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(data.summary.avgRoundDuration)}
            </div>
            <p className="text-muted-foreground text-xs">18 holes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cart Rentals</CardTitle>
            <Car className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.powerCartRentals}
            </div>
            <p className="text-muted-foreground text-xs">
              {data.summary.totalRounds > 0
                ? `${Math.round(
                    (data.summary.powerCartRentals / data.summary.totalRounds) *
                      100,
                  )}% of rounds`
                : "No rounds"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Events Attended
            </CardTitle>
            <Calendar className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.eventRegistrations}
            </div>
            <p className="text-muted-foreground text-xs">Registrations</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preferred Day</CardTitle>
            <CalendarDays className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {preferredDay ? preferredDay.day : "N/A"}
            </div>
            <p className="text-muted-foreground text-xs">
              {preferredDay
                ? `${preferredDay.count} booking${preferredDay.count !== 1 ? "s" : ""}`
                : "No bookings"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Most Frequent Tee Time
            </CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {mostFrequentTeeTime ? mostFrequentTeeTime.slot : "N/A"}
            </div>
            <p className="text-muted-foreground text-xs">
              {mostFrequentTeeTime
                ? `${mostFrequentTeeTime.count} time${mostFrequentTeeTime.count !== 1 ? "s" : ""}`
                : "No bookings"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Guests Brought
            </CardTitle>
            <UserPlus className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{data.summary.guestRounds}</div>
            <p className="text-muted-foreground text-xs">
              {data.summary.totalRounds > 0
                ? `${Math.round(
                    (data.summary.guestRounds / data.summary.totalRounds) * 100,
                  )}% of rounds`
                : "No rounds"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lottery Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Lottery Entries Created
            </CardTitle>
            <Trophy className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data.summary.lotteryEntriesAsOrganizer}
            </div>
            <p className="text-muted-foreground text-xs">As organizer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Group Entries Joined
            </CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data.summary.lotteryEntriesAsGroupMember}
            </div>
            <p className="text-muted-foreground text-xs">As group member</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Preferred Window
            </CardTitle>
            <Sun className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data.summary.lotteryMostPreferredWindow
                ? data.summary.lotteryMostPreferredWindow.charAt(0) +
                  data.summary.lotteryMostPreferredWindow.slice(1).toLowerCase()
                : "N/A"}
            </div>
            <p className="text-muted-foreground text-xs">
              {data.summary.lotteryMostPreferredWindow
                ? "Most frequent choice"
                : "No entries"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Power Cart Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solo Carts</CardTitle>
            <Car className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data.summary.powerCartSolo}
            </div>
            <p className="text-muted-foreground text-xs">
              {data.summary.powerCartRentals > 0
                ? `${Math.round(
                    (data.summary.powerCartSolo /
                      data.summary.powerCartRentals) *
                      100,
                  )}% of rentals`
                : "No rentals"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Split Carts</CardTitle>
            <Share2 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data.summary.powerCartSplit}
            </div>
            <p className="text-muted-foreground text-xs">
              {data.summary.powerCartRentals > 0
                ? `${Math.round(
                    (data.summary.powerCartSplit /
                      data.summary.powerCartRentals) *
                      100,
                  )}% of rentals`
                : "No rentals"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">9 Holes</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data.summary.powerCart9Holes}
            </div>
            <p className="text-muted-foreground text-xs">
              {data.summary.powerCartRentals > 0
                ? `${Math.round(
                    (data.summary.powerCart9Holes /
                      data.summary.powerCartRentals) *
                      100,
                  )}% of rentals`
                : "No rentals"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">18 Holes</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data.summary.powerCart18Holes}
            </div>
            <p className="text-muted-foreground text-xs">
              {data.summary.powerCartRentals > 0
                ? `${Math.round(
                    (data.summary.powerCart18Holes /
                      data.summary.powerCartRentals) *
                      100,
                  )}% of rentals`
                : "No rentals"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Member Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PaceOfPlayChart data={data.paceOfPlayTrend} />
        <PreferredTeeTimesChart data={data.bookingsBySlot} />
      </div>
    </div>
  );
}
