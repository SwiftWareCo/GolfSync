import NavigationClient from "~/components/NavigationClient";
import { getPendingChargesCount } from "~/server/charges/data";

export default async function Navigation() {
  // Fetch pending charges count
  const pendingCounts = await getPendingChargesCount();

  const navItems = [
    { name: "Teesheet", href: "/admin" },
    { name: "Members", href: "/admin/members" },
    { name: "Events", href: "/admin/events" },
    {
      name: "Charges",
      href: "/admin/charges",
      count: pendingCounts.total > 0 ? pendingCounts.total : undefined,
    },
    { name: "Settings", href: "/admin/settings" },
  ];

  return (
    <NavigationClient
      logoUrl={"/quilchena_logo.png"}
      organizationName={"Quilchena Golf Club"}
      navItems={navItems}
    />
  );
}
