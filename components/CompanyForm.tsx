"use client";

import { useMemo, useState } from "react";
import { suggestTier } from "@/lib/tiering";
import { RUBRIC, type Company, type SourceLink } from "@/lib/types";

type Props = {
  company?: Company;
  action: (fd: FormData) => void | Promise<void>;
  submitLabel: string;
};

const MODALITIES = ["Small molecule", "Antibody", "ADC", "Bispecific", "Cell therapy", "Gene therapy", "Gene editing", "RNA", "Vaccine", "Radiopharma", "Peptide", "Protein", "Platform", "Other"];
const STAGES = ["Discovery", "Preclinical", "IND-enabling", "Phase 1", "Phase 1/2", "Phase 2", "Phase 3", "Filed", "Approved"];

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export default function CompanyForm({ company, action, submitLabel }: Props) {
  const c = company;
  const initialRubric: Record<string, string> = {};
  for (const r of RUBRIC) {
    const v = c?.rubric?.[r.key];
    initialRubric[r.key] = v === undefined || v === null ? (c ? "" : "0") : String(v);
  }
  const [rubric, setRubric] = useState(initialRubric);
  const [manualScore, setManualScore] = useState(c?.score != null ? String(c.score) : "");
  const [catalystDate, setCatalystDate] = useState(c?.catalyst_date ?? "");
  const [links, setLinks] = useState<SourceLink[]>(c?.source_links?.length ? c.source_links : [{ label: "", url: "" }]);

  const usingRubric = Object.values(rubric).some((v) => v !== "");
  const score = usingRubric
    ? Object.values(rubric).reduce((sum, v) => sum + (v === "" ? 0 : Number(v)), 0)
    : manualScore === "" ? null : Number(manualScore);
  const suggested = useMemo(() => suggestTier(score, catalystDate || null), [score, catalystDate]);

  const initialTier = c?.tier && c.tier !== suggestTier(c.score, c.catalyst_date) ? String(c.tier) : "";
  const [tier, setTier] = useState(initialTier);

  return (
    <form action={action} className="space-y-6">
      <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name *"><input name="name" required defaultValue={c?.name ?? ""} className="input" /></Field>
        <Field label="Ticker or 'Private'"><input name="ticker_or_private" defaultValue={c?.ticker_or_private ?? ""} className="input" /></Field>
        <Field label="Modality">
          <input name="modality" list="modalities" defaultValue={c?.modality ?? ""} className="input" />
          <datalist id="modalities">{MODALITIES.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Field label="Lead program"><input name="lead_program" defaultValue={c?.lead_program ?? ""} className="input" /></Field>
        <Field label="Stage">
          <input name="stage" list="stages" defaultValue={c?.stage ?? ""} className="input" />
          <datalist id="stages">{STAGES.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="NCT ID"><input name="nct_id" placeholder="NCT01234567" defaultValue={c?.nct_id ?? ""} className="input" /></Field>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Next catalyst" className="sm:col-span-2"><input name="next_catalyst" defaultValue={c?.next_catalyst ?? ""} className="input" /></Field>
        <Field label="Catalyst date"><input name="catalyst_date" type="date" value={catalystDate} onChange={(e) => setCatalystDate(e.target.value)} className="input" /></Field>
        <Field label="Last financing amount"><input name="last_financing_amount" placeholder="$120M Series B" defaultValue={c?.last_financing_amount ?? ""} className="input" /></Field>
        <Field label="Last financing date"><input name="last_financing_date" type="date" defaultValue={c?.last_financing_date ?? ""} className="input" /></Field>
        <Field label="Lead investor"><input name="lead_investor" defaultValue={c?.lead_investor ?? ""} className="input" /></Field>
        <Field label="Cash runway (months)"><input name="cash_runway_months" type="number" min={0} defaultValue={c?.cash_runway_months ?? ""} className="input" /></Field>
        <Field label="Runway as of"><input name="runway_as_of" type="date" defaultValue={c?.runway_as_of ?? ""} className="input" /></Field>
      </section>

      <section className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Scoring rubric</h2>
          <span className="text-sm">
            Score: <strong className="text-lg">{score ?? "—"}</strong> / 10
          </span>
        </div>
        <div className="space-y-3">
          {RUBRIC.map((r) => (
            <div key={r.key} className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
              <div>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-gray-500">{r.hint}</div>
              </div>
              <div className="flex gap-1">
                {(c ? ["", "0", "1", "2"] : ["0", "1", "2"]).map((v) => (
                  <label
                    key={v}
                    className={`cursor-pointer rounded border px-3 py-1 text-sm ${rubric[r.key] === v ? "border-blue-700 bg-blue-700 text-white" : "border-gray-300 bg-white hover:bg-gray-50"}`}
                  >
                    <input
                      type="radio"
                      name={`rubric_${r.key}`}
                      value={v}
                      checked={rubric[r.key] === v}
                      onChange={() => setRubric({ ...rubric, [r.key]: v })}
                      className="sr-only"
                    />
                    {v === "" ? "–" : v}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!usingRubric && (
          <div className="mt-4 max-w-xs">
            <Field label="Score (manual, 0–10)">
              <input name="score" type="number" min={0} max={10} value={manualScore} onChange={(e) => setManualScore(e.target.value)} className="input" />
            </Field>
          </div>
        )}
      </section>

      <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Tier">
          <select name="tier" value={tier} onChange={(e) => setTier(e.target.value)} className="input">
            <option value="">Auto (Tier {suggested})</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        </Field>
        <Field label="Decision">
          <select name="decision" defaultValue={c?.decision ?? "Watch"} className="input">
            <option value="">—</option>
            <option>Buy</option>
            <option>Watch</option>
            <option>Pass</option>
          </select>
        </Field>
        <Field label="Last reviewed"><input name="last_reviewed" type="date" defaultValue={c?.last_reviewed ?? ""} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input name="thesis_fit" type="checkbox" defaultChecked={c?.thesis_fit ?? false} /> Fits my thesis
        </label>
        <Field label="Key risk" className="sm:col-span-2 lg:col-span-3"><input name="key_risk" defaultValue={c?.key_risk ?? ""} className="input" /></Field>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Source links</h2>
        <input type="hidden" name="source_links" value={JSON.stringify(links)} />
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder="Label" value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="input max-w-[200px]" />
              <input placeholder="https://…" type="url" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className="input" />
              <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="btn-secondary">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])} className="btn-secondary mt-2">+ Add link</button>
      </section>

      <section className="card">
        <Field label="Notes"><textarea name="notes" rows={6} defaultValue={c?.notes ?? ""} className="input" /></Field>
      </section>

      <button className="btn">{submitLabel}</button>
    </form>
  );
}
