import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { QueryProvider } from "~/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Quilchena Golf Club",
  description: "Quilchena Golf Club",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider telemetry={false}>
      <html lang="en" className={GeistSans.variable}>
        <body>
          <QueryProvider>
            {children}

          </QueryProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
