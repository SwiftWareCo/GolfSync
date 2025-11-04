"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { AccountDialog } from "./AccountDialog";
import { Home, Calendar, User, Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import toast from "react-hot-toast";
import { subscribeUserToPushNotifications } from "~/server/pwa/actions";
import { urlBase64ToUint8Array } from "~/lib/utils";

interface FooterNavClientProps {
  member?: any;
  isMember?: boolean;
}

export const FooterNavClient = ({ member, isMember }: FooterNavClientProps) => {
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const pathname = usePathname();

  // Hide footer navigation on pace of play routes
  const isPaceOfPlayRoute = pathname.includes("/pace-of-play");

  // Don't render footer on pace of play routes
  if (isPaceOfPlayRoute) {
    return null;
  }

  // Show notification toast if push notifications are disabled
  useEffect(() => {
    if (member && member.pushNotificationsEnabled === false) {
      const showToast = () => {
        // Use a unique ID to prevent duplicate toasts
        const toastId = "push-notification-prompt";
        
        // Check if this toast is already showing
        const existingToasts = document.querySelectorAll('[role="status"]');
        const isAlreadyShowing = Array.from(existingToasts).some(
          (toast) => toast.textContent?.includes("Stay updated with course notifications")
        );
        
        if (isAlreadyShowing) {
          return;
        }

        toast(
          (t) => (
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center">
                <Bell className="text-org-primary mr-2 h-4 w-4" />
                <span className="text-sm font-medium">
                  Stay updated with course notifications!
                </span>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      // Check if push notifications are supported
                      if (
                        !(
                          "serviceWorker" in navigator &&
                          "PushManager" in window
                        )
                      ) {
                        toast.error("Push notifications not supported");
                        return;
                      }

                      // Request permission
                      const permission = await Notification.requestPermission();
                      if (permission !== "granted") {
                        toast.error(
                          "Please allow notifications in your browser",
                        );
                        return;
                      }

                      // Register service worker
                      await navigator.serviceWorker.register("/sw.js", {
                        scope: "/",
                        updateViaCache: "none",
                      });

                      // Wait for service worker to be ready
                      const registration = await navigator.serviceWorker.ready;

                      // Subscribe to push notifications
                      const subscription =
                        await registration.pushManager.subscribe({
                          userVisibleOnly: true,
                          applicationServerKey: urlBase64ToUint8Array(
                            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
                          ),
                        });

                      // Save subscription to database
                      const serializedSubscription = JSON.parse(
                        JSON.stringify(subscription),
                      );
                      const result = await subscribeUserToPushNotifications(
                        serializedSubscription,
                      );

                      if (result.success) {
                        toast.success("Notifications enabled!");
                        toast.dismiss(t.id);
                      } else {
                        toast.error("Failed to enable notifications");
                      }
                    } catch (error) {
                      console.error("Error enabling notifications:", error);
                      toast.error("Failed to enable notifications");
                    }
                  }}
                  className="bg-org-primary hover:bg-org-primary/90 rounded-md px-3 py-1 text-xs text-white transition-colors"
                >
                  Enable
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
          ),
          {
            id: toastId, // Use unique ID to prevent duplicates
            duration: Infinity, // Keep open until user interacts
            position: "top-center",
            style: {
              background: "#fff",
              color: "#333",
              border: "1px solid #e3e3e3",
              borderRadius: "8px",
              padding: "12px 16px",
              maxWidth: "400px",
            },
          },
        );
      };

      // Show toast after a short delay to ensure component is mounted
      const timer = setTimeout(showToast, 1000);
      return () => clearTimeout(timer);
    }
  }, [member]);

  const isActive = (path: string) => {
    if (path === "/members" && pathname === "/members") {
      return true;
    }
    if (path !== "/members" && pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  const navItems = [
    {
      href: "/members",
      icon: Home,
      label: "Portal",
      isActive: isActive("/members"),
    },
    {
      href: "/members/teesheet",
      icon: Calendar,
      label: "Tee Sheet",
      isActive: isActive("/members/teesheet"),
    },
    {
      onClick: () => setIsAccountDialogOpen(true),
      icon: User,
      label: "Account",
      isActive: false,
    },
  ];

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="pb-safe fixed right-0 bottom-0 left-0 z-50 border-t border-gray-200 bg-white shadow-lg">
        <div className="grid grid-cols-3">
          {navItems.map((item, index) => (
            <div key={index}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={`flex flex-col items-center justify-center px-2 py-3 text-xs transition-colors ${
                    item.isActive
                      ? "text-org-primary"
                      : "hover:text-org-primary text-gray-600"
                  }`}
                >
                  <item.icon
                    size={20}
                    className={
                      item.isActive ? "text-org-primary" : "text-gray-600"
                    }
                  />
                  <span className="mt-1 font-medium">{item.label}</span>
                </Link>
              ) : (
                <button
                  onClick={item.onClick}
                  className="hover:text-org-primary flex w-full flex-col items-center justify-center px-2 py-3 text-xs text-gray-600 transition-colors"
                >
                  <item.icon size={20} className="text-gray-600" />
                  <span className="mt-1 font-medium">{item.label}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Account Dialog */}
      <AccountDialog
        member={member}
        isOpen={isAccountDialogOpen}
        onClose={() => setIsAccountDialogOpen(false)}
        isMember={isMember ?? false}
      />
    </>
  );
};
