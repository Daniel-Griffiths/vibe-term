import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Button } from "./button";
import ViewTerminal from "./view-terminal";
import ViewGitDiff from "./view-git-diff";
import ViewFileEditor from "./view-file-editor";
import ViewWebview from "./view-webview";
import { NonIdealState } from "./non-ideal-state";
import {
  Terminal,
  GitBranch,
  Copy,
  Check,
  Globe,
  FileText,
} from "lucide-react";
import type { UnifiedItem } from "../types";

interface IViewProjectProps {
  selectedItem: UnifiedItem | null;
  items: UnifiedItem[];
}

export default function ViewProject({
  selectedItem,
  items,
}: IViewProjectProps) {
  const isPanel = selectedItem?.type === "panel";
  const [activeTab, setActiveTab] = useState(isPanel ? "preview" : "terminal");
  const [copied, setCopied] = useState(false);

  const currentItem = selectedItem;
  const previewUrl = currentItem?.url;

  const handleCopyTmuxCommand = async () => {
    if (!currentItem || currentItem.type !== "project") return;

    // Match the tmux session name format used in the Electron main process
    const sessionBase = currentItem.name || currentItem.id;
    const tmuxSessionName = sessionBase
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    const command = `tmux attach-session -t ${tmuxSessionName}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Shared component for no URL state  
  const NoUrlConfigured = ({ itemType }: { itemType: "panel" | "project" }) => (
    <NonIdealState
      icon={Globe}
      title={`No ${itemType === "panel" ? "URL" : "Preview URL"} Configured`}
      description={
        <>
          Configure a {itemType === "panel" ? "URL" : "preview URL"} in your{" "}
          {itemType} settings to view
          {itemType === "panel" ? " content" : " your application"} here.
          {itemType === "project" && (
            <span className="block mt-2 text-xs text-gray-600">
              Example: http://localhost:3000
            </span>
          )}
        </>
      }
    />
  );

  // Shared WebView component
  const WebViewContent = () => {
    if (!previewUrl) {
      return <NoUrlConfigured itemType={currentItem?.type || "project"} />;
    }

    const title = isPanel
      ? currentItem?.name || ""
      : `Preview for ${currentItem?.name || ""}`;

    return <ViewWebview url={previewUrl} title={title} />;
  };

  return (
    <div className="h-full flex-1 flex flex-col">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        {/* Tab bar - only show for projects */}
        {!isPanel && currentItem?.type === "project" && (
          <div className="px-4 pt-4">
            <div className="flex items-start justify-between">
              <TabsList className="bg-gray-900/50 border border-gray-800 mb-4">
                <TabsTrigger
                  value="terminal"
                  className="flex items-center gap-2"
                >
                  <Terminal className="h-4 w-4" />
                  Terminal
                </TabsTrigger>
                <TabsTrigger
                  value="git-diff"
                  className="flex items-center gap-2"
                >
                  <GitBranch className="h-4 w-4" />
                  Git Diff
                </TabsTrigger>
                <TabsTrigger value="editor" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className={`flex items-center gap-2`}
                  disabled={!previewUrl}
                >
                  <Globe className="h-4 w-4" />
                  Preview
                </TabsTrigger>
              </TabsList>

              {/* Tmux command display */}
              <div className="relative">
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-md pl-3 pr-10 h-10 text-sm text-gray-300 font-mono">
                  tmux attach-session -t{" "}
                  {(currentItem.name || currentItem.id)
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "-")}
                </div>
                <Button
                  size="sm"
                  onClick={handleCopyTmuxCommand}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 bg-transparent hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors rounded"
                  title="Copy tmux command"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="h-full flex-1 flex flex-col">
          {isPanel ? (
            /* Panel mode - show preview directly */
            <div className="h-full flex-1 flex flex-col p-4">
              <WebViewContent />
            </div>
          ) : (
            /* Project mode - show tabbed content */
            <>
              {/* Terminal tab */}
              <div
                className="flex-1 h-full"
                style={{
                  display: activeTab === "terminal" ? "block" : "none",
                }}
              >
                <ViewTerminal
                  selectedProject={currentItem}
                  projects={items.filter((item) => item.type === "project")}
                />
              </div>

              {/* Git diff tab */}
              {activeTab === "git-diff" && (
                <div className="flex-1 h-full">
                  <ViewGitDiff selectedProject={currentItem} />
                </div>
              )}

              {/* Editor tab */}
              {activeTab === "editor" && (
                <div className="flex-1 h-full">
                  <ViewFileEditor selectedProject={currentItem} />
                </div>
              )}

              {/* Preview tab */}
              {activeTab === "preview" && (
                <div className="flex-1 flex flex-col p-4">
                  <WebViewContent />
                </div>
              )}
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
