"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";

/** Where to go after unlocking: the page the visitor asked for, if it's on this site. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/claims/new";
  return next;
}

export default function PasscodeForm() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passcode || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (response.ok) {
        // Full navigation so the new cookie is used for the next page.
        window.location.assign(nextPath());
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Something went wrong. Try again.");
      setPasscode("");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setSubmitting(false);
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <label className="flex flex-col">
        <span className="sr-only">Passcode</span>
        <input
          type="password"
          name="passcode"
          autoComplete="current-password"
          autoFocus
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => {
            setPasscode(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "passcode-error" : undefined}
          className="h-14 w-full rounded-xl border border-border bg-surface-2 px-4 text-lg text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>
      {error && (
        <p id="passcode-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="h-14 w-full text-lg" disabled={!passcode} loading={submitting}>
        {submitting ? "Checking…" : "Enter"}
      </Button>
    </form>
  );
}
