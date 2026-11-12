import { cn } from "@/lib/cn";

/** Marks content that is sample data, not a real backend response. */
export default function ExampleTag({ className, label = "Example data" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-warning",
        className,
      )}
    >
      {label}
    </span>
  );
}
