import { api } from "../utils/api";
import "@xterm/xterm/css/xterm.css";
import type { UnifiedItem } from "../types";
import { NonIdealState } from "./non-ideal-state";
import { Icon } from "./icon";
import { TerminalService } from "../utils/terminal-service";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import {
  useRef,
  useEffect,
  forwardRef,
  useLayoutEffect,
  useImperativeHandle,
  useCallback,
} from "react";

interface IViewTerminalProps {
  selectedProject: UnifiedItem | null;
  projects: UnifiedItem[];
}

export interface ViewTerminalRef {
  fitTerminal: (projectId: string) => void;
}

import type { TerminalConfig } from "../utils/terminal-service";

export interface TerminalManagerHook {
  hideAllTerminals: () => void;
  fitTerminal: (projectId: string) => void;
  showTerminal: (projectId: string) => void;
  focusTerminal: (projectId: string) => void;
  clearTerminal: (projectId: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  writeToTerminal: (projectId: string, data: string) => void;
  setupDataHandler: (projectId: string, onData: (data: string) => void) => void;
}

function useTerminalManager(
  projects: Project[],
  config: TerminalConfig = {},
  onOutput?: (output: { projectId: string; data: string }) => void
): TerminalManagerHook {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef(TerminalService.createTerminalManager());
  const unsubscribersRef = useRef<Map<string, (() => void)[]>>(new Map());
  const pendingOutputRef = useRef<Map<string, string[]>>(new Map());

  // Lazy creation: only create terminals when they're actually shown
  const createTerminalIfNeeded = useCallback(
    (projectId: string) => {
      if (!containerRef.current) return null;

      const manager = managerRef.current;
      const existing = manager.getTerminal(projectId);

      if (!existing) {
        const instance = manager.createTerminal(
          projectId,
          containerRef.current,
          config
        );

        // Set up data handler if provided
        if (config.interactive !== false) {
          const unsubscriber = TerminalService.setupDataHandler(
            instance.terminal,
            (data) => {
              // Call external handler if provided
              onOutput?.({ projectId, data });
            }
          );

          const projectUnsubscribers =
            unsubscribersRef.current.get(projectId) || [];
          projectUnsubscribers.push(unsubscriber);
          unsubscribersRef.current.set(projectId, projectUnsubscribers);
        }

        // Replay any pending output that arrived before terminal was created
        const pendingOutput = pendingOutputRef.current.get(projectId);
        if (pendingOutput && pendingOutput.length > 0) {
          pendingOutput.forEach((data) => {
            instance.terminal.write(data);
          });
          pendingOutputRef.current.delete(projectId);
        }

        return instance;
      }

      return existing;
    },
    [config, onOutput]
  );

  // Set up external output listeners (e.g., from Electron IPC)
  useEffect(() => {
    if (!api.onTerminalOutput) return;

    const unsubscribe = api.onTerminalOutput((output: any) => {
      const manager = managerRef.current;
      const instance = manager.getTerminal(output.projectId);
      if (instance) {
        instance.terminal.write(output.data);
      } else {
        // Store output for when terminal is created
        const pending = pendingOutputRef.current.get(output.projectId) || [];
        pending.push(output.data);
        pendingOutputRef.current.set(output.projectId, pending);
      }
    });

    return unsubscribe;
  }, []);

  // Track project output for web environment (when WebSocket updates come through project state)
  const lastOutputLengthRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    console.log(
      `[Terminal Manager Debug] useEffect triggered with ${projects.length} projects`
    );
    projects.forEach((project, index) => {
      console.log(
        `[Terminal Manager Debug] Project ${index}: ${
          project.id
        }, output length: ${project.output?.length || 0}`
      );
      if (!project.output || project.output.length === 0) return;

      const lastLength = lastOutputLengthRef.current.get(project.id) || 0;
      const newOutput = project.output.slice(lastLength);

      if (newOutput.length > 0) {
        console.log(
          `[Terminal Manager Debug] Processing ${newOutput.length} new output items for project ${project.id}`
        );
        const manager = managerRef.current;
        const instance = manager.getTerminal(project.id);

        if (instance) {
          console.log(
            `[Terminal Manager Debug] Writing to terminal for project ${project.id}`
          );
          // Write new output to terminal
          newOutput.forEach((data, index) => {
            console.log(
              `[Terminal Manager Debug] Writing chunk ${index}: ${data.substring(
                0,
                50
              )}...`
            );
            instance.terminal.write(data);
          });
        } else {
          console.log(
            `[Terminal Manager Debug] No terminal instance for project ${project.id}, storing for later`
          );
          // Store output for when terminal is created
          const pending = pendingOutputRef.current.get(project.id) || [];
          pending.push(...newOutput);
          pendingOutputRef.current.set(project.id, pending);
        }

        lastOutputLengthRef.current.set(project.id, project.output.length);
      }
    });
  }, [projects]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all data handlers
      unsubscribersRef.current.forEach((unsubscribers) => {
        unsubscribers.forEach((unsub) => unsub());
      });
      unsubscribersRef.current.clear();

