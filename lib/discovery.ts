// Auto-discovery: scans ClinicalTrials.gov for industry-sponsored, active Phase 1–3 trials,
// groups them by sponsor company, and builds watchlist rows with a partial auto-score.
import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestTier } from "./tiering";

export const MAX_PER_RUN = 50;

export type DiscoverOptions = {
  conditions?: string; // free-text disease focus, e.g. "oncology OR obesity"; empty = everything
  phases?: Array<"PHASE1" | "PHASE2" | "PHASE3">;
  limit?: number;
  trigger?: "manual" | "cron";
};

export type DiscoverResult = { added: number; skipped: number; scanned: number; names: string[] };

type Trial = {
  nctId: string;
  title: string;
  phase: number; // 1, 2, 3 (Phase 1/2 counts as 2)
  phaseLabel: string;
  sponsor: string;
  interventions: { type: string; name: string }[];
  conditions: string[];
  primaryCompletion: string | null; // YYYY-MM-DD
};

// Large pharma and big-cap biotech: excluded so discovery focuses on early-stage names.
const BIG_PHARMA = [
  "pfizer", "novartis", "roche", "genentech", "hoffmann", "merck", "msd", "astrazeneca", "glaxosmithkline", "gsk",
  "sanofi", "johnson & johnson", "janssen", "abbvie", "bristol-myers", "bristol myers", "eli lilly", "lilly", "amgen",
  "gilead", "novo nordisk", "bayer", "boehringer", "takeda", "astellas", "daiichi", "eisai", "otsuka", "chugai",
  "biogen", "regeneron", "vertex", "moderna", "biontech", "csl", "teva", "viatris", "sun pharma", "hengrui",
  "beigene", "beone", "emd serono", "ipsen", "ucb", "servier", "allergan", "celgene", "seagen", "alexion",
  "incyte", "jazz pharmaceuticals", "kyowa kirin", "ono pharmaceutical", "sumitomo", "shionogi", "novavax",
  "sinopharm", "fosun", "cspc", "sino biopharm", "hansoh", "innovent", "zai lab", "grifols", "lundbeck", "menarini",
];

function isBigPharma(name: string) {
  const n = name.toLowerCase();
  return BIG_PHARMA.some((b) => n.includes(b));
}

export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|co|ltd|limited|llc|plc|ag|sa|gmbh|bv|nv|ab|as|kk|pty|holdings?|group)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normDate(d: string | undefined | null): string | null {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (/^\d{4}-\d{2}$/.test(d)) return `${d}-28`; // month-only dates: assume end of month
  return null;
}

function parsePhase(phases: string[] | undefined): { n: number; label: string } {
  const p = phases ?? [];
  if (p.includes("PHASE3")) return { n: 3, label: p.includes("PHASE2") ? "Phase 2/3" : "Phase 3" };
  if (p.includes("PHASE2")) return { n: 2, label: p.includes("PHASE1") ? "Phase 1/2" : "Phase 2" };
  if (p.includes("PHASE1")) return { n: 1, label: "Phase 1" };
  return { n: 0, label: "Early" };
}

export function inferModality(interventions: { type: string; name: string }[]): string {
  const text = interventions.map((i) => i.name).join(" ").toLowerCase();
  const types = interventions.map((i) => i.type);
  if (/vedotin|deruxtecan|govitecan|mafodotin|\badc\b|antibody[- ]drug conjugate/.test(text)) return "ADC";
  if (/car[- ]?t\b|car-nk|\bcar\b|tcr[- ]?t|\btil\b|cell therapy|autologous|allogeneic/.test(text)) return "Cell therapy";
  if (/crispr|base edit|prime edit|gene edit/.test(text)) return "Gene editing";
  if (/\baav|lentivir|gene therapy|vector/.test(text) || types.includes("GENETIC")) return "Gene therapy";
  if (/sirna|siran\b|antisense|\baso\b|mrna|rnai|oligonucleotide|[a-z]+rsen\b/.test(text)) return "RNA";
  if (/vaccine/.test(text)) return "Vaccine";
  if (/\b(lu|ac|y)-?\d{2,3}\b|lutetium|actinium|radioligand|radiopharm/.test(text)) return "Radiopharma";
  if (/bispecific|[a-z]+tamab\b/.test(text)) return "Bispecific";
  if (/mab\b|antibod/.test(text)) return "Antibody";
  if (/peptide|tide\b/.test(text)) return "Peptide";
  if (types.includes("BIOLOGICAL")) return "Protein";
  return "Small molecule";
}

