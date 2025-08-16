import * as React from "react"
import { cn } from "../lib/utils"

const TabsContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

interface ITabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export function Tabs({ 
  value: controlledValue, 
  defaultValue, 
  onValueChange, 
  className,
  children,
  ...props 
}: ITabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const value = controlledValue ?? uncontrolledValue

  const handleValueChange = React.useCallback((newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue)
    }
    onValueChange?.(newValue)
  }, [controlledValue, onValueChange])

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-gray-900/50 p-1 text-gray-400",
        className
      )}
      {...props}
    />
  )
}

interface ITabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabsTrigger({ 
  value, 
  className,
  children,
  ...props 
}: ITabsTriggerProps) {
  const context = React.useContext(TabsContext)
  const isSelected = context.value === value

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isSelected
          ? "bg-gray-800 text-gray-100 shadow-sm"
          : "text-gray-400 hover:text-gray-200",
        className
      )}
      onClick={() => context.onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  )
}

interface ITabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({ 
  value, 
  className,
  children,
  ...props 
}: ITabsContentProps) {
  const context = React.useContext(TabsContext)
  const isSelected = context.value === value

  if (!isSelected) return null

  return (
    <div
      className={cn("mt-2 ring-offset-background focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  )
}