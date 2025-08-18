import { useState, useCallback, forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { Button } from "./button";

export interface IInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasCopy?: boolean;
  onCopy?: () => void;
}

export const Input = forwardRef<HTMLInputElement, IInputProps>(
  ({ className, type, hasCopy, onCopy, ...props }, ref) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
      if (!props.value && !props.defaultValue) return;

      const valueToCopy = String(props.value || props.defaultValue || "");
      try {
        await navigator.clipboard.writeText(valueToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        onCopy?.();
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }, [props.value, props.defaultValue, onCopy]);

    if (hasCopy) {
      return (
        <div className="relative">
          <input
            type={type}
            className={cn(
              "flex h-9 w-auto min-w-full rounded-md border border-gray-600/50 bg-gray-800/30 backdrop-blur-sm text-gray-100 px-3 pr-12 py-1 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:bg-gray-700/40 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            ref={ref}
            readOnly
            size={props.value ? String(props.value).length + 1 : undefined}
            {...props}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCopy}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 p-0 bg-transparent hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors rounded"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-gray-600/50 bg-gray-800/30 backdrop-blur-sm text-gray-100 px-3 py-1 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:bg-gray-700/40 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
