import SharedWebView from "./shared-webview";
import { Globe } from "lucide-react";
import { NonIdealState } from "./non-ideal-state";
import type { Panel } from "../types";

interface PanelViewProps {
  panels: Panel[];
  selectedPanel: Panel | null;
}

export default function PanelView({ panels, selectedPanel }: PanelViewProps) {
  return (
    <div className="flex-1 flex flex-col relative">
      {/* Always render all panels, show placeholder when none selected */}
      {!selectedPanel && (
        <div className="absolute inset-0">
          <NonIdealState
            icon={Globe}
            title="No Panel Selected"
            description="Select a panel from the sidebar to view its content"
          />
        </div>
      )}
      
      {/* Render all panels but only show the selected one */}
      {panels.map((panel) => (
        <div
          key={panel.id}
          className="absolute inset-0 flex flex-col p-4"
          style={{
            display: selectedPanel?.id === panel.id ? "flex" : "none",
          }}
        >
          <SharedWebView
            key={panel.id}
            url={panel.url}
            title={panel.name}
          />
        </div>
      ))}
    </div>
  );
}