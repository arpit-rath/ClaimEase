import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export default function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-surface shadow-lg shadow-black/20", className)}
      {...rest}
    />
  );
}
