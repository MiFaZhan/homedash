import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm",
        "text-[var(--fg)] placeholder:text-[var(--fg-muted)]/70",
        "transition-colors focus-ring focus:border-[var(--brand)]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
