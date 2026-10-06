// Auto-tier suggestion, applied on save when the tier is left on "Auto".
// score >= 7 and catalyst within 6 months → 1; score >= 4 → 2; else 3.
export function suggestTier(score: number | null, catalystDate: string | null, today = new Date()): 1 | 2 | 3 {
  const s = score ?? 0;
  if (s >= 7 && catalystDate) {
    const d = new Date(catalystDate + "T00:00:00");
    const sixMonths = new Date(today);
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d >= startOfToday && d <= sixMonths) return 1;
  }
  if (s >= 4) return 2;
  return 3;
}
