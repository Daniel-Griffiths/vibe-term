import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import XTermPanel from "./XTermPanel";
import GitDiffView from "./GitDiffView";
import { Terminal, GitBranch, Copy, Check, Globe, RotateCcw, Code } from "lucide-react";
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
  const [webviewRef, setWebviewRef] = useState<any>(null);

  const handleWebviewReload = () => {
    if (webviewRef) {
      webviewRef.reload();
    }
  };

  const handleOpenDevTools = () => {
    if (webviewRef) {
      webviewRef.openDevTools();
    }
  };

  const handleCopyTmuxCommand = async () => {
    if (!selectedProject) return;
    
    // Match the tmux session name format used in the Electron main process
    const sessionBase = selectedProject.name || selectedProject.id;
    const tmuxSessionName = sessionBase.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const command = `tmux attach-session -t ${tmuxSessionName}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-gray-900/50 border border-gray-800">
              <TabsTrigger value="terminal" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Terminal
              </TabsTrigger>
              <TabsTrigger value="git-diff" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Git Diff
              </TabsTrigger>
              {selectedProject?.previewUrl && (
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Preview
                </TabsTrigger>
              )}
            </TabsList>
            
            {selectedProject && (
              <div className="relative">
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-md pl-3 pr-10 h-10 text-sm text-gray-300 font-mono">
                  tmux attach-session -t {(selectedProject.name || selectedProject.id).toLowerCase().replace(/[^a-z0-9]/g, '-')}
                </div>
                <Button
                  size="sm"
                  onClick={handleCopyTmuxCommand}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 bg-transparent hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors rounded"
                  title="Copy tmux command"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
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
              display: activeTab === "terminal" ? "block" : "none"
            }}
          >
            <XTermPanel
              selectedProject={selectedProject}
              projects={projects}
            />
          </div>
          
          {activeTab === "git-diff" && (
            <div className="flex-1">
              <GitDiffView selectedProject={selectedProject} />
            </div>
          )}
          
          {activeTab === "preview" && selectedProject?.previewUrl && (
            <div className="flex-1 flex flex-col p-4">
              <div className="flex-1 flex flex-col glass-card overflow-hidden">
                {/* URL Bar */}
                <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-gray-300 font-mono">
                      {selectedProject.previewUrl}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleWebviewReload}
                      className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
                      title="Reload webview"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleOpenDevTools}
                      className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
                      title="Open DevTools"
                    >
                      <Code className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Webview */}
                <webview
                  ref={setWebviewRef}
                  src={selectedProject.previewUrl}
                  className="flex-1 border-0 bg-white rounded-b-lg"
                  title={`Preview for ${selectedProject.name}`}
                />
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}