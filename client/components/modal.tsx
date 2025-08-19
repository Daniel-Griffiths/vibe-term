import { Button } from "./button";
import type { ReactNode } from "react";
import { Icon } from "./icon";

interface IModalProps {
  title: string;
  isOpen: boolean;
  className?: string;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  intent?: "default" | "warning" | "danger" | "success" | "info";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-full",
};

const intentIconNames = {
  info: "info",
  default: null,
  danger: "xcircle",
  success: "checkcircle",
  warning: "alerttriangle",
} as const;

const intentColors = {
  info: "text-blue-400",
  danger: "text-red-400",
  default: "text-gray-100",
  success: "text-green-400",
  warning: "text-orange-400",
};

export function Modal({
  title,
  isOpen,
  onClose,
  children,
  className = "",
  maxWidth = "md",
  intent = "default",
  showCloseButton = true,
}: IModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative glass-card rounded-xl ${maxWidthClasses[maxWidth]} w-full mx-4 border border-white/10 ${className}`}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 pb-0">
            <div className="flex items-center gap-3">
              {intentIconNames[intent] && (
                <Icon
                  name={intentIconNames[intent]!}
                  className={`h-5 w-5 ${intentColors[intent]}`}
                />
              )}
              <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
            </div>
            {showCloseButton && (
              <Button
                onClick={onClose}
                size="sm"
                variant="ghost"
                className="p-1 hover:bg-gray-800 rounded-lg"
              >
                <Icon name="x" className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
