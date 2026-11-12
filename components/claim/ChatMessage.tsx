import type { ReactNode } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/cn";

type ChatMessageProps = {
  from: "user" | "assistant";
  /** Short initials shown beside the employee's own messages. */
  initials?: string;
  children: ReactNode;
};

export default function ChatMessage({ from, initials, children }: ChatMessageProps) {
  const isUser = from === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold",
          isUser
            ? "border-border bg-surface-3 text-foreground"
            : "border-accent/40 bg-accent-soft text-accent",
        )}
      >
        {isUser ? initials : <Zap className="h-4 w-4" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-5 py-3.5 leading-relaxed sm:max-w-xl",
          isUser
            ? "rounded-tr-sm bg-accent font-medium text-accent-foreground"
            : "rounded-tl-sm border border-border bg-surface-3 text-foreground",
        )}
      >
        <span className="sr-only">{isUser ? "You said: " : "Assistant: "}</span>
        {children}
      </div>
    </div>
  );
}
