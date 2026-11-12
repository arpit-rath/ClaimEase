"use client";

import { useRef, useState } from "react";
import { CarTaxiFront, Plane, SendHorizontal, Utensils } from "lucide-react";
import ChatMessage from "@/components/claim/ChatMessage";
import ReviewCard from "@/components/claim/ReviewCard";
import Card from "@/components/ui/Card";
import ExampleTag from "@/components/ui/ExampleTag";
import { demoUser } from "@/lib/demo-user";
import { exampleConversation, examplePrompts } from "@/lib/mocks/examples";

const promptIcons = { meal: Utensils, flight: Plane, cab: CarTaxiFront } as const;

// Example categories for the edit dropdown; real ones will come from policy_rules.
const exampleCategories = ["Meals & Entertainment", "Travel", "Local Conveyance", "Training"] as const;

export default function NewClaimView() {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const initials = demoUser.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("");

  const applyPrompt = (text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map(({ icon, text }) => {
            const Icon = promptIcons[icon];
            return (
              <button
                key={text}
                type="button"
                onClick={() => applyPrompt(text)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:border-accent/50 hover:bg-surface-3"
              >
                <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                {text}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <p className="flex items-center gap-2.5 text-sm font-medium">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_8px] shadow-accent" />
            Policy checks run on submit · Grade {demoUser.grade}
          </p>
          <ExampleTag label="Example preview" />
        </div>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
          <ChatMessage from="user" initials={initials}>
            “{exampleConversation.userMessage}”
          </ChatMessage>
          <ChatMessage from="assistant">{exampleConversation.assistantMessage}</ChatMessage>
          <div className="sm:pl-13">
            <ReviewCard initial={exampleConversation.extracted} categories={exampleCategories} />
          </div>
        </div>

        <form
          className="border-t border-border bg-surface-2/60 p-4 sm:px-6"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-3">
            <label className="flex flex-1 items-center rounded-2xl border border-border bg-surface-2 px-4 focus-within:border-accent/60">
              <span className="sr-only">Describe your expense</span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Describe your expense, e.g. “₹4,500 flight to Bengaluru on Monday”"
                className="h-14 w-full bg-transparent text-foreground placeholder:text-muted focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled
              aria-describedby="composer-note"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendHorizontal className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Send</span>
            </button>
          </div>
          <p id="composer-note" className="mt-2 text-xs text-muted">
            Preview only. Sending is enabled once the assistant and backend are connected.
          </p>
        </form>
      </Card>
    </div>
  );
}
