"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamically import the Clerk UserButton with no SSR
const ClerkUserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { ssr: false },
);

export default function UserButtonComponent() {
  return (
    <div className="flex items-center">
      <Suspense fallback={<div className="h-8 w-8 rounded-full bg-gray-200" />}>
        <ClerkUserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
              userButtonPopoverCard: "bg-white shadow-lg rounded-lg",
              userButtonPopoverActionButton: "hover:bg-gray-100",
            },
          }}
        />
      </Suspense>
    </div>
  );
}
