import Link from "next/link";
import { ReceiptText } from "lucide-react";

export default function BrandMark() {
  return (
    <Link href="/claims/new" className="flex items-center gap-3 rounded-xl">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-accent to-emerald-600 text-accent-foreground shadow-lg shadow-accent/20">
        <ReceiptText className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-xl font-bold tracking-tight">ClaimEase</span>
        <span className="hidden text-xs text-muted sm:block">Expense claim assistant</span>
      </span>
    </Link>
  );
}
