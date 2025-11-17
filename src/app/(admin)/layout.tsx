import "~/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import Navigation from "~/components/Navigation";

export const metadata: Metadata = {
  title: "GolfSync",
  description:
    "Golf club management system for tracking members, scores, and events",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {


  return (
    <div className={GeistSans.variable}>
      <div className="min-h-screen bg-org-secondary">
        <Navigation/>
        <main className="container mx-auto px-4 py-8 pt-24">{children}</main>
      </div>
    </div>
  );
}
