import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50"
    
    const variantClasses = {
      default: "bg-blue-600/80 backdrop-blur-sm text-white shadow hover:bg-blue-700/80 border border-blue-500/30",
      destructive: "bg-red-600/80 backdrop-blur-sm text-white shadow-sm hover:bg-red-700/80 border border-red-500/30",
      outline: "border border-gray-600/50 bg-gray-800/30 backdrop-blur-sm text-gray-100 shadow-sm hover:bg-gray-700/40 hover:text-gray-100",
      secondary: "bg-gray-700/50 backdrop-blur-sm text-gray-100 shadow-sm hover:bg-gray-600/60 border border-gray-600/30",
      ghost: "hover:bg-gray-700/30 backdrop-blur-sm hover:text-gray-100",
    }
    
    const sizeClasses = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    }

    return (
      <button
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }