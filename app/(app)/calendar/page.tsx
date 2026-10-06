import DbError from "@/components/DbError";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { daysUntil, fmtDate, todayISO } from "@/lib/dates";
import { DaysOut, TierBadge } from "@/components/Badges";
import type { Company } from "@/lib/types";

export default async function Calendar({ searchParams }: { searchParams: Promise<{ past?: string }> }) {
  const { past } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("companies").select("*").not("catalyst_date", "is", null);
  if (!past) query = query.gte("catalyst_date", todayISO());
  const { data, error } = await query.order("catalyst_date", { ascending: true });
  if (error) return <DbError message={error.message} />;
  const companies = (data ?? []) as Company[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Catalyst calendar</h1>
        <Link href={past ? "/calendar" : "/calendar?past=1"} className="text-sm text-blue-700">
          {past ? "Hide past catalysts" : "Show past catalysts"}
        </Link>
      </div>
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Date</th>
              <th className="th">Days out</th>
              <th className="th">Company</th>
              <th className="th">Tier</th>
              <th className="th">Catalyst</th>
              <th className="th">Program</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies.length === 0 && (
              <tr><td colSpan={6} className="td py-8 text-center text-gray-500">No catalysts scheduled.</td></tr>
            )}
            {companies.map((c) => {
              const d = daysUntil(c.catalyst_date);
              const soon = d !== null && d >= 0 && d < 30;
              return (
                <tr key={c.id} className={soon ? "bg-red-50" : ""}>
                  <td className={`td whitespace-nowrap ${soon ? "font-semibold text-red-800" : ""}`}>{fmtDate(c.catalyst_date)}</td>
                  <td className="td"><DaysOut date={c.catalyst_date} /></td>
                  <td className="td"><Link href={`/watchlist/${c.id}`} className="font-medium hover:text-blue-700">{c.name}</Link></td>
                  <td className="td"><TierBadge tier={c.tier} /></td>
                  <td className="td">{c.next_catalyst ?? "—"}</td>
                  <td className="td">{c.lead_program ?? "—"} <span className="text-xs text-gray-500">{c.stage ?? ""}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
