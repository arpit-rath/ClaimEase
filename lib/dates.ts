/**
 * Date helpers for form defaults only. The backend decides whether a date
 * is allowed (future dates and the 60-day rule).
 */

/** "YYYY-MM-DD" for today in India, shifted by `offsetDays`. */
export function isoDateInIndia(offsetDays = 0, now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}
