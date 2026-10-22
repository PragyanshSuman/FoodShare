/**
 * Next occurrence of a weekly schedule ("Mon/Wed/Fri at 21:30 local time"),
 * strictly after `from`. Local time = UTC + tzOffsetMin.
 */
export function nextRunAt(daysOfWeek: number[], publishAt: string, tzOffsetMin: number, from = new Date()): Date {
  if (!daysOfWeek.length) throw new Error("Schedule needs at least one day");
  const [hh, mm] = publishAt.split(":").map(Number);
  const offsetMs = tzOffsetMin * 60_000;
  const localNow = new Date(from.getTime() + offsetMs);

  for (let add = 0; add <= 7; add++) {
    const candidate = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + add, hh, mm));
    if (!daysOfWeek.includes(candidate.getUTCDay())) continue;
    const utc = new Date(candidate.getTime() - offsetMs);
    if (utc > from) return utc;
  }
  throw new Error("Unreachable: a weekly schedule always has a next run");
}
