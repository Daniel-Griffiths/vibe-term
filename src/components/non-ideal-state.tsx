import { type LucideProps } from "lucide-react";

export interface NonIdealStateProps {
  icon: React.ComponentType<LucideProps>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles = {
  default: "text-gray-400",
  error: "text-red-400", 
  warning: "text-yellow-400",
  info: "text-blue-400"
};

const sizeStyles = {
  sm: {
    container: "p-6",
    icon: "h-12 w-12",
    title: "text-base",
    description: "text-xs"
  },
  md: {
    container: "p-8", 
    icon: "h-16 w-16",
    title: "text-lg",
    description: "text-sm"
  },
  lg: {
    container: "p-12",
    icon: "h-20 w-20", 
    title: "text-xl",
    description: "text-base"
  }
};

export function NonIdealState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  size = 'md',
  className = ''
}: NonIdealStateProps) {
  const variantClass = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className={`text-center ${variantClass} glass-card ${sizeStyle.container} rounded-xl ${className}`}>
        <Icon className={`${sizeStyle.icon} mx-auto mb-4 opacity-50`} />
        <h3 className={`${sizeStyle.title} font-semibold mb-2 text-gray-200`}>
          {title}
        </h3>
        {description && (
          <p className={`${sizeStyle.description}`}>
            {description}
          </p>
        )}
        {action && (
          <div className="mt-4">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}