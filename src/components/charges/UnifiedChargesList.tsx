"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { DateRangePicker } from "~/components/ui/date-range-picker";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "react-hot-toast";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";
import { ManualChargeDialog } from "./ManualChargeDialog";
import { formatDate, getBCToday, parseDate } from "~/lib/dates";
import { type DateRange } from "~/app/types/UITypes";
import {
  type PowerCartChargeWithRelations,
  type GeneralChargeWithRelations,
  type ChargeType,
} from "~/app/types/ChargeTypes";
import { type PaymentMethod } from "~/server/db/schema";
import {
  completePowerCartCharge,
  completeGeneralCharge,
  deletePowerCartCharge,
  deleteGeneralCharge,
} from "~/server/charges/actions";
import { addDays } from "date-fns";
import { useDebounce } from "use-debounce";

interface UnifiedChargesListProps {
  initialPowerCartCharges: PowerCartChargeWithRelations[];
  initialPendingPowerCartCharges: PowerCartChargeWithRelations[];
  initialGeneralCharges: GeneralChargeWithRelations[];
  initialPendingGeneralCharges: GeneralChargeWithRelations[];
}

type StatusFilter = "pending" | "completed" | "all";
type TypeFilter = "power-cart" | "general" | "all";

export function UnifiedChargesList({
  initialPowerCartCharges,
  initialPendingPowerCartCharges,
  initialGeneralCharges,
  initialPendingGeneralCharges,
}: UnifiedChargesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFiltering, setIsFiltering] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all",
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    (searchParams.get("type") as TypeFilter) || "all",
  );
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch] = useDebounce(search, 300);

  // Date range - use BC timezone for proper initialization
  const today = getBCToday();
  const thirtyDaysAgo = addDays(parseDate(today), -30);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    return {
      from: startDate ? parseDate(startDate) : thirtyDaysAgo,
      to: endDate ? parseDate(endDate) : parseDate(today),
    };
  });

  // Dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<{
    id: number;
    type: ChargeType;
    name: React.ReactNode;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PaymentMethod.enumValues)[number]>("ACCOUNT");
  const [staffInitials, setStaffInitials] = useState("");

  // Helper to render name
  const renderName = (
    charge: PowerCartChargeWithRelations | GeneralChargeWithRelations,
  ): React.ReactNode => {
    if (charge.member?.firstName && charge.member?.lastName) {
      return (
        <>
          {charge.member.firstName} {charge.member.lastName}
          {charge.member.memberNumber && (
            <>
              {" "}
              (<strong>{charge.member.memberNumber}</strong>)
            </>
          )}
        </>
      );
    }
    if (charge.guest?.firstName && charge.guest?.lastName) {
      return `${charge.guest.firstName} ${charge.guest.lastName} (Guest)`;
    }
    return "-";
  };

  const handleCompleteCharge = async () => {
    if (!selectedCharge || !staffInitials.trim()) return;

    try {
      if (selectedCharge.type === "power-cart") {
        await completePowerCartCharge({
          id: selectedCharge.id,
          staffInitials,
        });
      } else {
        if (!paymentMethod) return;
        await completeGeneralCharge({
          id: selectedCharge.id,
          staffInitials,
          paymentMethod,
        });
      }
      toast.success("Charge completed successfully");
      setCompleteDialogOpen(false);
      setStaffInitials("");
      setPaymentMethod("ACCOUNT");
      setSelectedCharge(null);
      // No router.refresh() needed here as server action revalidates path
    } catch (error) {
      console.error("Error completing charge:", error);
      toast.error("Failed to complete charge");
    }
  };

  const handleDeleteCharge = async () => {
    if (!selectedCharge) return;

    try {
      if (selectedCharge.type === "power-cart") {
        await deletePowerCartCharge(selectedCharge.id);
      } else {
        await deleteGeneralCharge(selectedCharge.id);
      }
      toast.success("Charge deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedCharge(null);
      // No router.refresh() needed here as server action revalidates path
    } catch (error) {
      console.error("Error deleting charge:", error);
      toast.error("Failed to delete charge");
    }
  };

  // Get filtered charges derived from props
  const getDisplayedCharges = useCallback(() => {
    let powerCart: PowerCartChargeWithRelations[] = [];
    let general: GeneralChargeWithRelations[] = [];

    // Filter by Status and Type first
    if (statusFilter === "pending" || statusFilter === "all") {
      if (typeFilter === "power-cart" || typeFilter === "all") {
        powerCart = [...powerCart, ...initialPendingPowerCartCharges];
      }
      if (typeFilter === "general" || typeFilter === "all") {
        general = [...general, ...initialPendingGeneralCharges];
      }
    }

    if (statusFilter === "completed" || statusFilter === "all") {
      if (typeFilter === "power-cart" || typeFilter === "all") {
        powerCart = [...powerCart, ...initialPowerCartCharges];
      }
      if (typeFilter === "general" || typeFilter === "all") {
        general = [...general, ...initialGeneralCharges];
      }
    }

    // Filter by Date Range
    if (dateRange?.from) {
      const fromTime = dateRange.from.getTime();
      const toTime = dateRange.to ? dateRange.to.getTime() : fromTime; // If no end date, use start date (single day) or allow open end? Assuming inclusive range.
      // Usually date pickers set 'to' to end of day or we compare dates.
      // Simply comparing date strings or timestamps.
      // Let's use string comparison for simplicity if format matches, or date objects.

      const isDateInRange = (dateStr: string) => {
        const chargeDate = new Date(dateStr).getTime();
        // Adjust for full day inclusion
        const endOfDay = new Date(toTime);
        endOfDay.setHours(23, 59, 59, 999);

        return chargeDate >= fromTime && chargeDate <= endOfDay.getTime();
      };

      powerCart = powerCart.filter((c) => isDateInRange(c.date));
      general = general.filter((c) => isDateInRange(c.date));
    }

    // Filter by search
    const searchLower = debouncedSearch.toLowerCase().trim();
    if (searchLower) {
      powerCart = powerCart.filter((charge) => {
        const memberName =
          `${charge.member?.firstName || ""} ${charge.member?.lastName || ""}`.toLowerCase();
        const guestName =
          `${charge.guest?.firstName || ""} ${charge.guest?.lastName || ""}`.toLowerCase();
        const memberNumber = charge.member?.memberNumber?.toLowerCase() || "";

        // Split with search
        const splitWithName = charge.splitWithMember
          ? `${charge.splitWithMember.firstName || ""} ${charge.splitWithMember.lastName || ""}`.toLowerCase()
          : "";

        return (
          memberName.includes(searchLower) ||
          guestName.includes(searchLower) ||
          memberNumber.includes(searchLower) ||
          splitWithName.includes(searchLower)
        );
      });

      general = general.filter((charge) => {
        const memberName =
          `${charge.member?.firstName || ""} ${charge.member?.lastName || ""}`.toLowerCase();
        const guestName =
          `${charge.guest?.firstName || ""} ${charge.guest?.lastName || ""}`.toLowerCase();
        const memberNumber = charge.member?.memberNumber?.toLowerCase() || "";
        const chargeType = charge.chargeType?.toLowerCase() || "";
        return (
          memberName.includes(searchLower) ||
          guestName.includes(searchLower) ||
          memberNumber.includes(searchLower) ||
          chargeType.includes(searchLower)
        );
      });
    }

    // Sort by date desc
    powerCart.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    general.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return { powerCart, general };
  }, [
    statusFilter,
    typeFilter,
    debouncedSearch,
    initialPowerCartCharges,
    initialPendingPowerCartCharges,
    initialGeneralCharges,
    initialPendingGeneralCharges,
    dateRange,
  ]);

  const { powerCart: displayedPowerCart, general: displayedGeneral } =
    getDisplayedCharges();

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Header with Add Charge Button */}
        <div className="flex items-center justify-between">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-0 py-0">
            <div className="space-y-1">
              <h3 className="text-2xl leading-none font-semibold tracking-tight">
                Charges
              </h3>
              <p className="text-muted-foreground text-sm">
                View and manage all charges
              </p>
            </div>
          </CardHeader>
          <ManualChargeDialog onSuccess={() => router.refresh()} />
        </div>

        {/* Filters Row */}
        <div className="grid gap-4 md:grid-cols-4">
          {/* Status Filter */}
          <div>
            <Label>Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div>
            <Label>Type</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TypeFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="power-cart">Power Cart</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div>
            <Label>Date Range</Label>
            <DateRangePicker
              dateRange={dateRange}
              setDateRange={setDateRange}
              className="h-10 w-full"
            />
          </div>

          {/* Search */}
          <div>
            <Label>Search</Label>
            <Input
              placeholder="Search charges..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        {/* Loading state */}
        {isFiltering && (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        )}

        {/* Power Cart Charges Table */}
        {(typeFilter === "power-cart" || typeFilter === "all") &&
          displayedPowerCart.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">
                Power Cart Charges ({displayedPowerCart.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Holes</TableHead>
                    <TableHead>Split With</TableHead>
                    <TableHead>Medical</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedPowerCart.map((charge) => (
                    <TableRow key={`pc-${charge.id}`}>
                      <TableCell>
                        {formatDate(charge.date, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{renderName(charge)}</TableCell>
                      <TableCell>{charge.numHoles || 18}</TableCell>
                      <TableCell>
                        {charge.splitWithMember ? (
                          <>
                            {charge.splitWithMember.firstName}{" "}
                            {charge.splitWithMember.lastName}
                            {charge.splitWithMember.memberNumber && (
                              <>
                                {" "}
                                (
                                <strong>
                                  {charge.splitWithMember.memberNumber}
                                </strong>
                                )
                              </>
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{charge.isMedical ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={charge.charged ? "default" : "secondary"}
                        >
                          {charge.charged ? "Completed" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>{charge.staffInitials || "-"}</TableCell>
                      <TableCell>
                        {!charge.charged && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedCharge({
                                    id: charge.id,
                                    type: "power-cart",
                                    name: renderName(charge),
                                  });
                                  setCompleteDialogOpen(true);
                                }}
                              >
                                Complete Charge
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedCharge({
                                    id: charge.id,
                                    type: "power-cart",
                                    name: renderName(charge),
                                  });
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

        {/* General Charges Table */}
        {(typeFilter === "general" || typeFilter === "all") &&
          displayedGeneral.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">
                General Charges ({displayedGeneral.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedGeneral.map((charge) => (
                    <TableRow key={`gc-${charge.id}`}>
                      <TableCell>
                        {formatDate(charge.date, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{renderName(charge)}</TableCell>
                      <TableCell>{charge.chargeType}</TableCell>
                      <TableCell>{charge.paymentMethod || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={charge.charged ? "default" : "secondary"}
                        >
                          {charge.charged ? "Completed" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>{charge.staffInitials || "-"}</TableCell>
                      <TableCell>
                        {!charge.charged && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedCharge({
                                    id: charge.id,
                                    type: "general",
                                    name: renderName(charge),
                                  });
                                  setCompleteDialogOpen(true);
                                }}
                              >
                                Complete Charge
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedCharge({
                                    id: charge.id,
                                    type: "general",
                                    name: renderName(charge),
                                  });
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

        {/* Empty state */}
        {displayedPowerCart.length === 0 && displayedGeneral.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            No charges found matching your filters
          </div>
        )}

        {/* Complete Charge Dialog */}
        <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Charge</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="staffInitials">Staff Initials</Label>
                <Input
                  id="staffInitials"
                  value={staffInitials}
                  onChange={(e) => setStaffInitials(e.target.value)}
                  placeholder="Enter staff initials"
                  maxLength={10}
                  className="uppercase"
                  autoFocus
                />
              </div>
              {selectedCharge?.type === "general" && (
                <div className="grid gap-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) =>
                      setPaymentMethod(
                        value as (typeof PaymentMethod.enumValues)[number],
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACCOUNT">Account</SelectItem>
                      <SelectItem value="VISA">Visa</SelectItem>
                      <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                      <SelectItem value="DEBIT">Debit</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCompleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompleteCharge}
                disabled={
                  !staffInitials.trim() ||
                  (selectedCharge?.type === "general" && !paymentMethod)
                }
              >
                Complete Charge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteCharge}
          title="Delete Charge"
          description="This action cannot be undone and will permanently delete this charge."
          itemName={selectedCharge?.name}
        />
      </CardContent>
    </Card>
  );
}
