"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button, { buttonClasses } from "@/components/ui/Button";
import { demoUser } from "@/lib/demo-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Shows the demo employee (the claim pages always act as E001) and the
 * Supabase sign-in state used by authenticated routes such as Finance Review.
 */
export default function UserBadge() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { name, employeeId, grade } = demoUser;

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void Promise.resolve()
      .then(() => getSupabaseBrowserClient())
      .then((client) => {
        if (!active) {
          return;
        }

        const { data } = client.auth.onAuthStateChange((_event, session) => {
          setEmail(session?.user.email ?? null);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : "Authentication is unavailable.",
          );
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function signOut() {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) {
        throw error;
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 justify-self-end">
      <div className="flex items-center gap-3">
        <span className="sr-only">
          Employee: {name}, {employeeId}, grade {grade}
        </span>
        <div className="hidden text-right leading-tight sm:block" aria-hidden="true">
          <div className="text-sm font-semibold">{name}</div>
          <div className="flex items-center justify-end gap-1.5 font-mono text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {employeeId} · Grade {grade}
          </div>
        </div>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-3 text-sm font-semibold"
        >
          {initials(name)}
        </span>
        {email ? (
          <Button
            loading={isSigningOut}
            onClick={signOut}
            size="sm"
            variant="ghost"
            className="whitespace-nowrap"
            title={`Signed in as ${email}`}
          >
            Sign out
          </Button>
        ) : (
          <Link className={buttonClasses({ size: "sm", variant: "ghost", className: "whitespace-nowrap" })} href="/login">
            Sign in
          </Link>
        )}
      </div>
      {errorMessage && (
        <span className="max-w-56 text-right text-xs text-danger" role="status">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
