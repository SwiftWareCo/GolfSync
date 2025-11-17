"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserButtonComponent from "./UserButton";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";

interface NavItem {
  name: string;
  href: string;
  count?: number;
}

interface NavigationClientProps {
  logoUrl?: string;
  organizationName: string;
  navItems: NavItem[];
}

const NavigationClient = ({
  logoUrl,
  organizationName,
  navItems,
}: NavigationClientProps) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-full bg-org-primary/95 backdrop-blur-sm shadow-xl border border-white/10 pointer-events-auto">
          <div className="flex h-16 items-center justify-between gap-8 px-8">
            {/* Logo */}
            <Link href="/admin" className="flex-shrink-0 transition-transform hover:scale-105">
              {logoUrl ? (
                <div className="relative h-10 w-auto">
                  <Image
                    src={logoUrl}
                    alt={`${organizationName} Logo`}
                    width={140}
                    height={40}
                    className="object-contain"
                    style={{ height: "auto" }}
                    priority
                  />
                </div>
              ) : (
                <div className="bg-white/20 h-10 w-10 rounded-full shadow-sm" />
              )}
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden flex-1 items-center justify-center md:flex">
              <div className="flex space-x-1 rounded-full bg-white/10 p-1.5">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`relative flex items-center whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-200 ${
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
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-full p-2.5 text-white transition-colors hover:bg-white/10 md:hidden"
              >
                <div className="space-y-1.5">
                  <div className={`h-0.5 w-5 bg-current transition-all duration-200 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
                  <div className={`h-0.5 w-5 bg-current transition-all duration-200 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></div>
                  <div className={`h-0.5 w-5 bg-current transition-all duration-200 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
                </div>
              </button>
              <UserButtonComponent />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`absolute inset-x-0 top-full px-4 transform transition-all duration-300 md:hidden ${
          isMobileMenuOpen
            ? "translate-y-2 opacity-100 pointer-events-auto"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl bg-org-primary/95 backdrop-blur-sm border border-white/10 shadow-xl pointer-events-auto">
            <div className="space-y-1 p-6">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
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