      // Clean up terminal manager
      managerRef.current.cleanup();
    };
  }, []);

  const showTerminal = useCallback(
    (projectId: string) => {
      console.log(
        `[Terminal Debug] showTerminal called for project ${projectId}`
      );
      // Create terminal if it doesn't exist
      const instance = createTerminalIfNeeded(projectId);
      if (!instance) {
        console.warn(
          `[Terminal Debug] Could not create terminal for project ${projectId}`
        );
        return;
      }

      console.log(
        `[Terminal Debug] Terminal instance created/found for project ${projectId}`
      );
      const manager = managerRef.current;
      manager.hideAllTerminals();
      manager.showTerminal(projectId, 50);
      console.log(`[Terminal Debug] Terminal shown for project ${projectId}`);
    },
    [createTerminalIfNeeded]
  );

  const focusTerminal = useCallback((projectId: string) => {
    managerRef.current.focusTerminal(projectId);
  }, []);

  const hideAllTerminals = useCallback(() => {
    managerRef.current.hideAllTerminals();
  }, []);

  const clearTerminal = useCallback((projectId: string) => {
    managerRef.current.clearTerminal(projectId);
  }, []);

  const writeToTerminal = useCallback((projectId: string, data: string) => {
    const manager = managerRef.current;
    const instance = manager.getTerminal(projectId);
    if (instance) {
      instance.terminal.write(data);
    }
  }, []);

  const setupDataHandler = useCallback(
    (projectId: string, onData: (data: string) => void) => {
      const manager = managerRef.current;
      const instance = manager.getTerminal(projectId);
      if (instance) {
        const unsubscriber = TerminalService.setupDataHandler(
          instance.terminal,
          onData
        );

        const projectUnsubscribers =
          unsubscribersRef.current.get(projectId) || [];
        projectUnsubscribers.push(unsubscriber);
        unsubscribersRef.current.set(projectId, projectUnsubscribers);
      }
    },
    []
  );

  const fitTerminal = useCallback((projectId: string) => {
    const manager = managerRef.current;
    const instance = manager.getTerminal(projectId);
    if (instance) {
      try {
        instance.fitAddon.fit();
      } catch (error) {
        console.error("Fit addon error (expected on initial load):", error);
      }
    }
  }, []);

  return {
    containerRef,
    showTerminal,
    focusTerminal,
    hideAllTerminals,
    clearTerminal,
    writeToTerminal,
    setupDataHandler,
    fitTerminal,
  };
}

export const ViewTerminal = forwardRef<ViewTerminalRef, IViewTerminalProps>(
  ({ selectedProject, projects }, ref) => {
    const prevProjectsRef = useRef<UnifiedItem[]>([]);

    // Use the terminal manager hook with Claude configuration
    const {
      containerRef,
      showTerminal,
      focusTerminal,
      clearTerminal,
      fitTerminal,
    } = useTerminalManager(
      projects,
      TerminalService.getClaudeConfig(),
      (output) => {
        // Handle terminal data input (send to Electron)
        api.sendInput(output.projectId, output.data);
      }
    );

    // Expose fitTerminal function to parent component
    useImperativeHandle(
      ref,
      () => ({
        fitTerminal,
      }),
      [fitTerminal]
    );

    // Show terminals based on selected project
    useEffect(() => {
      if (selectedProject) {
        showTerminal(selectedProject.id);
      }
    }, [selectedProject, showTerminal]);

    // Auto-focus terminal when Claude becomes ready
    useEffect(() => {
      if (selectedProject && selectedProject.status === "ready") {
        // Small delay to ensure terminal is fully shown before focusing
        setTimeout(() => {
          focusTerminal(selectedProject.id);
        }, 100);
      }
    }, [selectedProject?.status, selectedProject?.id, focusTerminal]);

    // Track previous project statuses to detect when a project is stopped
    useEffect(() => {
      // Clear terminal when project transitions from running/working to idle
      if (!projects) return;
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

    // Simple terminal resize solution - fit terminal after mount with delay
    useLayoutEffect(() => {
      if (selectedProject) {
        const timer = setTimeout(() => {
          fitTerminal(selectedProject.id);
        }, 1000);

        return () => clearTimeout(timer);
      }
    }, [selectedProject, fitTerminal]);

    if (!selectedProject) {
      return (
        <div className="flex-1 h-full flex items-center justify-center">
          <NonIdealState
            icon={() => <Icon name="terminal" className="h-16 w-16 opacity-50" />}
            title="No Project Selected"
            description="Select a project from the sidebar to view its terminal"
            className="min-w-80 max-w-2xl"
          />
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col p-0 md:p-4 md:pt-0">
        <Card className="flex-1 flex flex-col h-full glass-card overflow-hidden">
          <CardHeader className="flex-shrink-0 py-3 bg-gradient-to-r from-black to-gray-900 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-200 font-semibold">
                <Icon name="terminal" className="h-5 w-5 text-green-400" />
                {selectedProject.name}
              </CardTitle>
            </div>
            <p className="text-sm text-gray-400 font-mono hidden md:block">
              {selectedProject.path}
            </p>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <div
              ref={containerRef}
              className="flex-1 overflow-hidden"
              style={{
                minHeight: "200px",
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
);

ViewTerminal.displayName = "ViewTerminal";
