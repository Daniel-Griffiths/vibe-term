import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Terminal as TerminalIcon } from "lucide-react";
import { useTerminalManager } from "../hooks/use-terminal-manager";
import { TerminalService } from "../services/TerminalService";
import { NonIdealState } from "./non-ideal-state";
import type { Project } from "../types";
import "@xterm/xterm/css/xterm.css";

interface XTermPanelProps {
  selectedProject: Project | null;
  projects: Project[];
}

export default function XTermPanel({
  selectedProject,
  projects,
}: XTermPanelProps) {
  const prevProjectsRef = useRef<Project[]>([]);

  // Use the terminal manager hook with Claude configuration
  const { containerRef, showTerminal, clearTerminal } = useTerminalManager(
    projects,
    TerminalService.getClaudeConfig(),
    (output) => {
      // Handle terminal data input (send to Electron)
      window.electronAPI?.sendInput(output.projectId, output.data);
    }
  );

  // Show/hide terminals based on selected project
  useEffect(() => {
    if (selectedProject) {
      showTerminal(selectedProject.id);
    }
  }, [selectedProject, showTerminal]);

  // Track previous project statuses to detect when a project is stopped
  useEffect(() => {
    // Clear terminal when project transitions from running/working to idle
    projects.forEach((project) => {
      const prevProject = prevProjectsRef.current.find(
        (p) => p.id === project.id
      );
      const wasRunning =
        prevProject &&
        (prevProject.status === "running" ||
          prevProject.status === "working" ||
          prevProject.status === "ready");
      const nowIdle = project.status === "idle";

      if (wasRunning && nowIdle) {
        clearTerminal(project.id);
      }
    });

    prevProjectsRef.current = [...projects];
  }, [projects, clearTerminal]);

  if (!selectedProject) {
    return (
      <NonIdealState
        icon={TerminalIcon}
        title="No Project Selected"
        description="Select a project from the sidebar to view its terminal"
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Card
        className="flex-1 m-4 mt-0 flex flex-col glass-card overflow-hidden"
        style={{ width: "calc(100vw - 350px)" }}
      >
        <CardHeader className="flex-shrink-0 py-3 bg-gradient-to-r from-black to-gray-900 border-b border-gray-800 rounded-t-lg">
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
              paddingRight: "16px",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
