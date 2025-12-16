"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserButtonComponent from "./UserButton";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import MobileMenuButton from "./MobileMenuButton";

interface NavigationClientProps {
  chargesCount: number;
}

const NavigationClient = ({ chargesCount }: NavigationClientProps) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const logoUrl = "/quilchena_logo.png";
  const organizationName = "Quilchena Golf Club";
  const homeUrl = "/admin";

  const navItems = [
    { name: "Teesheet", href: `/admin` },
    { name: "Members", href: "/admin/members" },
    { name: "Events", href: "/admin/events" },
    {
      name: "Charges",
      href: "/admin/charges",
      count: chargesCount > 0 ? chargesCount : undefined,
    },
    { name: "Statistics", href: "/admin/statistics" },
    { name: "Proshop Display", href: "/proshop/display" },
    { name: "Settings", href: "/admin/settings" },
  ];

  const isTeesheetActive = pathname.match(/^\/admin\/\d{4}-\d{2}-\d{2}$/);

  return (
    <div className="pointer-events-none fixed top-0 right-0 left-0 z-50 p-4">
      <div className="mx-auto max-w-5xl">
        <div className="bg-org-primary/95 pointer-events-auto rounded-full border border-white/10 shadow-xl backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-8 px-8">
            {/* Logo */}
            <Link
              href={homeUrl}
              className="flex-shrink-0 transition-transform hover:scale-105"
            >
              {logoUrl ? (
                <div className="relative h-7 w-auto sm:h-8 md:h-10">
                  <Image
                    src={logoUrl}
                    alt={`${organizationName} Logo`}
                    width={120}
                    height={35}
                    className="object-contain"
                    style={{ width: "auto", height: "auto" }}
                    priority
                  />
                </div>
              ) : (
                <div className="h-7 w-7 rounded-full bg-white/20 shadow-sm sm:h-8 sm:w-8 md:h-10 md:w-10" />
              )}
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden flex-1 items-center justify-center lg:flex">
              <div className="flex space-x-1 rounded-full bg-white/10 p-1.5">
                {navItems.map((item) => {
                  const isActive =
                    item.name === "Teesheet"
                      ? isTeesheetActive
                      : pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`relative flex items-center rounded-full px-6 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? "bg-white/20 text-white shadow-lg"
                          : "text-white/80 hover:bg-white/15 hover:text-white"
                      }`}
                    >
                      <span>{item.name}</span>
                      {item.count !== undefined && item.count > 0 && (
                        <Badge
                          variant="secondary"
                          className={`ml-2 shrink-0 transition-colors ${
                            isActive
                              ? "bg-white/30 text-white"
                              : "bg-white/20 text-white"
                          }`}
                        >
                          {item.count}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* User Button */}
            <div className="flex items-center gap-4">
              <MobileMenuButton
                isOpen={isMobileMenuOpen}
                onToggle={setIsMobileMenuOpen}
              />
              <UserButtonComponent />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`absolute inset-x-0 top-full transform px-4 transition-all duration-300 lg:hidden ${
          isMobileMenuOpen
            ? "pointer-events-auto translate-y-2 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="mx-auto max-w-5xl">
          <div className="bg-org-primary/95 pointer-events-auto rounded-3xl border border-white/10 shadow-xl backdrop-blur-sm">
            <div className="space-y-1 p-6">
              {navItems.map((item) => {
                const isActive =
                  item.name === "Teesheet"
                    ? isTeesheetActive
                    : pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white/20 text-white shadow-lg"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>{item.name}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <Badge
                        variant="secondary"
                        className={`transition-colors ${
                          isActive
                            ? "bg-white/30 text-white"
                            : "bg-white/20 text-white"
                        }`}
                      >
                        {item.count}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationClient;
