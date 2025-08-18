import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Input } from "./input";
import { ViewTerminal, type ViewTerminalRef } from "./view-terminal";
import { ViewGitDiff } from "./view-git-diff";
import { ViewFileEditor } from "./view-file-editor";
import { ViewWebview } from "./view-webview";
import { communicationAPI } from "../utils/communication";
import { Terminal, GitBranch, Globe, FileText } from "lucide-react";
import type { UnifiedItem } from "../types";
import { ItemType } from "../types";

enum ProjectTab {
  TERMINAL = "terminal",
  GIT_DIFF = "git-diff",
  EDITOR = "editor",
  PREVIEW = "preview",
}

interface IViewProjectProps {
  selectedItem: UnifiedItem | null;
  items: UnifiedItem[];
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

export function ViewProject({
  selectedItem,
  items,
}: IViewProjectProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>(() => {
    return ProjectTab.TERMINAL;
  });
  const [localIp, setLocalIp] = useState<string>("localhost");
  const [webPort] = useState(6969); // Default web server port
  const terminalRef = useRef<ViewTerminalRef>(null);

  const currentItem = selectedItem;
  const previewUrl = useMemo(() => currentItem?.url, [currentItem?.url]);
  const webUrl = useMemo(
    () => `http://${localIp}:${webPort}`,
    [localIp, webPort]
  );
  const isPanel = useMemo(
    () => selectedItem?.type === ItemType.PANEL,
    [selectedItem?.type]
  );

  // Fetch local IP when component mounts
  const fetchLocalIp = useCallback(async () => {
    try {
      const result = await communicationAPI.getLocalIp();
      if (result?.success && result?.data) {
        setLocalIp(result.data.localIp);
      }
    } catch (error) {
      console.error("Failed to fetch local IP:", error);
    }
  }, []);

  useEffect(() => {
    fetchLocalIp();
  }, [fetchLocalIp]);

  // Handle terminal resize when switching back to terminal tab
  useEffect(() => {
    if (
      activeTab === ProjectTab.TERMINAL &&
      currentItem &&
      terminalRef.current
    ) {
      // Small delay to ensure the terminal container is visible before resizing
      const timer = setTimeout(() => {
        terminalRef.current?.fitTerminal(currentItem.id);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [activeTab, currentItem?.id, currentItem]);

  return (
    <div className="h-full flex-1 flex flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value as ProjectTab)}
        className="flex-1 flex flex-col"
      >
        {/* Tab bar - only show for projects */}
        {isPanel ? (
          <div className="h-4" />
        ) : (
          currentItem?.type === ItemType.PROJECT && (
            <div className="px-0 md:px-4 pt-0 md:pt-4 mb-0 md:mb-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center w-full md:w-auto">
                  <TabsList className="bg-gray-900/50 md:border border-gray-800 flex-shrink-0 overflow-hidden w-full md:w-auto m-0 mdp-0 md:p-1 rounded-none md:rounded-md h-10 md:h-auto px-2 ">
                    <TabsTrigger
                      value={ProjectTab.TERMINAL}
                      className="flex items-center gap-2 whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start"
                    >
                      <Terminal className="h-4 w-4" />
                      <span className="hidden sm:inline">Terminal</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value={ProjectTab.GIT_DIFF}
                      className="flex items-center gap-2 whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start"
                    >
                      <GitBranch className="h-4 w-4" />
                      <span className="hidden sm:inline">Git Diff</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value={ProjectTab.EDITOR}
                      className="flex items-center gap-2 whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Editor</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value={ProjectTab.PREVIEW}
                      className={`flex items-center gap-2 whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start`}
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
          )
        )}

        <div className="h-full flex-1 flex flex-col">
          <div
            className="flex-1 h-full"
            style={{
              display:
                !isPanel && activeTab === ProjectTab.TERMINAL
                  ? "block"
                  : "none",
            }}
          >
            <ViewTerminal
              ref={terminalRef}
              selectedProject={currentItem}
              projects={items.filter((item) => item.type === ItemType.PROJECT)}
            />
          </div>

          {activeTab === ProjectTab.GIT_DIFF && (
            <div className="flex-1 h-full">
              <ViewGitDiff selectedProject={currentItem} />
            </div>
          )}

          {activeTab === ProjectTab.EDITOR && (
            <div className="flex-1 h-full">
              <ViewFileEditor selectedProject={currentItem} />
            </div>
          )}

          {(activeTab === ProjectTab.PREVIEW || isPanel) && (
            <div className={`flex-1 h-full p-0 md:p-4 md:pt-0`}>
              <ViewWebview url={currentItem?.url || ""} />
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
