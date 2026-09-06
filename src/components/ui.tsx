import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "line" }) {
  const styles = {
    primary: "bg-accent text-accent-fg hover:opacity-90",
    ghost: "bg-transparent text-fg hover:bg-raised",
    danger: "bg-danger text-fg hover:opacity-90",
    line: "bg-transparent text-fg border border-line hover:bg-raised",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-surface", className)} {...props} />;
}

export function Label({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-[11px] font-medium uppercase tracking-[0.16em] text-subtle", className)}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-muted"
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="min-h-24 w-full resize-y rounded-md border border-line bg-raised px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus:border-muted"
      {...props}
    />
  );
}

export function Meter({
  label,
  value,
  max = 100,
  tone = "normal",
}: {
  label: string;
  value: number;
  max?: number;
  tone?: "normal" | "warn" | "danger" | "ok";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : tone === "ok" ? "bg-ok" : "bg-accent";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted">{label}</span>
        <span className="tabular text-xs text-fg">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Chip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" | "warn" | "ok" }) {
  const map = {
    muted: "border-line text-muted",
    danger: "border-danger/40 text-danger",
    warn: "border-warn/40 text-warn",
    ok: "border-ok/40 text-ok",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide", map[tone])}>
      {children}
    </span>
  );
}
