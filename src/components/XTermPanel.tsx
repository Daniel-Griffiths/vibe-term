import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Terminal as TerminalIcon } from "lucide-react";
import type { Project } from "../types";
import "@xterm/xterm/css/xterm.css";

interface XTermPanelProps {
  selectedProject: Project | null;
  projects: Project[];
  onClearOutput: (projectId: string) => void;
  onStopProject: (projectId: string) => void;
}

export default function XTermPanel({
  selectedProject,
  projects,
  onClearOutput,
  onStopProject,
}: XTermPanelProps) {
  const terminalsRef = useRef<
    Map<
      string,
      { terminal: Terminal; fitAddon: FitAddon; element: HTMLDivElement }
    >
  >(new Map());
  const currentLineRef = useRef<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Create terminals for all projects
  useEffect(() => {
    if (!containerRef.current) return;

    projects.forEach((project) => {
      if (!terminalsRef.current.has(project.id)) {
        // Create terminal element
        const element = document.createElement("div");
        element.style.width = "100%";
        element.style.height = "100%";
        element.style.display = "none";
        // No padding - Claude draws its own UI borders
        containerRef.current?.appendChild(element);

        // Create terminal instance
        const terminal = new Terminal({
          theme: {
            background: "#000000",
            foreground: "#22c55e",
            cursor: "#22c55e",
            selectionBackground: "rgba(255, 255, 255, 0.3)",
          },
          fontFamily:
            '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace',
          fontSize: 14,
          cursorBlink: true,
          convertEol: true,
          scrollback: 1000,
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(element);

        // Handle keyboard input - pass all input directly to PTY for interactive apps
        const projectId = project.id;
        terminal.onData((data) => {
          // Pass all input directly to the PTY process (Claude Code handles its own input)
          window.electronAPI?.sendInput(projectId, data);
        });

        terminalsRef.current.set(project.id, { terminal, fitAddon, element });
      }
    });

    // Set up global output listener
    const unsubscribe = window.electronAPI?.onTerminalOutput((output: any) => {
      const instance = terminalsRef.current.get(output.projectId);
      if (instance) {
        instance.terminal.write(output.data);
      }
    });

    const handleResize = () => {
      terminalsRef.current.forEach((instance) => {
        instance.fitAddon.fit();
      });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      unsubscribe?.();
      window.removeEventListener("resize", handleResize);
    };
  }, [projects]);

  // Show/hide terminals based on selected project
  useEffect(() => {
    currentLineRef.current = "";

    terminalsRef.current.forEach((instance, projectId) => {
      if (projectId === selectedProject?.id) {
        instance.element.style.display = "block";
        instance.fitAddon.fit();
      } else {
        instance.element.style.display = "none";
      }
    });
  }, [selectedProject]);

  // Track previous project statuses to detect when a project is stopped
  const prevProjectsRef = useRef<Project[]>([]);
  
  useEffect(() => {
    // Clear terminal when project transitions from running/working to idle
    projects.forEach((project) => {
      const prevProject = prevProjectsRef.current.find(p => p.id === project.id);
      const wasRunning = prevProject && (prevProject.status === 'running' || prevProject.status === 'working' || prevProject.status === 'ready');
      const nowIdle = project.status === 'idle';
      
      if (wasRunning && nowIdle) {
        const instance = terminalsRef.current.get(project.id);
        if (instance) {
          // Wait a moment for any final output (like "Terminal session ended") to appear
          setTimeout(() => {
            instance.terminal.clear();
          }, 500);
        }
      }
    });
    
    // Update previous projects reference
    prevProjectsRef.current = [...projects];
  }, [projects]);

  if (!selectedProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-gray-400 glass-card p-8 rounded-xl">
          <TerminalIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2 text-gray-200">
            No Project Selected
          </h3>
          <p className="text-sm">
            Select a project from the sidebar to view its terminal
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Card
        className="flex-1 m-4 flex flex-col glass-card overflow-hidden"
        style={{ width: "calc(100vw - 350px)" }}
      >
        <CardHeader className="flex-shrink-0 pb-3 bg-gradient-to-r from-black to-gray-900 border-b border-gray-800 rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-200 font-semibold">
              <TerminalIcon className="h-5 w-5 text-green-400" />
              {selectedProject.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  selectedProject.status === "running"
                    ? "bg-green-400 animate-pulse"
                    : selectedProject.status === "completed"
                    ? "bg-blue-400"
                    : selectedProject.status === "error"
                    ? "bg-red-400"
                    : "bg-gray-500"
                }`}
              />
              <span className="text-sm text-gray-300 capitalize font-medium">
                {selectedProject.status}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-400 font-mono">
            {selectedProject.path}
          </p>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden"
            style={{
              minHeight: "400px",
              maxHeight: "100%",
              backgroundColor: "#000000",
              paddingLeft: "16px",
              paddingTop: "16px",
              paddingBottom: "16px",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
