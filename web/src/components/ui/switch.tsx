import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full",
        "border border-transparent transition-colors focus-ring",
        "data-[state=unchecked]:bg-[var(--border-strong)] data-[state=checked]:bg-[var(--brand)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-sm",
          "transition-transform data-[state=unchecked]:translate-x-[2px] data-[state=checked]:translate-x-[20px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
