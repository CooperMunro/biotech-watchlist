import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/dates";
import { DaysOut, DecisionBadge, TierBadge } from "@/components/Badges";
import type { Company } from "@/lib/types";

type SP = { tier?: string; modality?: string; min_score?: string; sort?: string; dir?: string; q?: string };

const SORTS: Record<string, string> = {
  catalyst: "catalyst_date",
  score: "score",
  name: "name",
  tier: "tier",
  reviewed: "last_reviewed",
};

export default async function Watchlist({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sortKey = sp.sort && SORTS[sp.sort] ? sp.sort : "catalyst";
  const asc = sp.dir ? sp.dir === "asc" : sortKey !== "score";

  const supabase = await createClient();
  let query = supabase.from("companies").select("*");
  if (sp.tier) query = query.eq("tier", Number(sp.tier));
  if (sp.modality) query = query.eq("modality", sp.modality);
  if (sp.min_score) query = query.gte("score", Number(sp.min_score));
  if (sp.q) query = query.or(`name.ilike.%${sp.q.replace(/[%,()]/g, "")}%,lead_program.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  query = query.order(SORTS[sortKey], { ascending: asc, nullsFirst: false });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const companies = (data ?? []) as Company[];

  const { data: modRows } = await supabase.from("companies").select("modality");
  const modalities = Array.from(new Set((modRows ?? []).map((r) => r.modality).filter(Boolean))).sort() as string[];

  function sortHref(key: string) {
    const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    const nextAsc = sortKey === key ? !asc : key !== "score";
    params.set("sort", key);
    params.set("dir", nextAsc ? "asc" : "desc");
    return `/watchlist?${params.toString()}`;
  }
  const arrow = (key: string) => (sortKey === key ? (asc ? " ↑" : " ↓") : "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Watchlist <span className="text-gray-400">({companies.length})</span></h1>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Search</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Name or program" className="input" />
        </div>
        <div>
          <label className="label">Tier</label>
          <select name="tier" defaultValue={sp.tier ?? ""} className="input">
            <option value="">All</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        </div>
        <div>
          <label className="label">Modality</label>
          <select name="modality" defaultValue={sp.modality ?? ""} className="input">
            <option value="">All</option>
            {modalities.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Min score</label>
          <input name="min_score" type="number" min={0} max={10} defaultValue={sp.min_score ?? ""} className="input w-24" />
        </div>
        {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
        {sp.dir && <input type="hidden" name="dir" value={sp.dir} />}
        <button className="btn">Filter</button>
        <Link href="/watchlist" className="btn-secondary">Reset</Link>
      </form>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="th"><Link href={sortHref("name")}>Company{arrow("name")}</Link></th>
              <th className="th"><Link href={sortHref("tier")}>Tier{arrow("tier")}</Link></th>
              <th className="th"><Link href={sortHref("score")}>Score{arrow("score")}</Link></th>
              <th className="th">Modality</th>
              <th className="th">Lead program / stage</th>
              <th className="th"><Link href={sortHref("catalyst")}>Catalyst{arrow("catalyst")}</Link></th>
              <th className="th">Runway</th>
              <th className="th">Decision</th>
              <th className="th"><Link href={sortHref("reviewed")}>Reviewed{arrow("reviewed")}</Link></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies.length === 0 && (
              <tr><td colSpan={9} className="td py-8 text-center text-gray-500">No companies match. <Link href="/watchlist/new" className="text-blue-700">Add one</Link>.</td></tr>
            )}
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="td">
                  <Link href={`/watchlist/${c.id}`} className="font-medium hover:text-blue-700">{c.name}</Link>
                  <div className="text-xs text-gray-500">{c.ticker_or_private ?? ""}</div>
                </td>
                <td className="td"><TierBadge tier={c.tier} /></td>
                <td className="td font-semibold">{c.score ?? "—"}</td>
                <td className="td">{c.modality ?? "—"}</td>
                <td className="td">{c.lead_program ?? "—"}<div className="text-xs text-gray-500">{c.stage ?? ""}</div></td>
                <td className="td whitespace-nowrap">{fmtDate(c.catalyst_date)}<div className="text-xs"><DaysOut date={c.catalyst_date} /></div></td>
                <td className="td">{c.cash_runway_months != null ? `${c.cash_runway_months} mo` : "—"}</td>
                <td className="td"><DecisionBadge decision={c.decision} /></td>
                <td className="td whitespace-nowrap">{fmtDate(c.last_reviewed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
