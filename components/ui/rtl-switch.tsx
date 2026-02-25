"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

interface RTLSwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  label?: string
  labelPosition?: "left" | "right"
  size?: "sm" | "md" | "lg"
}

const RTLSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  RTLSwitchProps
>(({ className, label, labelPosition = "right", size = "md", ...props }, ref) => {
  const sizeClasses = {
    sm: {
      root: "h-4 w-7",
      thumb: "h-3 w-3"
    },
    md: {
      root: "h-6 w-11", 
      thumb: "h-5 w-5"
    },
    lg: {
      root: "h-7 w-14",
      thumb: "h-6 w-6"
    }
  }

  const switchElement = (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-slate-600",
        sizeClasses[size].root,
        className,
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
          // Default LTR behavior: unchecked = left (0), checked = right
          "data-[state=unchecked]:translate-x-0",
          // RTL behavior: unchecked = right, checked = left (0)
          "[dir=rtl]:data-[state=unchecked]:translate-x-5 [dir=rtl]:data-[state=checked]:translate-x-0",
          // Size-specific translations for LTR
          size === "sm" && "data-[state=checked]:translate-x-3",
          size === "md" && "data-[state=checked]:translate-x-5", 
          size === "lg" && "data-[state=checked]:translate-x-7",
          sizeClasses[size].thumb
        )}
      />
    </SwitchPrimitives.Root>
  )

  if (!label) {
    return switchElement
  }

  return (
    <div className={cn(
      "flex items-center gap-3",
      labelPosition === "right" ? "flex-row-reverse" : "flex-row"
    )} dir="rtl">
      {labelPosition === "right" && (
        <label className="text-sm font-medium text-slate-300 cursor-pointer select-none">
          {label}
        </label>
      )}
      {switchElement}
      {labelPosition === "left" && (
        <label className="text-sm font-medium text-slate-300 cursor-pointer select-none">
          {label}
        </label>
      )}
    </div>
  )
})

RTLSwitch.displayName = "RTLSwitch"

export { RTLSwitch }