async function fetchTrials(opts: DiscoverOptions): Promise<Trial[]> {
  const phases = opts.phases?.length ? opts.phases : ["PHASE1", "PHASE2", "PHASE3"];
  const params = new URLSearchParams({
    "filter.overallStatus": "RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING",
    "filter.advanced": `AREA[LeadSponsorClass]INDUSTRY AND AREA[StudyType]INTERVENTIONAL AND AREA[Phase](${phases.join(" OR ")})`,
    fields: [
      "NCTId", "BriefTitle", "Phase", "LeadSponsorName", "InterventionName", "InterventionType",
      "Condition", "PrimaryCompletionDate",
    ].join(","),
    pageSize: "1000",
    sort: "LastUpdatePostDate:desc",
  });
  if (opts.conditions?.trim()) params.set("query.cond", opts.conditions.trim());

  const trials: Trial[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ClinicalTrials.gov returned ${res.status}`);
    const json = await res.json();
    for (const s of json.studies ?? []) {
      const p = s.protocolSection ?? {};
      const sponsor = p.sponsorCollaboratorsModule?.leadSponsor?.name;
      const nctId = p.identificationModule?.nctId;
      if (!sponsor || !nctId) continue;
      const phase = parsePhase(p.designModule?.phases);
      trials.push({
        nctId,
        title: p.identificationModule?.briefTitle ?? nctId,
        phase: phase.n,
        phaseLabel: phase.label,
        sponsor: sponsor.trim(),
        interventions: (p.armsInterventionsModule?.interventions ?? []).map((i: { type?: string; name?: string }) => ({
          type: i.type ?? "",
          name: i.name ?? "",
        })),
        conditions: p.conditionsModule?.conditions ?? [],
        primaryCompletion: normDate(p.statusModule?.primaryCompletionDateStruct?.date),
      });
    }
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return trials;
}

// Best-effort ticker lookup from SEC's public company list. Returns an empty map if unreachable.
async function fetchTickers(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "user-agent": `BiotechWatchlist ${process.env.ALLOWED_EMAIL ?? "contact@example.com"}` },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return map;
    const json = (await res.json()) as Record<string, { ticker: string; title: string }>;
    for (const row of Object.values(json)) {
      const key = normalizeName(row.title);
      if (key && !map.has(key)) map.set(key, row.ticker);
    }
  } catch {
    // ticker lookup is optional
  }
  return map;
}

function monthsUntil(date: string, today: Date) {
  return (new Date(date + "T00:00:00").getTime() - today.getTime()) / (86400000 * 30.44);
}

export async function discoverCompanies(supabase: SupabaseClient, opts: DiscoverOptions = {}): Promise<DiscoverResult> {
  const limit = Math.max(1, Math.min(MAX_PER_RUN, opts.limit ?? MAX_PER_RUN));
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  try {
    const [trials, tickers, existingRes, thesisRes] = await Promise.all([
      fetchTrials(opts),
      fetchTickers(),
      supabase.from("companies").select("name"),
      supabase.from("thesis").select("modalities").eq("id", 1).maybeSingle(),
    ]);
    if (existingRes.error) throw new Error(existingRes.error.message);
    const existing = new Set((existingRes.data ?? []).map((r: { name: string }) => normalizeName(r.name)));
    const thesisModalities = (thesisRes.data?.modalities ?? "").toLowerCase();

    // Group trials by sponsor
    const bySponsor = new Map<string, { name: string; trials: Trial[] }>();
    for (const t of trials) {
      if (isBigPharma(t.sponsor)) continue;
      const key = normalizeName(t.sponsor);
      if (!key || existing.has(key)) continue;
      const g = bySponsor.get(key) ?? { name: t.sponsor, trials: [] };
      g.trials.push(t);
      bySponsor.set(key, g);
    }

    const candidates = Array.from(bySponsor.entries()).map(([key, g]) => {
      const lead = [...g.trials].sort(
        (a, b) => b.phase - a.phase || (a.primaryCompletion ?? "9999").localeCompare(b.primaryCompletion ?? "9999")
      )[0];
      const upcoming = g.trials
        .filter((t) => t.primaryCompletion && t.primaryCompletion >= todayISO)
        .sort((a, b) => a.primaryCompletion!.localeCompare(b.primaryCompletion!));
      const next = upcoming[0] ?? null;
      const modality = inferModality(lead.interventions);

      // Partial rubric from trial data only; team/funding/market need human or AI review.
      const science = lead.phase >= 3 ? 2 : lead.phase === 2 ? 1 : 0;
      const m = next?.primaryCompletion ? monthsUntil(next.primaryCompletion, today) : Infinity;
      const catalyst = m <= 6 ? 2 : m <= 18 ? 1 : 0;
      const programs = new Set(g.trials.map((t) => t.interventions[0]?.name).filter(Boolean)).size;
      const team = programs >= 4 ? 2 : programs >= 2 ? 1 : 0;
      const rubric = { science, catalyst, team };
      const score = science + catalyst + team;

      return {
        key,
        sortKey: [-(science + catalyst), next?.primaryCompletion ?? "9999"] as const,
        row: {
          name: g.name,
          ticker_or_private: tickers.get(key) ?? null,
          modality,
          lead_program: lead.interventions.find((i) => !/placebo/i.test(i.name))?.name ?? lead.title,
          stage: lead.phaseLabel,
          nct_id: (next ?? lead).nctId,
          next_catalyst: next ? `Primary completion (${next.phaseLabel}): ${next.title}`.slice(0, 300) : null,
          catalyst_date: next?.primaryCompletion ?? null,
          score,
          rubric,
          tier: suggestTier(score, next?.primaryCompletion ?? null, today),
          thesis_fit: thesisModalities ? thesisModalities.includes(modality.toLowerCase()) : null,
          decision: "Watch",
          source: "auto",
          discovered_at: new Date().toISOString(),
          source_links: g.trials.slice(0, 5).map((t) => ({
            label: `${t.nctId} · ${t.phaseLabel}`,
            url: `https://clinicaltrials.gov/study/${t.nctId}`,
          })),
          notes:
            `Auto-discovered from ClinicalTrials.gov on ${todayISO}. ${g.trials.length} active industry trial(s); ` +
            `conditions: ${Array.from(new Set(g.trials.flatMap((t) => t.conditions))).slice(0, 6).join(", ")}.\n` +
            `Not yet verified: financing, runway, lead investor, market. Score covers science, catalyst and pipeline only.`,
        },
      };
    });

    candidates.sort((a, b) => a.sortKey[0] - b.sortKey[0] || a.sortKey[1].localeCompare(b.sortKey[1]));
    const picked = candidates.slice(0, limit).map((c) => c.row);

    let added = 0;
    const names: string[] = [];
    if (picked.length) {
      const { data, error } = await supabase.from("companies").insert(picked).select("name");
      if (error) throw new Error(error.message);
      added = data?.length ?? 0;
      names.push(...(data ?? []).map((r: { name: string }) => r.name));
    }

    const result = { added, skipped: candidates.length - picked.length, scanned: trials.length, names };
    await supabase.from("discovery_runs").insert({
      trigger: opts.trigger ?? "manual",
      added,
      scanned: trials.length,
      details: { conditions: opts.conditions ?? null, phases: opts.phases ?? null, names },
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("discovery_runs").insert({ trigger: opts.trigger ?? "manual", added: 0, scanned: 0, error: message });
    throw e;
  }
}
