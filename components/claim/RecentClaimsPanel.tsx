import Link from "next/link";
import { Clock, ReceiptText } from "lucide-react";
import Card from "@/components/ui/Card";
import ExampleTag from "@/components/ui/ExampleTag";
import { cn } from "@/lib/cn";
import { formatDate, formatInr } from "@/lib/format";
import { exampleRecentClaims } from "@/lib/mocks/examples";

const toneText = { accent: "text-accent", warning: "text-warning" } as const;

export default function RecentClaimsPanel() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
          Recent claims
        </h2>
        <Link href="/claims" className="text-sm font-medium text-accent hover:text-accent-hover">
          View all
        </Link>
      </div>
      <ExampleTag className="mt-4" />
      <ul className="mt-2 divide-y divide-border">
        {exampleRecentClaims.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-3 text-muted"
            >
              <ReceiptText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.title}</p>
              <p className="text-xs text-muted">{formatDate(c.expenseDate)}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold">{formatInr(c.amount)}</p>
              <p className={cn("text-xs font-medium", toneText[c.tone])}>{c.status}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
