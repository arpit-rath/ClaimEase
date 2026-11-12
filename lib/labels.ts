import type { ClaimCategory, ClaimStatus } from "@/types/api";

/** Display names for the category codes in policy_rules. */
const CATEGORY_LABELS: Record<ClaimCategory, string> = {
  local_travel: "Local travel",
  outstation_travel: "Outstation travel",
  hotel_metro: "Hotel (metro city)",
  hotel_non_metro: "Hotel (non-metro city)",
  meals: "Meals",
  client_entertainment: "Client entertainment",
  internet: "Internet",
  mobile: "Mobile",
  training: "Training",
};

export function categoryLabel(code: string): string {
  if (code in CATEGORY_LABELS) return CATEGORY_LABELS[code as ClaimCategory];
  const words = code.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Display name and colour for each claim status the backend can return. */
export const STATUS_META: Record<ClaimStatus, { label: string; text: string; badge: string }> = {
  submitted: { label: "Submitted", text: "text-accent", badge: "border-accent/30 bg-accent-soft text-accent" },
  flagged: { label: "Flagged", text: "text-warning", badge: "border-warning/30 bg-warning/10 text-warning" },
  approved: { label: "Approved", text: "text-info", badge: "border-info/30 bg-info/10 text-info" },
  rejected: { label: "Rejected", text: "text-danger", badge: "border-danger/30 bg-danger/10 text-danger" },
  paid: { label: "Paid", text: "text-foreground", badge: "border-border bg-surface-3 text-foreground" },
};
