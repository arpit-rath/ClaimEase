import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  info: "border-info/30 bg-info/10 text-info",
  success: "border-accent/30 bg-accent-soft text-accent",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

type AlertProps = {
  tone?: Tone;
  title: ReactNode;
  children?: ReactNode;
  /** Optional controls, such as a Retry button. */
  action?: ReactNode;
  className?: string;
};

export default function Alert({ tone = "info", title, children, action, className }: AlertProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between",
        tones[tone],
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {children && <div className="text-sm text-foreground/80">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
