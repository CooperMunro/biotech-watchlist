"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { suggestTier } from "@/lib/tiering";
import { todayISO } from "@/lib/dates";
import { RUBRIC, type Decision, type SourceLink } from "@/lib/types";

function str(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function int(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseLinks(raw: string | null): SourceLink[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((l) => l && typeof l.url === "string" && l.url.trim() !== "")
      .map((l) => ({ label: String(l.label ?? "").trim() || l.url.trim(), url: l.url.trim() }));
  } catch {
    return [];
  }
}

function companyFromForm(fd: FormData) {
  const rubric: Record<string, number> = {};
  let hasRubric = false;
  for (const r of RUBRIC) {
    const v = int(fd, `rubric_${r.key}`);
    if (v !== null) {
      rubric[r.key] = Math.max(0, Math.min(2, v));
      hasRubric = true;
    }
  }
  const score = hasRubric ? Object.values(rubric).reduce((a, b) => a + b, 0) : int(fd, "score");
  const catalyst_date = str(fd, "catalyst_date");

  const tierRaw = str(fd, "tier");
  const tier = tierRaw === "1" || tierRaw === "2" || tierRaw === "3" ? (Number(tierRaw) as 1 | 2 | 3) : suggestTier(score, catalyst_date);

  const decisionRaw = str(fd, "decision");
  const decision: Decision | null = decisionRaw === "Buy" || decisionRaw === "Watch" || decisionRaw === "Pass" ? decisionRaw : null;

  const name = str(fd, "name");
  if (!name) throw new Error("Name is required");

  return {
    name,
    ticker_or_private: str(fd, "ticker_or_private"),
    modality: str(fd, "modality"),
    lead_program: str(fd, "lead_program"),
    stage: str(fd, "stage"),
    nct_id: str(fd, "nct_id"),
    next_catalyst: str(fd, "next_catalyst"),
    catalyst_date,
    last_financing_amount: str(fd, "last_financing_amount"),
    last_financing_date: str(fd, "last_financing_date"),
    lead_investor: str(fd, "lead_investor"),
    cash_runway_months: int(fd, "cash_runway_months"),
    runway_as_of: str(fd, "runway_as_of"),
    score,
    rubric: hasRubric ? rubric : null,
    tier,
    thesis_fit: fd.get("thesis_fit") === "on",
    key_risk: str(fd, "key_risk"),
    source_links: parseLinks(str(fd, "source_links")),
    decision,
    notes: str(fd, "notes"),
    last_reviewed: str(fd, "last_reviewed"),
  };
}

function revalidateAll() {
  for (const p of ["/", "/watchlist", "/calendar", "/review"]) revalidatePath(p);
}

export async function createCompany(fd: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").insert(companyFromForm(fd)).select("id").single();
  if (error) throw new Error(error.message);
  revalidateAll();
  redirect(`/watchlist/${data.id}`);
}

export async function updateCompany(id: string, fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").update(companyFromForm(fd)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
  revalidatePath(`/watchlist/${id}`);
  redirect(`/watchlist/${id}?saved=1`);
}

export async function deleteCompany(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
  redirect("/watchlist");
}

export async function reviewDecision(id: string, decision: Decision) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ decision, last_reviewed: todayISO() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function saveThesis(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("thesis").upsert({
    id: 1,
    modalities: str(fd, "modalities"),
    stage_preference: str(fd, "stage_preference"),
    risk_tolerance: str(fd, "risk_tolerance"),
    geography: str(fd, "geography"),
    exclusions: str(fd, "exclusions"),
    time_horizon: str(fd, "time_horizon"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/thesis");
  redirect("/thesis?saved=1");
}
