import { type Metadata } from "next";
import { PageHeader } from "~/components/ui/page-header";
import { UnifiedChargesList } from "~/components/charges/UnifiedChargesList";
import {
  getPendingPowerCartCharges,
  getPendingGeneralCharges,
  getFilteredCharges,
} from "~/server/charges/data";
import { addDays } from "date-fns";
import { getBCToday, formatDateToYYYYMMDD } from "~/lib/dates";

export const metadata: Metadata = {
  title: "Charges Dashboard",
};

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    search?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function ChargesDashboard({ searchParams }: PageProps) {
  // Await search params
  const params = await searchParams;

  const today = getBCToday();
  const thirtyDaysAgo = formatDateToYYYYMMDD(addDays(new Date(today), -30));

  // Parse search params for completed charges
  const filters = {
    startDate: params.startDate || thirtyDaysAgo,
    endDate: params.endDate || today,
    search: params.search,
    chargeType: params.type,
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 50,
  };

  // Fetch all data in parallel
  const [powerCartCharges, generalCharges, chargeHistory] = await Promise.all([
    getPendingPowerCartCharges(),
    getPendingGeneralCharges(),
    getFilteredCharges(filters),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Charges Dashboard"
        description="Manage power cart and general charges"
      />

      <UnifiedChargesList
        initialPendingPowerCartCharges={powerCartCharges}
        initialPendingGeneralCharges={generalCharges}
        initialPowerCartCharges={chargeHistory.powerCartCharges}
        initialGeneralCharges={chargeHistory.generalCharges}
      />
    </div>
  );
}
