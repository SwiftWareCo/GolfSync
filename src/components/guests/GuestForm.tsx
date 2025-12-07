"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import { toast } from "react-hot-toast";
import { guestsInsertSchema } from "~/server/db/schema/core/guests.schema";
import { createGuest, updateGuest } from "~/server/guests/actions";
import { z } from "zod";

// Create a form-specific schema that omits auto-generated fields
const guestFormSchema = guestsInsertSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Make email and phone explicitly optional
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
  });

type GuestFormData = z.infer<typeof guestFormSchema>;

// Type for the guest data passed in edit mode
interface GuestData {
  id: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

interface GuestFormProps {
  mode: "create" | "edit";
  guest?: GuestData;
  onSuccess: () => void;
  onCancel: () => void;
}

export function GuestForm({
  mode,
  guest,
  onSuccess,
  onCancel,
}: GuestFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getDefaultValues = (): Partial<GuestFormData> => {
    if (mode === "edit" && guest) {
      return {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email || "",
        phone: guest.phone || "",
      };
    }

    return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    };
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestFormData>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: getDefaultValues(),
  });

  const onSubmit = handleSubmit(async (data: GuestFormData) => {
    setIsSubmitting(true);

    try {
      // Transform empty strings to undefined for optional fields
      const processedData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || undefined,
        phone: data.phone || undefined,
      };

      if (mode === "edit" && guest) {
        const result = await updateGuest(guest.id, processedData);
        if (result.success) {
          toast.success("Guest updated successfully");
          router.refresh();
          onSuccess();
        } else {
          toast.error(result.error || "Failed to update guest");
        }
      } else {
        const result = await createGuest(processedData);
        if (result.success) {
          toast.success("Guest created successfully");
          router.refresh();
          onSuccess();
        } else {
          toast.error(result.error || "Failed to create guest");
        }
      }
    } catch (error) {
      console.error("Error saving guest:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save guest",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* First Name */}
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            placeholder="Enter first name"
            {...register("firstName")}
          />
          {errors.firstName && (
            <span className="text-xs text-red-500">
              {errors.firstName.message}
            </span>
          )}
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            placeholder="Enter last name"
            {...register("lastName")}
          />
          {errors.lastName && (
            <span className="text-xs text-red-500">
              {errors.lastName.message}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter email"
            {...register("email")}
          />
          {errors.email && (
            <span className="text-xs text-red-500">{errors.email.message}</span>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            placeholder="Enter phone number"
            {...register("phone")}
          />
          {errors.phone && (
            <span className="text-xs text-red-500">{errors.phone.message}</span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <LoadingSpinner className="mr-2 h-4 w-4" />
              Saving...
            </>
          ) : mode === "edit" ? (
            "Save Changes"
          ) : (
            "Add Guest"
          )}
        </Button>
      </div>
    </form>
  );
}
