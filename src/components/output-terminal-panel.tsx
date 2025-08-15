import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { FileCode } from "lucide-react";
import type { Project } from "../types";
import "@xterm/xterm/css/xterm.css";

interface OutputTerminalPanelProps {
  selectedProject: Project | null;
  projects: Project[];
}

export default function OutputTerminalPanel({
  selectedProject,
  projects,
}: OutputTerminalPanelProps) {
  const terminalsRef = useRef<
    Map<
      string,
      { terminal: Terminal; fitAddon: FitAddon; element: HTMLDivElement }
    >
  >(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Create output terminals for projects with run commands
  useEffect(() => {
    if (!containerRef.current) return;

    projects.forEach((project) => {
      if (project.runCommand && !terminalsRef.current.has(project.id)) {
        // Create terminal element
        const element = document.createElement("div");
        element.style.width = "100%";
        element.style.height = "100%";
        element.style.display = "none";
        containerRef.current?.appendChild(element);

        // Create terminal instance
        const terminal = new Terminal({
          theme: {
            background: "#0a0a0a",
            foreground: "#e0e0e0",
            cursor: "#e0e0e0",
            selectionBackground: "rgba(255, 255, 255, 0.2)",
          },
          fontFamily:
            '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace',
          fontSize: 14,
          cursorBlink: false,
          convertEol: true,
          scrollback: 5000,
          disableStdin: true, // Output only, no input
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(element);

        terminalsRef.current.set(project.id, { terminal, fitAddon, element });
      }
    });

    // Set up background output listener
    const unsubscribe = window.electronAPI?.onBackgroundOutput?.(
      (output: any) => {
        const instance = terminalsRef.current.get(output.projectId);
        if (instance) {
          instance.terminal.write(output.data);
        }
      }
    );

    const handleResize = () => {
      terminalsRef.current.forEach((instance) => {
        instance.fitAddon.fit();
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener("resize", handleResize);
    };
  }, [projects]);

  // Show/hide terminals based on selected project
  useEffect(() => {
    terminalsRef.current.forEach((instance, projectId) => {
      if (projectId === selectedProject?.id) {
        instance.element.style.display = "block";
        // Delay fit() to allow the element to render after being shown
        setTimeout(() => {
          instance.fitAddon.fit();
        }, 10);
      } else {
        instance.element.style.display = "none";
      }
    });
  }, [selectedProject]);

  // Track previous project statuses to clear terminal when stopped
  const prevProjectsRef = useRef<Project[]>([]);

  useEffect(() => {
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
        const instance = terminalsRef.current.get(project.id);
        if (instance) {
          setTimeout(() => {
            instance.terminal.clear();
          }, 500);
        }
      }
    });

    prevProjectsRef.current = [...projects];
  }, [projects]);

  if (!selectedProject?.runCommand) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-gray-400 glass-card p-8 rounded-xl">
          <FileCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2 text-gray-200">
            No Output Available
          </h3>
          <p className="text-sm">
            This project doesn't have a run command configured
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Card
        className="flex-1 m-4 mt-0 flex flex-col glass-card overflow-hidden"
        style={{ width: "calc(100vw - 350px)" }}
      >
        <CardHeader className="flex-shrink-0 py-3 bg-gradient-to-r from-gray-900 to-black border-b border-gray-800 rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-200 font-semibold">
              <FileCode className="h-5 w-5 text-blue-400" />
              {selectedProject.name} - Output
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
            {selectedProject.runCommand}
          </p>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden"
            style={{
              minHeight: "400px",
              maxHeight: "100%",
              backgroundColor: "#0a0a0a",
              paddingLeft: "16px",
              paddingRight: "16px",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
