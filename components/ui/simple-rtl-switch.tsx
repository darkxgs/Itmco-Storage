"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SimpleRTLSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

const SimpleRTLSwitch = React.forwardRef<HTMLButtonElement, SimpleRTLSwitchProps>(
  ({ checked, onCheckedChange, disabled = false, size = "md", className }, ref) => {
    const sizeClasses = {
      sm: { root: "h-4 w-7", thumb: "h-3 w-3" },
      md: { root: "h-6 w-11", thumb: "h-5 w-5" },
      lg: { root: "h-7 w-14", thumb: "h-6 w-6" }
    }

    const handleClick = () => {
      if (!disabled) {
        onCheckedChange(!checked)
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-green-600" : "bg-slate-600",
          sizeClasses[size].root,
          className
        )}
      >
        <span
          className={cn(
            "pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
            sizeClasses[size].thumb,
            // في RTL: النشط (checked) = يسار، غير النشط (unchecked) = يمين
            checked 
              ? "translate-x-0" // النشط: الدائرة على اليسار
              : size === "sm" 
                ? "translate-x-3" // غير النشط: الدائرة على اليمين
                : size === "md" 
                  ? "translate-x-5" 
                  : "translate-x-7"
          )}
        />
      </button>
    )
  }
)

SimpleRTLSwitch.displayName = "SimpleRTLSwitch"

export { SimpleRTLSwitch }