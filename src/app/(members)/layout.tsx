import { Inter } from "next/font/google";
import "~/styles/globals.css";
import { FooterNav } from "../../components/member-teesheet-client/FooterNav";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "GolfSync - Member Portal",
  description: "Book tee times and manage your golf membership",
};

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <div className={`flex min-h-screen flex-col ${inter.className}`}>
        <FooterNav />
        <main className="container mx-auto flex-1 p-4 pb-20">{children}</main>
          <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  zIndex: 9999,
                },
              }}
            />
      </div>
    </ClerkProvider>
  );
}
