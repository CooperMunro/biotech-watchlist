import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompanyForm from "@/components/CompanyForm";
import { DaysOut, DecisionBadge, TierBadge } from "@/components/Badges";
import { fmtDate } from "@/lib/dates";
import type { Company } from "@/lib/types";
import { deleteCompany, updateCompany } from "../../actions";

export default async function CompanyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Company;

  const update = updateCompany.bind(null, c.id);
  const remove = deleteCompany.bind(null, c.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/watchlist" className="text-sm text-gray-500 hover:text-gray-800">← Watchlist</Link>
          <h1 className="text-2xl font-semibold">
            {c.name} <span className="text-base font-normal text-gray-500">{c.ticker_or_private}</span>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <TierBadge tier={c.tier} />
            <DecisionBadge decision={c.decision} />
            <span>Score <strong>{c.score ?? "—"}</strong>/10</span>
            <span className="text-gray-400">·</span>
            <span>{c.modality ?? "—"} · {c.lead_program ?? "—"} · {c.stage ?? "—"}</span>
          </div>
        </div>
        <form action={remove}>
          <button className="btn-danger">Delete</button>
        </form>
      </div>

      {saved && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="label">Next catalyst</div>
          <div className="text-sm">{c.next_catalyst ?? "—"}</div>
          <div className="mt-1 text-sm">{fmtDate(c.catalyst_date)} · <DaysOut date={c.catalyst_date} /></div>
          {c.nct_id && (
            <a href={`https://clinicaltrials.gov/study/${c.nct_id}`} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-blue-700 hover:underline">
              {c.nct_id} ↗
            </a>
          )}
        </div>
        <div className="card">
          <div className="label">Financing</div>
          <div className="text-sm">{c.last_financing_amount ?? "—"} ({fmtDate(c.last_financing_date)})</div>
          <div className="text-sm text-gray-600">Lead: {c.lead_investor ?? "—"}</div>
          <div className="mt-1 text-sm">Runway: {c.cash_runway_months != null ? `${c.cash_runway_months} months` : "—"} as of {fmtDate(c.runway_as_of)}</div>
        </div>
        <div className="card">
          <div className="label">Sources</div>
          {c.source_links?.length ? (
            <ul className="space-y-1 text-sm">
              {c.source_links.map((l, i) => (
                <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{l.label} ↗</a></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">None yet.</p>
          )}
        </div>
      </div>

      {(c.key_risk || c.notes) && (
        <div className="card space-y-2 text-sm">
          {c.key_risk && <p><span className="font-semibold">Key risk:</span> {c.key_risk}</p>}
          {c.notes && <p className="whitespace-pre-wrap">{c.notes}</p>}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Edit</h2>
        <CompanyForm company={c} action={update} submitLabel="Save changes" />
      </div>
    </div>
  );
}
