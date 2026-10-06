import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, fmtDate, todayISO } from "@/lib/dates";
import { DaysOut, TierBadge } from "@/components/Badges";
import type { Company } from "@/lib/types";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("*");
  if (error) throw new Error(error.message);
  const companies = (data ?? []) as Company[];

  const today = todayISO();
  const in90 = addDaysISO(90);
  const in30 = addDaysISO(30);
  const in60 = addDaysISO(60);
  const upcoming = companies
    .filter((c) => c.catalyst_date && c.catalyst_date >= today && c.catalyst_date <= in90)
    .sort((a, b) => a.catalyst_date!.localeCompare(b.catalyst_date!));

  const byTier = [1, 2, 3].map((t) => companies.filter((c) => c.tier === t).length);
  const scored = companies.filter((c) => c.score != null);
  const avgScore = scored.length ? (scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length).toFixed(1) : "—";
  const staleCutoff = addDaysISO(-90);
  const stale = companies.filter((c) => !c.last_reviewed || c.last_reviewed < staleCutoff).length;
  const shortRunway = companies.filter((c) => c.cash_runway_months != null && c.cash_runway_months < 12).length;

  const buckets = [
    { label: "Next 30 days", items: upcoming.filter((c) => c.catalyst_date! <= in30) },
    { label: "31–60 days", items: upcoming.filter((c) => c.catalyst_date! > in30 && c.catalyst_date! <= in60) },
    { label: "61–90 days", items: upcoming.filter((c) => c.catalyst_date! > in60) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total" value={companies.length} href="/watchlist" />
        <Stat label="Tier 1" value={byTier[0]} href="/watchlist?tier=1" />
        <Stat label="Tier 2" value={byTier[1]} href="/watchlist?tier=2" />
        <Stat label="Tier 3" value={byTier[2]} href="/watchlist?tier=3" />
        <Stat label="Avg score" value={avgScore} />
        <Stat label="Needs review" value={stale} href="/review" />
      </div>
      {shortRunway > 0 && (
        <p className="text-sm text-amber-800">{shortRunway} compan{shortRunway === 1 ? "y has" : "ies have"} under 12 months of runway.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {buckets.map((b) => (
          <div key={b.label} className="card">
            <h2 className="mb-2 font-semibold">{b.label} <span className="text-gray-400">({b.items.length})</span></h2>
            {b.items.length === 0 ? (
              <p className="text-sm text-gray-500">No catalysts.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {b.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/watchlist/${c.id}`} className="font-medium hover:text-blue-700">{c.name}</Link>{" "}
                      <TierBadge tier={c.tier} />
                      <div className="truncate text-xs text-gray-500">{c.next_catalyst ?? "—"}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <div>{fmtDate(c.catalyst_date)}</div>
                      <DaysOut date={c.catalyst_date} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-80">{inner}</Link> : inner;
}
