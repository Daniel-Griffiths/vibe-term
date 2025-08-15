import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import XTermPanel from "./x-term-panel";
import GitDiffView from "./git-diff-view";
import FileEditorView from "./file-editor-view";
import SharedWebView from "./shared-webview";
import {
  Terminal,
  GitBranch,
  Copy,
  Check,
  Globe,
  FileText,
} from "lucide-react";
import type { Project } from "../types";

interface ProjectViewProps {
  selectedProject: Project | null;
  projects: Project[];
}

export default function ProjectView({
  selectedProject,
  projects,
}: ProjectViewProps) {
  const [activeTab, setActiveTab] = useState("terminal");
  const [copied, setCopied] = useState(false);

  const handleCopyTmuxCommand = async () => {
    if (!selectedProject) return;

    // Match the tmux session name format used in the Electron main process
    const sessionBase = selectedProject.name || selectedProject.id;
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

  return (
    <div className="flex-1 flex flex-col">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <div className="px-4 pt-4">
          <div className="flex items-start justify-between">
            <TabsList className="bg-gray-900/50 border border-gray-800 mb-4">
              <TabsTrigger value="terminal" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Terminal
              </TabsTrigger>
              <TabsTrigger value="git-diff" className="flex items-center gap-2">
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
                disabled={!selectedProject?.previewUrl}
              >
                <Globe className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            {selectedProject && (
              <div className="relative">
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-md pl-3 pr-10 h-10 text-sm text-gray-300 font-mono">
                  tmux attach-session -t{" "}
                  {(selectedProject.name || selectedProject.id)
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
            )}
          </div>
        </div>

        {/* Keep both views mounted but only show the active one */}
        <div className="flex-1 flex flex-col">
          <div
            className="flex-1"
            style={{
              display: activeTab === "terminal" ? "block" : "none",
            }}
          >
            <XTermPanel selectedProject={selectedProject} projects={projects} />
          </div>

          {activeTab === "git-diff" && (
            <div className="flex-1">
              <GitDiffView selectedProject={selectedProject} />
            </div>
          )}

          {activeTab === "editor" && (
            <div className="flex-1">
              <FileEditorView selectedProject={selectedProject} />
            </div>
          )}

          {activeTab === "preview" && (
            <div className="flex-1 flex flex-col p-4">
              {selectedProject?.previewUrl ? (
                <SharedWebView
                  url={selectedProject.previewUrl}
                  title={`Preview for ${selectedProject.name}`}
                />
              ) : (
                /* No Preview URL Configured */
                <div className="flex-1 flex flex-col glass-card overflow-hidden">
                  <div className="flex-1 flex items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <Globe className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-300 mb-2">
                        No Preview URL Configured
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Configure a preview URL in your project settings to view
                        your application here.
                      </p>
                      <p className="text-sm text-gray-600">
                        Example: http://localhost:3000
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
