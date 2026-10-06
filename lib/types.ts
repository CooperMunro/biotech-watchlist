export type SourceLink = { label: string; url: string };
export type Decision = "Buy" | "Watch" | "Pass";

export type Company = {
  id: string;
  name: string;
  ticker_or_private: string | null;
  modality: string | null;
  lead_program: string | null;
  stage: string | null;
  nct_id: string | null;
  next_catalyst: string | null;
  catalyst_date: string | null;
  last_financing_amount: string | null;
  last_financing_date: string | null;
  lead_investor: string | null;
  cash_runway_months: number | null;
  runway_as_of: string | null;
  score: number | null;
  rubric: Partial<Record<string, number>> | null;
  tier: 1 | 2 | 3 | null;
  thesis_fit: boolean | null;
  key_risk: string | null;
  source_links: SourceLink[] | null;
  decision: Decision | null;
  notes: string | null;
  last_reviewed: string | null;
  source: "manual" | "auto" | null;
  discovered_at: string | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Thesis = {
  id: number;
  modalities: string | null;
  stage_preference: string | null;
  risk_tolerance: string | null;
  geography: string | null;
  exclusions: string | null;
  time_horizon: string | null;
  updated_at: string;
};

// Scoring rubric: 5 categories, each 0–2, summed to a 0–10 score.
export const RUBRIC = [
  { key: "science", label: "Science / data quality", hint: "0 preclinical only · 1 early human data · 2 clean randomized or strong mechanistic data" },
  { key: "team", label: "Team & backers", hint: "0 unknown · 1 credible · 2 proven drug developers + top-tier investors" },
  { key: "catalyst", label: "Catalyst proximity", hint: "0 >18 months · 1 6–18 months · 2 <6 months" },
  { key: "funding", label: "Funding / runway", hint: "0 <12 months · 1 12–24 months · 2 >24 months or through catalyst" },
  { key: "market", label: "Market & differentiation", hint: "0 crowded/me-too · 1 some edge · 2 clear unmet need or best-in-class" },
] as const;

export type RubricKey = (typeof RUBRIC)[number]["key"];
