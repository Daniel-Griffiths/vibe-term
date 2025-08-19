import { cva, type VariantProps } from "class-variance-authority";
import {
  useState,
  useContext,
  useCallback,
  createContext,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";

const TabsContext = createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

const tabsVariants = cva("w-full");

const tabsListVariants = cva(
  "inline-flex h-10 items-center justify-center rounded-md bg-gray-900/50 p-1 text-gray-400"
);

const tabsContentVariants = cva(
  "mt-2 ring-offset-background focus-visible:outline-none"
);

interface ITabsProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: ITabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;

  const handleValueChange = useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [controlledValue, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={tabsVariants({ className })} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={tabsListVariants({ className })}
      {...props}
    />
  );
}

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      state: {
        active: "bg-gray-800 text-gray-100 shadow-sm",
        inactive: "text-gray-400 hover:text-gray-200",
      },
    },
    defaultVariants: {
      state: "inactive",
    },
  }
);

interface ITabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: ITabsTriggerProps) {
  const context = useContext(TabsContext);
  const isSelected = context.value === value;

  return (
    <button
      className={tabsTriggerVariants({ 
        state: isSelected ? "active" : "inactive",
        className 
      })}
      onClick={() => context.onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  );
}

interface ITabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: ITabsContentProps) {
  const context = useContext(TabsContext);
  const isSelected = context.value === value;

  if (!isSelected) return null;

  return (
    <div
      className={tabsContentVariants({ className })}
      {...props}
    >
      {children}
    </div>
  );
}
