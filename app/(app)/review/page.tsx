import DbError from "@/components/DbError";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, fmtDate } from "@/lib/dates";
import { DaysOut, DecisionBadge, TierBadge } from "@/components/Badges";
import type { Company, Decision } from "@/lib/types";
import { reviewDecision } from "../actions";

// "Hold" in the UI maps to the schema's "Watch" decision.
const BUTTONS: { label: string; decision: Decision; cls: string }[] = [
  { label: "Buy", decision: "Buy", cls: "border-emerald-300 text-emerald-800 hover:bg-emerald-50" },
  { label: "Hold", decision: "Watch", cls: "border-amber-300 text-amber-800 hover:bg-amber-50" },
  { label: "Pass", decision: "Pass", cls: "border-red-300 text-red-800 hover:bg-red-50" },
];

export default async function Review() {
  const supabase = await createClient();
  const cutoff = addDaysISO(-90);
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .or(`tier.eq.1,last_reviewed.is.null,last_reviewed.lt.${cutoff}`)
    .order("tier", { ascending: true })
    .order("catalyst_date", { ascending: true, nullsFirst: false });
  if (error) return <DbError message={error.message} />;
  const companies = (data ?? []) as Company[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Weekly review <span className="text-gray-400">({companies.length})</span></h1>
        <p className="text-sm text-gray-600">All Tier 1 names, plus anything not reviewed in the last 90 days. A button sets the decision and stamps today as last reviewed.</p>
      </div>
      {companies.length === 0 && <p className="card text-sm text-gray-500">Nothing to review.</p>}
      <div className="space-y-3">
        {companies.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/watchlist/${c.id}`} className="font-semibold hover:text-blue-700">{c.name}</Link>
                <TierBadge tier={c.tier} />
                <DecisionBadge decision={c.decision} />
                <span className="text-sm">Score {c.score ?? "—"}</span>
              </div>
              <div className="text-sm text-gray-600">
                {c.next_catalyst ?? "No catalyst"} · {fmtDate(c.catalyst_date)} (<DaysOut date={c.catalyst_date} />)
              </div>
              <div className="text-xs text-gray-500">
                Last reviewed {fmtDate(c.last_reviewed)}{c.key_risk ? ` · Risk: ${c.key_risk}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              {BUTTONS.map((b) => (
                <form key={b.label} action={reviewDecision.bind(null, c.id, b.decision)}>
                  <button className={`rounded border bg-white px-3 py-1.5 text-sm font-medium ${b.cls}`}>{b.label}</button>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
