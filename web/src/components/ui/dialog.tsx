import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  footer,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(520px,94vw)] -translate-x-1/2 -translate-y-1/2",
          "flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]",
          "shadow-[0_24px_70px_-20px_rgb(0_0_0/0.7)]",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <DialogPrimitive.Title className="text-[15px] font-semibold text-[var(--fg)]">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-[13px] text-[var(--fg-muted)]">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close className="rounded-lg p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)] focus-ring">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
