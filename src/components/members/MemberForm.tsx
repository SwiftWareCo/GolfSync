"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SingleSelect } from "~/components/ui/single-select";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import { toast } from "react-hot-toast";
import type { MemberClass } from "~/server/db/schema";
import { membersInsertSchema } from "~/server/db/schema/core/members.schema";
import { createMember, updateMember } from "~/server/members/actions";
import { z } from "zod";

// Create a form-specific schema that omits auto-generated fields
const memberFormSchema = membersInsertSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    pushNotificationsEnabled: true,
    pushSubscription: true,
  })
  .extend({
    // Make optional fields explicitly optional with proper transforms
    gender: z.string().nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    handicap: z.string().nullable().optional(),
    bagNumber: z.string().nullable().optional(),
  });

type MemberFormData = z.infer<typeof memberFormSchema>;

// Type for the member data passed in edit mode
interface MemberData {
  id: number;
  classId: number;
  memberNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  gender?: string | null;
  dateOfBirth?: string | Date | null;
  handicap?: string | null;
  bagNumber?: string | null;
}

interface MemberFormProps {
  mode: "create" | "edit";
  member?: MemberData;
  memberClasses: MemberClass[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function MemberForm({
  mode,
  member,
  memberClasses,
  onSuccess,
  onCancel,
}: MemberFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getDefaultValues = (): Partial<MemberFormData> => {
    if (mode === "edit" && member) {
      return {
        classId: member.classId,
        memberNumber: member.memberNumber,
        firstName: member.firstName,
        lastName: member.lastName,
        username: member.username,
        email: member.email,
        gender: member.gender || "",
        dateOfBirth: member.dateOfBirth
          ? typeof member.dateOfBirth === "string"
            ? member.dateOfBirth
            : member.dateOfBirth.toISOString().split("T")[0]
          : "",
        handicap: member.handicap || "",
        bagNumber: member.bagNumber || "",
      };
    }

    return {
      classId: undefined,
      memberNumber: "",
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      gender: "",
      dateOfBirth: "",
      handicap: "",
      bagNumber: "",
    };
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: getDefaultValues(),
  });

  const selectedClassId = watch("classId");

  const onSubmit = handleSubmit(async (data: MemberFormData) => {
    setIsSubmitting(true);

    try {
      // Transform empty strings to null for optional fields
      const processedData = {
        memberNumber: data.memberNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        email: data.email,
        classId: data.classId,
        gender: data.gender || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        handicap: data.handicap || undefined,
        bagNumber: data.bagNumber || undefined,
      };

      if (mode === "edit" && member) {
        await updateMember(member.id, processedData);
        toast.success("Member updated successfully");
      } else {
        await createMember(processedData);
        toast.success("Member created successfully");
      }

      router.refresh();
      onSuccess();
    } catch (error) {
      console.error("Error saving member:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save member",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Member Number */}
        <div className="space-y-2">
          <Label htmlFor="memberNumber">Member Number</Label>
          <Input
            id="memberNumber"
            placeholder="Enter member number"
            {...register("memberNumber")}
          />
          {errors.memberNumber && (
            <span className="text-xs text-red-500">
              {errors.memberNumber.message}
            </span>
          )}
        </div>

        {/* Member Class */}
        <div className="space-y-2">
          <Label htmlFor="classId">Member Class</Label>
          <SingleSelect
            options={memberClasses.map((mc) => ({
              label: mc.label,
              value: mc.id.toString(),
            }))}
            value={selectedClassId?.toString()}
            onChange={(value) => setValue("classId", parseInt(value))}
            placeholder="Select member class"
            searchPlaceholder="Search classes..."
          />
          {errors.classId && (
            <span className="text-xs text-red-500">
              {errors.classId.message}
            </span>
          )}
        </div>
      </div>

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
        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="Enter username"
            {...register("username")}
          />
          {errors.username && (
            <span className="text-xs text-red-500">
              {errors.username.message}
            </span>
          )}
        </div>

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
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Gender */}
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={watch("gender") || ""}
            onValueChange={(value) => setValue("gender", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Male</SelectItem>
              <SelectItem value="F">Female</SelectItem>
              <SelectItem value="O">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth</Label>
          <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
        </div>

        {/* Handicap */}
        <div className="space-y-2">
          <Label htmlFor="handicap">Handicap</Label>
          <Input
            id="handicap"
            placeholder="Enter handicap"
            {...register("handicap")}
          />
        </div>
      </div>

      {/* Bag Number */}
      <div className="space-y-2">
        <Label htmlFor="bagNumber">Bag Number</Label>
        <Input
          id="bagNumber"
          placeholder="Enter bag number"
          {...register("bagNumber")}
        />
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
            "Add Member"
          )}
        </Button>
      </div>
    </form>
  );
}
