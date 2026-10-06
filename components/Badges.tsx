import { daysUntil } from "@/lib/dates";

export function TierBadge({ tier }: { tier: number | null }) {
  if (!tier) return <span className="text-gray-400">—</span>;
  const cls = tier === 1 ? "bg-blue-100 text-blue-800" : tier === 2 ? "bg-gray-200 text-gray-800" : "bg-gray-100 text-gray-500";
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>T{tier}</span>;
}

export function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return <span className="text-gray-400">—</span>;
  const cls = decision === "Buy" ? "bg-emerald-100 text-emerald-800" : decision === "Pass" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{decision}</span>;
}

export function DaysOut({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <span className="text-gray-400">—</span>;
  const cls = d < 0 ? "text-gray-400" : d < 30 ? "font-semibold text-red-700" : "text-gray-700";
  return <span className={cls}>{d < 0 ? `${-d}d ago` : d === 0 ? "today" : `${d}d`}</span>;
}
