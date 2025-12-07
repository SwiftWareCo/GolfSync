"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { GuestTable } from "./GuestTable";
import { GuestForm } from "./GuestForm";
import { SearchBar } from "~/components/ui/search-bar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { deleteGuest, searchGuestsAction } from "~/server/guests/actions";
import toast from "react-hot-toast";
import { type BaseGuest } from "~/app/types/GuestTypes";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";

interface GuestsHandlerProps {
  initialGuests: BaseGuest[];
}

const ITEMS_PER_PAGE = 6;

export function GuestsHandler({ initialGuests }: GuestsHandlerProps) {
  const [guests, setGuests] = useState<BaseGuest[]>(initialGuests);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<BaseGuest | null>(null);

  // Calculate total pages
  const totalPages = Math.ceil(guests.length / ITEMS_PER_PAGE);

  // Get current page guests
  const getCurrentPageGuests = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return guests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery) {
        const results = await searchGuestsAction(searchQuery);
        setGuests(results);
        setCurrentPage(1);
      } else {
        setGuests(initialGuests);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, initialGuests]);

  const handleDeleteGuest = async () => {
    if (!selectedGuest) return;

    try {
      const result = await deleteGuest(selectedGuest.id);

      if (result.success) {
        setGuests(guests.filter((guest) => guest.id !== selectedGuest.id));
        setIsDeleteDialogOpen(false);
        setSelectedGuest(null);
        toast.success("Guest deleted successfully");
      } else {
        toast.error(result.error || "Failed to delete guest");
      }
    } catch (error) {
      toast.error("An error occurred");
      console.error(error);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setSelectedGuest(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Guests</CardTitle>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Manage guest visitors and their information
              </p>
            </div>
            <Button
              onClick={() => {
                setSelectedGuest(null);
                setIsFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Guest
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search guests by name or email..."
          />

          <GuestTable
            guests={getCurrentPageGuests()}
            onEdit={(guest) => {
              setSelectedGuest(guest);
              setIsFormOpen(true);
            }}
            onDelete={(guest) => {
              setSelectedGuest(guest);
              setIsDeleteDialogOpen(true);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          else setIsFormOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedGuest ? "Edit Guest" : "Add Guest"}
            </DialogTitle>
          </DialogHeader>
          <GuestForm
            mode={selectedGuest ? "edit" : "create"}
            guest={selectedGuest ?? undefined}
            onSuccess={resetForm}
            onCancel={resetForm}
          />
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteGuest}
        title="Delete Guest"
        description="This action cannot be undone and will permanently delete this guest and all associated data."
        itemName={
          selectedGuest
            ? `${selectedGuest.firstName} ${selectedGuest.lastName}`
            : undefined
        }
      />
    </>
  );
}
