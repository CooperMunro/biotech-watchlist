import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/dates";
import { TierBadge } from "@/components/Badges";
import DbError from "@/components/DbError";
import SubmitButton from "@/components/SubmitButton";
import type { Company } from "@/lib/types";
import { researchNext, runDiscovery } from "../actions";

export const maxDuration = 300;

type Run = { id: string; ran_at: string; trigger: string; added: number; scanned: number; error: string | null };

export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; scanned?: string; error?: string; researched?: string; remaining?: string; failed?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [runsRes, autoRes, pendingRes] = await Promise.all([
    supabase.from("discovery_runs").select("*").order("ran_at", { ascending: false }).limit(10),
    supabase.from("companies").select("*").eq("source", "auto").order("discovered_at", { ascending: false }).limit(50),
    supabase.from("companies").select("id", { count: "exact", head: true }).is("enriched_at", null),
  ]);
  const pending = pendingRes.count ?? 0;
  if (runsRes.error) return <DbError message={runsRes.error.message} />;
  if (autoRes.error) return <DbError message={autoRes.error.message} />;
  const runs = (runsRes.data ?? []) as Run[];
  const recent = (autoRes.data ?? []) as Company[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Discover companies</h1>
        <p className="text-sm text-gray-600">
          Scans ClinicalTrials.gov for small and mid-size companies running active Phase 1–3 trials, and adds up to 50
          new ones per run with stage, lead program, next catalyst and a partial score. Big pharma and companies already
          on your list are skipped. It also runs automatically every Monday.
        </p>
      </div>

      {sp.added !== undefined && (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Added {sp.added} new compan{sp.added === "1" ? "y" : "ies"} from {sp.scanned} trials scanned.
        </p>
      )}
      {sp.researched !== undefined && (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Researched {sp.researched} compan{sp.researched === "1" ? "y" : "ies"}; {sp.remaining} still waiting.
          {sp.failed ? ` Failed: ${sp.failed}` : ""}
        </p>
      )}
      {sp.error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">Discovery failed: {sp.error}</p>}

      <form action={runDiscovery} className="card flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="conditions">Disease focus (optional)</label>
          <input id="conditions" name="conditions" placeholder="e.g. oncology OR obesity OR ALS" className="input" />
        </div>
        <div>
          <span className="label">Phases</span>
          <div className="flex gap-3 text-sm">
            {["PHASE1", "PHASE2", "PHASE3"].map((p) => (
              <label key={p} className="flex items-center gap-1">
                <input type="checkbox" name={p} defaultChecked /> {p.replace("PHASE", "Ph ")}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="limit">How many</label>
          <input id="limit" name="limit" type="number" min={1} max={50} defaultValue={50} className="input w-20" />
        </div>
        <SubmitButton pendingLabel="Scanning… (up to a minute)">Find companies</SubmitButton>
      </form>

      <form action={researchNext} className="card flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          <div className="font-semibold">AI research</div>
          Fills in financing, runway, team, market and key risk from the web, then re-scores.{" "}
          <strong>{pending}</strong> compan{pending === 1 ? "y is" : "ies are"} waiting. Runs 5 at a time, and 5 more every day automatically.
        </div>
        <SubmitButton pendingLabel="Researching 5… (1–3 minutes)">Research next 5</SubmitButton>
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 font-semibold">Recently discovered</h2>
          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="th">Company</th>
                  <th className="th">Tier</th>
                  <th className="th">Score</th>
                  <th className="th">Stage / modality</th>
                  <th className="th">Catalyst</th>
                  <th className="th">Researched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.length === 0 && (
                  <tr><td colSpan={6} className="td py-6 text-center text-gray-500">Nothing discovered yet. Click Find companies.</td></tr>
                )}
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td className="td">
                      <Link href={`/watchlist/${c.id}`} className="font-medium hover:text-blue-700">{c.name}</Link>
                      <div className="text-xs text-gray-500">{c.ticker_or_private ?? ""}</div>
                    </td>
                    <td className="td"><TierBadge tier={c.tier} /></td>
                    <td className="td">{c.score ?? "—"}</td>
                    <td className="td">{c.stage ?? "—"}<div className="text-xs text-gray-500">{c.modality ?? ""}</div></td>
                    <td className="td whitespace-nowrap">{fmtDate(c.catalyst_date)}</td>
                    <td className="td">{c.enriched_at ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="mb-2 font-semibold">Run history</h2>
          <ul className="card divide-y divide-gray-100 p-0">
            {runs.length === 0 && <li className="p-3 text-sm text-gray-500">No runs yet.</li>}
            {runs.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <div className="flex justify-between">
                  <span>{new Date(r.ran_at + "Z").toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                  <span className="text-xs uppercase text-gray-500">{r.trigger}</span>
                </div>
                {r.error ? (
                  <div className="text-xs text-red-700">{r.error}</div>
                ) : (
                  <div className="text-xs text-gray-600">Added {r.added} · scanned {r.scanned} trials</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
