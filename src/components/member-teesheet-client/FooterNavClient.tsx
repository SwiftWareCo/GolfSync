"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { AccountDialog } from "./AccountDialog";
import { Home, Calendar, User, Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { subscribeUserToPushNotifications } from "~/server/pwa/actions";
import { urlBase64ToUint8Array } from "~/lib/utils";
import { type Member, type MemberClass } from "~/server/db/schema";
import { NotificationBell } from "~/components/notifications/NotificationBell";

type MemberWithClass = Member & { memberClass: MemberClass | null };

interface FooterNavClientProps {
  member?: MemberWithClass;
}

export const FooterNavClient = ({ member }: FooterNavClientProps) => {
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
        const isAlreadyShowing = Array.from(existingToasts).some((toast) =>
          toast.textContent?.includes("Stay updated with course notifications"),
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

  // Auto-resubscription: silently refresh push subscription on app load
  // This handles the case where subscriptions expire server-side
  useEffect(() => {
    const autoResubscribe = async () => {
      // Only run for members with notifications already enabled
      if (!member || !member.pushNotificationsEnabled) return;

      // Check if push is supported
      if (!("serviceWorker" in navigator && "PushManager" in window)) return;

      try {
        // Ensure service worker is registered
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        const registration = await navigator.serviceWorker.ready;

        // Get fresh subscription (will return same if still valid, or new if expired)
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          ),
        });

        // Update the subscription in the database (silently)
        const serializedSubscription = JSON.parse(JSON.stringify(subscription));
        await subscribeUserToPushNotifications(serializedSubscription);

        console.log("Push subscription refreshed successfully");
      } catch (error) {
        console.error("Failed to auto-refresh push subscription:", error);
        // Don't show error to user - this is a silent background operation
      }
    };

    // Run after a short delay to not block initial render
    const timer = setTimeout(autoResubscribe, 2000);
    return () => clearTimeout(timer);
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
        <div className="grid grid-cols-4">
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
          {/* Notification Bell */}
          {member && (
            <div className="flex flex-col items-center justify-center px-2 py-3">
              <NotificationBell memberId={member.id} />
              <span className="mt-1 text-xs font-medium text-gray-600">
                Alerts
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Account Dialog */}
      {member && (
        <AccountDialog
          player={{ member } as any}
          accessFromMember={true}
          isOpen={isAccountDialogOpen}
          onClose={() => setIsAccountDialogOpen(false)}
        />
      )}
    </>
  );
};
