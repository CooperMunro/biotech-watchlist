import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/dates";
import type { Thesis } from "@/lib/types";
import { saveThesis } from "../actions";

const FIELDS: { key: keyof Thesis; label: string; placeholder: string }[] = [
  { key: "modalities", label: "Modalities", placeholder: "Which modalities you favor and why" },
  { key: "stage_preference", label: "Stage preference", placeholder: "e.g. Phase 1b–2 with human proof of mechanism" },
  { key: "risk_tolerance", label: "Risk tolerance", placeholder: "Position sizing, binary-event appetite" },
  { key: "geography", label: "Geography", placeholder: "US / EU / China biotech" },
  { key: "exclusions", label: "Exclusions", placeholder: "What you will not own" },
  { key: "time_horizon", label: "Time horizon", placeholder: "Holding period, exit triggers" },
];

export default async function ThesisPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("thesis").select("*").eq("id", 1).maybeSingle();
  const t = data as Thesis | null;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Investment thesis</h1>
        {t?.updated_at && <p className="text-sm text-gray-500">Last updated {fmtDate(t.updated_at.slice(0, 10))}</p>}
      </div>
      {saved && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>}
      <form action={saveThesis} className="card space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={f.key}>{f.label}</label>
            <textarea id={f.key} name={f.key} rows={3} placeholder={f.placeholder} defaultValue={(t?.[f.key] as string | null) ?? ""} className="input" />
          </div>
        ))}
        <button className="btn">Save thesis</button>
      </form>
    </div>
  );
}
