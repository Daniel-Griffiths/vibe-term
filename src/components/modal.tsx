import type { ReactNode } from "react";
import { X, AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import { Button } from "./button";

interface IModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
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

const intentIcons = {
  default: null,
  warning: AlertTriangle,
  danger: XCircle,
  success: CheckCircle,
  info: Info,
};

const intentColors = {
  default: "text-gray-100",
  warning: "text-orange-400",
  danger: "text-red-400", 
  success: "text-green-400",
  info: "text-blue-400",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
  showCloseButton = true,
  maxWidth = "md",
  intent = "default",
}: IModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className={`relative glass-card rounded-xl ${maxWidthClasses[maxWidth]} w-full mx-4 border border-white/10 ${className}`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 pb-0">
            <div className="flex items-center gap-3">
              {(() => {
                const IconComponent = intentIcons[intent];
                return IconComponent ? (
                  <IconComponent className={`h-5 w-5 ${intentColors[intent]}`} />
                ) : null;
              })()}
              <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
            </div>
            {showCloseButton && (
              <Button
                onClick={onClose}
                size="sm"
                variant="ghost"
                className="p-1 hover:bg-gray-800 rounded-lg"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
        
        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}