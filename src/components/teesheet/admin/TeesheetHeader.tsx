import { formatDate } from "~/lib/dates";

interface TeesheetHeaderProps {
  date: Date;
  dateString: string;
}

export function TeesheetHeader({
  date,
  dateString,
}: TeesheetHeaderProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{formatDate(date)}</h1>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Date</p>
        <p className="text-xl font-semibold text-gray-900">{dateString}</p>
      </div>
    </div>
  );
}
