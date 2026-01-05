import "~/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { Toaster } from "react-hot-toast";
export const metadata: Metadata = {
  title: "GolfSync",
  description:
    "Golf club management system for tracking members, scores, and events",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

import { getPendingChargesCount } from "~/server/charges/data";
import NavigationClient from "~/components/NavigationClient";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pendingCounts = await getPendingChargesCount();

  return (
    <div className={GeistSans.variable}>
      <div className="bg-org-secondary min-h-screen">
        <NavigationClient chargesCount={pendingCounts.total} />
        <main className="container mx-auto px-4 py-8 pt-24">{children}</main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              zIndex: 9999,
            },
          }}
        />
      </div>
    </div>
  );
}
