import { Icon } from "./icon";
import type { UnifiedItem } from "../types";

interface IStatusIconProps {
  status: UnifiedItem["status"];
}

export function StatusIcon({ status }: IStatusIconProps) {
  switch (status) {
    case "running":
      return (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-3 w-3 border border-blue-400 border-t-transparent"></div>
        </div>
      );
    case "working":
      return (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-3 w-3 border border-yellow-400 border-t-transparent"></div>
        </div>
      );
    case "ready":
      return (
        <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
      );
    case "completed":
      return <Icon name="checkcircle" className="h-4 w-4 text-green-500" />;
    default:
      return <div className="h-2 w-2 rounded-full bg-gray-500" />;
  }
}