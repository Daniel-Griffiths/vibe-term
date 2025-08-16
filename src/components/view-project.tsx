import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Input } from "./input";
import ViewTerminal from "./view-terminal";
import ViewGitDiff from "./view-git-diff";
import ViewFileEditor from "./view-file-editor";
import ViewWebview from "./view-webview";
import { NonIdealState } from "./non-ideal-state";
import {
  Terminal,
  GitBranch,
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
  const [activeTab, setActiveTab] = useState(() => {
    return selectedItem?.type === "panel" ? "preview" : "terminal";
  });
  const [localIp, setLocalIp] = useState<string>("localhost");
  const [webPort] = useState(6969); // Default web server port

  const currentItem = selectedItem;
  const previewUrl = useMemo(() => currentItem?.url, [currentItem?.url]);
  const webUrl = useMemo(() => `http://${localIp}:${webPort}`, [localIp, webPort]);
  const isPanel = useMemo(() => selectedItem?.type === "panel", [selectedItem?.type]);

  // Fetch local IP when component mounts
  const fetchLocalIp = useCallback(async () => {
    if (window.electronAPI?.getLocalIp) {
      try {
        const result = await window.electronAPI.getLocalIp();
        setLocalIp(result.localIp);
      } catch (error) {
        console.error('Failed to fetch local IP:', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchLocalIp();
  }, [fetchLocalIp]);


  // Shared component for no URL state  
  const NoUrlConfigured = useCallback(({ itemType }: { itemType: "panel" | "project" }) => (
    <NonIdealState
      icon={Globe}
      title={`No ${itemType === "panel" ? "URL" : "Preview URL"} Configured`}
      description={`Configure a ${itemType === "panel" ? "URL" : "preview URL"} in your ${itemType} settings to view${itemType === "panel" ? " content" : " your application"} here.${itemType === "project" ? " Example: http://localhost:3000" : ""}`}
    />
  ), []);

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

              {/* Web URL display */}
              <Input
                value={webUrl}
                hasCopy
                className="font-mono text-sm"
              />
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
