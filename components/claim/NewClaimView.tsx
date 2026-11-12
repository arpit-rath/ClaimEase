"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CarTaxiFront, PencilLine, Plane, RotateCw, SendHorizontal, Utensils } from "lucide-react";
import ChatMessage from "@/components/claim/ChatMessage";
import ReviewCard, { type FormDraft } from "@/components/claim/ReviewCard";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { extractClaim } from "@/lib/api-client";
import { isoDateInIndia } from "@/lib/dates";
import { demoUser } from "@/lib/demo-user";
import { formatInr } from "@/lib/format";
import { describeFailure } from "@/lib/use-api";
import type { Claim, ClaimDraft } from "@/types/api";

const EXAMPLE_PROMPTS = [
  { icon: Utensils, text: "I spent ₹2,400 on a client dinner yesterday, submit it." },
  { icon: Plane, text: "₹8,500 flight to Mumbai for a client summit on Monday" },
  { icon: CarTaxiFront, text: "Took a cab to the client office in Guindy today" },
];

const EMPTY_DRAFT: ClaimDraft = { category: null, amount: null, expense_date: null, description: null, has_receipt: null };
const AI_LABEL = "AI suggestion · please check";

type NewChatEntry =
  | { from: "user"; text: string }
  | { from: "assistant"; text: string; error?: { message: string; draft: ClaimDraft } };
type ChatEntry = NewChatEntry & { id: number };

type CardState = { key: number; form: FormDraft; startEditing: boolean; label?: string };

function hasAnyDetail(draft: ClaimDraft) {
  return Object.values(draft).some((v) => v !== null);
}

function toForm(draft: ClaimDraft): FormDraft {
  return {
    category: draft.category ?? "",
    amount: draft.amount !== null ? String(draft.amount) : "",
    expense_date: draft.expense_date ?? "",
    description: draft.description ?? "",
    has_receipt: draft.has_receipt ?? false,
  };
}

function blankForm(): FormDraft {
  return { category: "", amount: "", expense_date: isoDateInIndia(0), description: "", has_receipt: false };
}

function savedMessage(claim: Claim) {
  const amount = formatInr(claim.amount);
  if (claim.status === "flagged") {
    return `Saved claim #${claim.id} for ${amount}. It's flagged for finance review: ${claim.policy_check ?? "no reason given"}.`;
  }
  return `Saved claim #${claim.id} for ${amount}: ${claim.policy_check ?? "submitted"}. You can follow it in My Claims.`;
}

