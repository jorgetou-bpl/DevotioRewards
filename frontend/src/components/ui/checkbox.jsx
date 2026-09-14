import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Explicit brand colors, not bg-primary/text-primary-foreground: this
      // app's :root defines --primary twice (a hex brand value, unlayered,
      // and an HSL shadcn-convention value inside @layer base) — unlayered
      // CSS always wins the cascade regardless of source order, so
      // hsl(var(--primary)) resolves to the invalid hsl(#0B0B16) and the
      // checked state rendered with no visible checkmark.
      "peer h-4 w-4 shrink-0 rounded-sm border-2 border-zinc-300 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#0B0B16] data-[state=checked]:border-[#0B0B16] data-[state=checked]:text-white",
      className
    )}
    {...props}>
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
