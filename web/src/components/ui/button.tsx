import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "outline" | "danger" | "subtle";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  default:
    "bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] hover:border-[var(--border-strong)]",
  primary:
    "bg-[var(--brand)] text-[var(--brand-fg)] border border-transparent hover:opacity-90 font-medium",
  ghost: "bg-transparent text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
  outline:
    "bg-transparent text-[var(--fg)] border border-[var(--border)] hover:border-[var(--border-strong)]",
  danger:
    "bg-transparent text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]",
  subtle: "bg-[var(--surface-2)] text-[var(--fg)] border border-transparent hover:bg-[var(--border)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-9 px-3.5 text-sm rounded-[10px] gap-2",
  icon: "h-9 w-9 rounded-[10px] justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors select-none",
        "disabled:pointer-events-none disabled:opacity-50 focus-ring",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
