import { NextResponse, type NextRequest } from "next/server";
import { discoverCompanies } from "@/lib/discovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called weekly by Vercel Cron (see vercel.json) with "Authorization: Bearer $CRON_SECRET".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isCron = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;

  let supabase;
  if (isCron) {
    supabase = createAdminClient();
  } else {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!isAllowedEmail(data.user?.email)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await discoverCompanies(supabase, {
      conditions: process.env.DISCOVERY_CONDITIONS,
      trigger: isCron ? "cron" : "manual",
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
