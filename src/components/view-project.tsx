import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Input } from "./input";
import { Button } from "./button";
import ViewTerminal from "./view-terminal";
import ViewGitDiff from "./view-git-diff";
import ViewFileEditor from "./view-file-editor";
import ViewWebview from "./view-webview";
import { NonIdealState } from "./non-ideal-state";
import { Terminal, GitBranch, Globe, FileText } from "lucide-react";
import type { UnifiedItem } from "../types";

interface IViewProjectProps {
  selectedItem: UnifiedItem | null;
  items: UnifiedItem[];
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

export default function ViewProject({
  selectedItem,
  items,
  sidebarOpen,
  setSidebarOpen,
}: IViewProjectProps) {
  const [activeTab, setActiveTab] = useState(() => {
    return selectedItem?.type === "panel" ? "preview" : "terminal";
  });
  const [localIp, setLocalIp] = useState<string>("localhost");
  const [webPort] = useState(6969); // Default web server port

  const currentItem = selectedItem;
  const previewUrl = useMemo(() => currentItem?.url, [currentItem?.url]);
  const webUrl = useMemo(
    () => `http://${localIp}:${webPort}`,
    [localIp, webPort]
  );
  const isPanel = useMemo(
    () => selectedItem?.type === "panel",
    [selectedItem?.type]
  );

  // Fetch local IP when component mounts
  const fetchLocalIp = useCallback(async () => {
    if (window.electronAPI?.getLocalIp) {
      try {
        const result = await window.electronAPI.getLocalIp();
        setLocalIp(result.localIp);
      } catch (error) {
        console.error("Failed to fetch local IP:", error);
      }
    }
  }, []);

  useEffect(() => {
    fetchLocalIp();
  }, [fetchLocalIp]);

  // Shared component for no URL state
  const NoUrlConfigured = useCallback(
    ({ itemType }: { itemType: "panel" | "project" }) => (
      <NonIdealState
        icon={Globe}
        title={`No ${itemType === "panel" ? "URL" : "Preview URL"} Configured`}
        description={`Configure a ${
          itemType === "panel" ? "URL" : "preview URL"
        } in your ${itemType} settings to view${
          itemType === "panel" ? " content" : " your application"
        } here.${
          itemType === "project" ? " Example: http://localhost:3000" : ""
        }`}
      />
    ),
    []
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
          <div className="px-4 pt-4 mb-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <Button
                  onClick={() => setSidebarOpen?.(!sidebarOpen)}
                  variant="ghost"
                  size="icon"
                  className="lg:hidden bg-gray-800/50 border border-gray-700/50 flex-shrink-0 h-10"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </Button>

                <TabsList className="bg-gray-900/50 border border-gray-800 flex-shrink-0 overflow-hidden">
                  <TabsTrigger
                    value="terminal"
                    className="flex items-center gap-2 whitespace-nowrap"
                  >
                    <Terminal className="h-4 w-4" />
                    <span className="hidden sm:inline">Terminal</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="git-diff"
                    className="flex items-center gap-2 whitespace-nowrap"
                  >
                    <GitBranch className="h-4 w-4" />
                    <span className="hidden sm:inline">Git Diff</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="editor"
                    className="flex items-center gap-2 whitespace-nowrap"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Editor</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="preview"
                    className={`flex items-center gap-2 whitespace-nowrap`}
                    disabled={!previewUrl}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="hidden lg:block">
                <Input
                  value={webUrl}
                  hasCopy
                  className="font-mono text-sm w-auto min-w-64"
                />
              </div>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="h-full flex-1 flex flex-col">
          {isPanel ? (
            /* Panel mode - show preview directly */
            <div className="h-full flex-1 flex flex-col p-4 pt-0">
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
                <div className="flex-1 flex flex-col p-4 pt-0">
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