export default function NewClaimView() {
  const firstName = demoUser.name.split(/\s+/)[0];
  const initials = demoUser.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("");

  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      id: 0,
      from: "assistant",
      text: `Hi ${firstName}! Tell me about a work expense: how much, what it was for, and when. I'll fill in the claim for you to check. Nothing is submitted until you confirm.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [draft, setDraft] = useState<ClaimDraft>(EMPTY_DRAFT);
  const [claimDone, setClaimDone] = useState(false);
  const [card, setCard] = useState<CardState | null>(null);

  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view (not on first render).
  useEffect(() => {
    if (messages.length > 1 || sending) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, sending]);

  const push = (entry: NewChatEntry) =>
    setMessages((list) => [...list, { ...entry, id: nextId.current++ }]);

  async function runExtraction(message: string, base: ClaimDraft) {
    setSending(true);
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), 8_000);
    const result = await extractClaim({ message, ...(hasAnyDetail(base) ? { draft: base } : {}) });
    window.clearTimeout(slowTimer);
    setSending(false);
    setSlow(false);

    if (!result.ok) {
      push({ from: "assistant", text: describeFailure(result.failure), error: { message, draft: base } });
      return;
    }

    const { draft: next, missing, reply } = result.data;
    push({ from: "assistant", text: reply });
    setDraft(next);
    setCard({ key: nextId.current++, form: toForm(next), startEditing: missing.length > 0, label: AI_LABEL });
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const base = claimDone ? EMPTY_DRAFT : draft;
    if (claimDone) setClaimDone(false);
    push({ from: "user", text });
    setInput("");
    void runExtraction(text, base);
  }

  function retry(entry: Extract<ChatEntry, { from: "assistant" }>) {
    if (!entry.error || sending) return;
    setMessages((list) => list.filter((m) => m.id !== entry.id));
    void runExtraction(entry.error.message, entry.error.draft);
  }

  function fillManually() {
    setCard({ key: nextId.current++, form: blankForm(), startEditing: true });
  }

  function handleSaved(claim: Claim) {
    push({ from: "assistant", text: savedMessage(claim) });
    setClaimDone(true);
    setDraft(EMPTY_DRAFT);
  }

  function handleStartNew() {
    setClaimDone(false);
    setDraft(EMPTY_DRAFT);
    push({ from: "assistant", text: "Okay, tell me about your next expense, or fill in the form below." });
  }

  const last = messages[messages.length - 1];
  const lastIsError = last.from === "assistant" && Boolean(last.error);
  const showFillLink = !card && !sending && !lastIsError;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map(({ icon: Icon, text }) => (
            <button
              key={text}
              type="button"
              onClick={() => {
                setInput(text);
                inputRef.current?.focus();
              }}
              className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-left text-sm transition-colors hover:border-accent/50 hover:bg-surface-3"
            >
              <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              {text}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <p className="flex items-center gap-2.5 text-sm font-medium">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_8px] shadow-accent" />
            Policy checks run on submit · Grade {demoUser.grade}
          </p>
          <p className="text-xs text-muted">The assistant suggests · you confirm</p>
        </div>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6" aria-live="polite">
          {messages.map((m) =>
            m.from === "user" ? (
              <ChatMessage key={m.id} from="user" initials={initials}>
                {m.text}
              </ChatMessage>
            ) : (
              <ChatMessage key={m.id} from="assistant" tone={m.error ? "error" : "normal"}>
                <p>{m.text}</p>
                {m.error && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={sending} onClick={() => retry(m)}>
                      <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                    </Button>
                    {!card && (
                      <Button size="sm" variant="ghost" onClick={fillManually}>
                        <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Fill in myself
                      </Button>
                    )}
                  </div>
                )}
              </ChatMessage>
            ),
          )}

          {sending && (
            <ChatMessage from="assistant">
              <span className="flex items-center gap-2 text-muted">
                <Spinner />
                {slow ? "The assistant is busy, this is taking longer than usual…" : "Reading your expense…"}
              </span>
            </ChatMessage>
          )}

          {card ? (
            <div className="sm:pl-13">
              <ReviewCard
                key={card.key}
                initialDraft={card.form}
                blankDraft={blankForm()}
                label={card.label}
                startEditing={card.startEditing}
                onSaved={handleSaved}
                onStartNew={handleStartNew}
              />
            </div>
          ) : (
            showFillLink && (
              <div className="sm:pl-13">
                <button
                  type="button"
                  onClick={fillManually}
                  className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
                >
                  <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Or fill in the details yourself
                </button>
              </div>
            )
          )}
          <div ref={endRef} />
        </div>

        <form className="border-t border-border bg-surface-2/60 p-4 sm:px-6" onSubmit={send}>
          <div className="flex items-center gap-3">
            <label className="flex flex-1 items-center rounded-2xl border border-border bg-surface-2 px-4 focus-within:border-accent/60">
              <span className="sr-only">Describe your expense</span>
              <input
                ref={inputRef}
                value={input}
                maxLength={1000}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your expense, e.g. “₹4,500 flight to Bengaluru on Monday”"
                className="h-14 w-full bg-transparent text-foreground placeholder:text-muted focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={sending || input.trim() === ""}
              aria-busy={sending || undefined}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Spinner className="h-5 w-5" /> : <SendHorizontal className="h-5 w-5" aria-hidden="true" />}
              <span className="sr-only">Send</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            The assistant only suggests details. Nothing is saved until you confirm, and policy is checked
            when you submit.
          </p>
        </form>
      </Card>
    </div>
  );
}
