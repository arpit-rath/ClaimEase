import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import PasscodeForm from "@/components/gate/PasscodeForm";

export const metadata: Metadata = {
  // The layout's "%s · ClaimEase" template doesn't apply to its own segment.
  title: { absolute: "Enter passcode · ClaimEase" },
};

/** Landing page: the team passcode gate. proxy.ts skips it once unlocked. */
export default function PasscodePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-accent to-emerald-600 text-accent-foreground shadow-lg shadow-accent/20">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-2xl font-bold tracking-tight">ClaimEase</span>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-8 shadow-lg shadow-black/20">
          <h1 className="text-2xl font-semibold tracking-tight">Enter team passcode</h1>
          <p className="mt-2 text-muted">This keeps your app and your Gemini quota safe.</p>
          <PasscodeForm />
        </section>
      </div>
    </main>
  );
}
