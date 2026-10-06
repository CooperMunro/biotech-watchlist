// AI research step: uses Claude with web search to fill in financing, runway, team and market
// for a company, then re-scores it. Requires ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestTier } from "./tiering";
import type { Company, SourceLink } from "./types";

export const ENRICH_BATCH = 5;

const MODEL = "claude-opus-5-5";

type Findings = {
  ticker_or_private: string | null;
  last_financing_amount: string | null;
  last_financing_date: string | null;
  lead_investor: string | null;
  cash_runway_months: number | null;
  runway_as_of: string | null;
  market_summary: string;
  key_risk: string;
  team_score: 0 | 1 | 2;
  funding_score: 0 | 1 | 2;
  market_score: 0 | 1 | 2;
  sources: SourceLink[];
  confidence: "low" | "medium" | "high";
};

const nullableString = { type: ["string", "null"] };
const score = { type: "integer", enum: [0, 1, 2] };

const SAVE_TOOL: Anthropic.Beta.BetaTool = {
  name: "save_findings",
  description: "Save the researched facts about the company. Call exactly once, after researching.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "ticker_or_private", "last_financing_amount", "last_financing_date", "lead_investor",
      "cash_runway_months", "runway_as_of", "market_summary", "key_risk",
      "team_score", "funding_score", "market_score", "sources", "confidence",
    ],
    properties: {
      ticker_or_private: { ...nullableString, description: "Stock ticker with exchange (e.g. 'NASDAQ: ABCD') or 'Private'" },
      last_financing_amount: { ...nullableString, description: "Most recent raise, e.g. '$120M Series B' or '$75M follow-on offering'" },
      last_financing_date: { ...nullableString, description: "YYYY-MM-DD of that raise (use the 1st of the month if only the month is known)" },
      lead_investor: { ...nullableString, description: "Lead investor of the most recent round, if reported" },
      cash_runway_months: { type: ["integer", "null"], description: "Months of cash runway from the latest reported date (company guidance, or cash ÷ quarterly burn × 3)" },
      runway_as_of: { ...nullableString, description: "YYYY-MM-DD date the cash figure is as of" },
      market_summary: { type: "string", description: "1–2 sentences: target market size / unmet need and competitive position" },
      key_risk: { type: "string", description: "The single biggest risk to the investment thesis, one sentence" },
      team_score: { ...score, description: "0 unknown/unproven team, 1 credible, 2 proven drug developers and top-tier investors" },
      funding_score: { ...score, description: "0 under 12 months runway, 1 12–24 months, 2 over 24 months or funded through the next catalyst" },
      market_score: { ...score, description: "0 crowded/me-too, 1 some edge, 2 clear unmet need or best-in-class potential" },
      sources: {
        type: "array",
        description: "Up to 5 URLs you relied on",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "url"],
          properties: { label: { type: "string" }, url: { type: "string" } },
        },
      },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
    },
  },
};

function prompt(c: Company) {
  return [
    `Research this biotech company for an investment watchlist and then call save_findings.`,
    ``,
    `Company: ${c.name}`,
    c.ticker_or_private ? `Ticker: ${c.ticker_or_private}` : null,
    c.lead_program ? `Lead program: ${c.lead_program} (${c.stage ?? "stage unknown"})` : null,
    c.modality ? `Modality: ${c.modality}` : null,
    c.nct_id ? `Trial: ${c.nct_id}` : null,
    ``,
    `Find: whether it is public (ticker) or private; its most recent financing (amount, round, date, lead investor);`,
    `its latest reported cash position and runway; the market and competitive landscape for the lead program;`,
    `and the biggest risk. Prefer press releases, SEC filings, and reputable trade press (Fierce Biotech, Endpoints, BioSpace).`,
    `Use null for anything you cannot verify rather than guessing. Today is ${new Date().toISOString().slice(0, 10)}.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function validDate(d: string | null) {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

async function research(client: Anthropic, c: Company): Promise<Findings> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt(c) }];

  // A long web-search turn can come back as pause_turn; resend to let it continue.
  for (let i = 0; i < 4; i++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }, SAVE_TOOL],
      tool_choice: { type: "auto" },
      messages,
    });

    if (response.stop_reason === "refusal") throw new Error("The research request was declined");
    const save = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "save_findings"
    );
    if (save) return save.input as Findings;
    if (response.stop_reason !== "pause_turn") throw new Error(`Research ended without results (${response.stop_reason})`);
    messages.push({ role: "assistant", content: response.content });
  }
  throw new Error("Research did not finish");
}

export async function enrichCompany(supabase: SupabaseClient, id: string): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in Vercel");
  const { data, error } = await supabase.from("companies").select("*").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Company not found");
  const c = data as Company;

  const client = new Anthropic({ timeout: 240_000, maxRetries: 1 });
  const f = await research(client, c);

  const rubric = { ...(c.rubric ?? {}), team: f.team_score, funding: f.funding_score, market: f.market_score };
  const score = Math.min(10, Object.values(rubric).reduce<number>((s, v) => s + (v ?? 0), 0));
  const links = [...(c.source_links ?? [])];
  for (const s of f.sources ?? []) {
    if (s.url && !links.some((l) => l.url === s.url)) links.push({ label: s.label || s.url, url: s.url });
  }
  const today = new Date().toISOString().slice(0, 10);

  // Fill blanks only, so anything you entered by hand is kept.
  const update = {
    ticker_or_private: c.ticker_or_private ?? f.ticker_or_private,
    last_financing_amount: c.last_financing_amount ?? f.last_financing_amount,
    last_financing_date: c.last_financing_date ?? validDate(f.last_financing_date),
    lead_investor: c.lead_investor ?? f.lead_investor,
    cash_runway_months: c.cash_runway_months ?? f.cash_runway_months,
    runway_as_of: c.runway_as_of ?? validDate(f.runway_as_of),
    key_risk: c.key_risk ?? f.key_risk,
    rubric,
    score,
    tier: suggestTier(score, c.catalyst_date),
    source_links: links.slice(0, 12),
    notes: [c.notes, `AI research ${today} (${f.confidence} confidence): ${f.market_summary}`].filter(Boolean).join("\n\n"),
    enriched_at: new Date().toISOString(),
  };
  const { error: upErr } = await supabase.from("companies").update(update).eq("id", id);
  if (upErr) throw new Error(upErr.message);
}

// Researches the next few companies that haven't been researched yet, highest priority first.
export async function enrichNext(supabase: SupabaseClient, limit = ENRICH_BATCH) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .is("enriched_at", null)
    .order("tier", { ascending: true, nullsFirst: false })
    .order("catalyst_date", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results = await Promise.allSettled((data ?? []).map((c) => enrichCompany(supabase, c.id)));
  const failed = results
    .map((r, i) => (r.status === "rejected" ? `${data![i].name}: ${r.reason instanceof Error ? r.reason.message : r.reason}` : null))
    .filter(Boolean) as string[];
  const { count } = await supabase.from("companies").select("id", { count: "exact", head: true }).is("enriched_at", null);
  return { done: results.length - failed.length, failed, remaining: count ?? 0 };
}
