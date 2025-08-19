import { api } from "./utils/api";
import { ItemType } from "./types";
import { Input } from "./components/input";
import { Modal } from "./components/modal";
import { isWeb } from "./utils/environment";
import "react-toastify/dist/ReactToastify.css";
import { FormPanel } from "./components/form-panel";
import { useAppState } from "./hooks/use-app-state";
import { toast, ToastContainer } from "react-toastify";
import { ViewWebview } from "./components/view-webview";
import { FormProject } from "./components/form-project";
import { ViewGitDiff } from "./components/view-git-diff";
import { FormSettings } from "./components/form-settings";
import { NonIdealState } from "./components/non-ideal-state";
import { webSocketManager } from "./utils/websocket-manager";
import { ViewFileEditor } from "./components/view-file-editor";
import { Tabs, TabsList, TabsTrigger } from "./components/tabs";
import { FormDependencies } from "./components/form-dependencies";
import { FormConfirmation } from "./components/form-confirmation";
import type { UnifiedItem, TerminalOutput, ProcessExit } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "./components/card";
import { ViewTerminal, type ViewTerminalRef } from "./components/view-terminal";
import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  CSSProperties,
} from "react";
import {
  useSensor,
  DndContext,
  useSensors,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

enum ProjectTab {
  TERMINAL = "terminal",
  GIT_DIFF = "git-diff",
  EDITOR = "editor",
  PREVIEW = "preview",
}

import { Button } from "./components/button";
import { Icon } from "./components/icon";
import { StatusIcon } from "./components/status-icon";


// Sortable Project Card Component
interface ISortableProjectCardProps {
  project: UnifiedItem;
  selectedItem: string | null;
  onItemSelect: (itemId: string) => void;
  onProjectStart: (projectId: string, command: string) => void;
  onProjectStop: (projectId: string) => void;
  onProjectDelete: (projectId: string) => void;
  onProjectEdit: (projectId: string) => void;
}

function SortableProjectCard({
  project,
  selectedItem,
  onItemSelect,
  onProjectStart,
  onProjectStop,
  onProjectDelete,
  onProjectEdit,
}: ISortableProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: project.id });

  const style = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`cursor-pointer project-card-raycast ${
          selectedItem === project.id ? "rainbow-glow" : ""
        }`}
        onClick={() => onItemSelect(project.id)}
      >
        <CardHeader className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                name={project.icon || "folder"}
                className={`h-4 w-4 ${
                  selectedItem === project.id ? "text-white" : "text-gray-400"
                }`}
              />
              <CardTitle
                {...attributes}
                {...listeners}
                className={`text-sm font-medium cursor-grab active:cursor-grabbing touch-none ${
                  selectedItem === project.id
                    ? "text-white font-semibold"
                    : "text-gray-200"
                }`}
                title="Drag to reorder"
              >
                {project.name}
              </CardTitle>
            </div>
            <StatusIcon status={project.status} />
          </div>
          <p
            className={`text-xs truncate ${
              selectedItem === project.id ? "text-gray-300" : "text-gray-500"
            }`}
          >
            {project.path}
          </p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-center justify-end">
            <div className="flex gap-1">
              {["running", "working", "ready"].includes(project.status) ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProjectStop(project.id);
                  }}
                >
                  <Icon name="square" className="h-3 w-3" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProjectStart(project.id, project.runCommand ?? "");
                  }}
                >
                  <Icon name="play" className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onProjectEdit(project.id);
                }}
              >
                <Icon name="edit" className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onProjectDelete(project.id);
                }}
              >
                <Icon name="trash2" className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Sortable Panel Card Component
interface ISortablePanelCardProps {
  panel: UnifiedItem;
  selectedItem: string | null;
  onItemSelect: (itemId: string) => void;
  onPanelEdit: (panelId: string) => void;
  onPanelDelete: (panelId: string) => void;
}

function SortablePanelCard({
  panel,
  selectedItem,
  onItemSelect,
  onPanelEdit,
  onPanelDelete,
}: ISortablePanelCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: panel.id });

  const style = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`cursor-pointer project-card-raycast ${
          selectedItem === panel.id ? "rainbow-glow" : ""
        }`}
        onClick={() => onItemSelect(panel.id)}
      >
        <CardHeader className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                name={panel.icon || "globe"}
                className={`h-4 w-4 ${
                  selectedItem === panel.id ? "text-white" : "text-gray-400"
                }`}
              />
              <CardTitle
                {...attributes}
                {...listeners}
                className={`text-sm font-medium cursor-grab active:cursor-grabbing touch-none ${
                  selectedItem === panel.id
                    ? "text-white font-semibold"
                    : "text-gray-200"
                }`}
                title="Drag to reorder"
              >
                {panel.name}
              </CardTitle>
            </div>
            <Icon name="globe" className="h-4 w-4 text-gray-400" />
          </div>
          <p
            className={`text-xs truncate ${
              selectedItem === panel.id ? "text-gray-300" : "text-gray-500"
            }`}
          >
            {panel.url}
          </p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-center justify-end">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPanelEdit(panel.id);
                }}
                className="h-6 px-2 text-xs"
                title="Edit panel"
              >
                <Icon name="edit" className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPanelDelete(panel.id);
                }}
                className="h-6 px-2 text-xs"
                title="Delete panel"
              >
                <Icon name="trash2" className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function App() {
  const {
    items,
    addItem,
    setItems,
    updateItem,
    deleteItem,
    selectedItem,
    setSelectedItem,
    updateStoredItem,
  } = useAppState();

  const [missingDeps, setMissingDeps] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPanelModalOpen, setIsPanelModalOpen] = useState<boolean>(false);
  const [editingPanel, setEditingPanel] = useState<UnifiedItem | null>(null);
  const [editingProject, setEditingProject] = useState<UnifiedItem | null>(
    null
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    itemId: string | null;
    itemName: string | null;
  }>({
    isOpen: false,
    itemId: null,
    itemName: null,
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Open sidebar by default only on large screens
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return false; // Default to closed for SSR
  });

  // ViewProject state
  const [activeTab, setActiveTab] = useState<ProjectTab>(() => {
    return ProjectTab.TERMINAL;
  });
  const [localIp, setLocalIp] = useState<string>("localhost");
  const [webPort] = useState(6969);
  const terminalRef = useRef<ViewTerminalRef>(null);

  // Ref to store current items for WebSocket listeners
  const itemsRef = useRef(items);

  // Keep the ref updated
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Auto-open sidebar on large screens only
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
      // On smaller screens, keep current state
      // Don't auto-close if user opened it manually
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Set up event listeners - the api handles environment detection
    const unsubscribeFunctions: (() => void)[] = [];

    if (api.onTerminalOutput) {
      const unsubscribeOutput = api.onTerminalOutput(
        (output: TerminalOutput) => {
          // Get current items from store and update
          const currentItem = items.find(
            (item) => item.id === output.projectId
          );
          if (currentItem) {
            updateItem(output.projectId, {
              output: [...(currentItem.output || []), output.data],
              lastActivity: new Date().toLocaleTimeString(),
            });
          }
        }
      );
      unsubscribeFunctions.push(unsubscribeOutput);
    }

    if (api.onProcessExit) {
      const unsubscribeExit = api.onProcessExit((exit: ProcessExit) => {
        updateItem(exit.projectId, {
          status: exit.code === 0 ? "completed" : "error",
          lastActivity: new Date().toLocaleTimeString(),
        });
      });
      unsubscribeFunctions.push(unsubscribeExit);
    }

    if (api.onClaudeReady) {
      const unsubscribeReady = api.onClaudeReady(
        (data: { projectId: string; timestamp: number }) => {
          updateItem(data.projectId, {
            status: "ready",
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );
      unsubscribeFunctions.push(unsubscribeReady);
    }

    if (api.onClaudeWorking) {
      const unsubscribeWorking = api.onClaudeWorking(
        (data: { projectId: string; timestamp: number }) => {
          updateItem(data.projectId, {
            status: "working",
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );
      unsubscribeFunctions.push(unsubscribeWorking);
    }

    if (api.onMissingDependencies) {
      const unsubscribeDeps = api.onMissingDependencies((deps: string[]) => {
        setMissingDeps(deps);
      });
      unsubscribeFunctions.push(unsubscribeDeps);
    }

    // Set up WebSocket listeners for web environment
    if (isWeb && webSocketManager) {
      const unsubscribeProjectReady = webSocketManager.on(
        "project-ready",
        (message: any) => {
          updateItem(message.projectId, {
            status: "ready",
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );

      const unsubscribeProjectWorking = webSocketManager.on(
        "project-working",
        (message: any) => {
          updateItem(message.projectId, {
            status: "working",
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );

      const unsubscribeProjectStarted = webSocketManager.on(
        "project-started",
        (message: any) => {
          updateItem(message.projectId, {
            status: "running",
            lastActivity: new Date().toLocaleTimeString(),
          });
          if (message.data) {
            const currentItem = items.find(
              (item) => item.id === message.projectId
            );
            if (currentItem) {
              updateItem(message.projectId, {
                output: [...(currentItem.output || []), message.data],
              });
            }
          }
        }
      );

      const unsubscribeProjectStopped = webSocketManager.on(
        "project-stopped",
        (message: any) => {
          updateItem(message.projectId, {
            status: "idle",
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );

      const unsubscribeProjectsState = webSocketManager.on(
        "projects-state",
        (message: any) => {
          console.log(`[Web App] Projects state updated:`, message.data);
          if (message.data && Array.isArray(message.data)) {
            setItems(message.data);
          }
        }
      );

      const unsubscribeClaudeStatusChange = webSocketManager.on(
        "claude-status-change",
        (message: any) => {
          console.log(
            `[Web App] Claude status changed for ${message.projectId}: ${message.data}`
          );
          updateItem(message.projectId, {
            status: message.data,
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );

      const unsubscribeTerminalOutput = webSocketManager.on(
        "terminal-output",
        (message: any) => {
          console.log(
            `[Web App] Terminal output for ${message.projectId}:`,
            message.data
          );
          console.log(
            `[Web App Debug] Current items in ref:`,
            itemsRef.current.map((item) => ({
              id: item.id,
              name: item.name,
              type: item.type,
            }))
          );
          const currentItem = itemsRef.current.find(
            (item) => item.id === message.projectId
          );
          console.log(`[Web App Debug] Found current item:`, currentItem);
          if (currentItem) {
            const newOutput = [...(currentItem.output || []), message.data];
            console.log(
              `[Web App Debug] Updating item with ${newOutput.length} total output items`
            );
            updateItem(message.projectId, {
              output: newOutput,
              lastActivity: new Date().toLocaleTimeString(),
            });
          } else {
            console.log(
              `[Web App Debug] No item found for projectId: ${message.projectId}`
            );
          }
        }
      );

      unsubscribeFunctions.push(
        unsubscribeProjectReady,
        unsubscribeProjectWorking,
        unsubscribeProjectStarted,
        unsubscribeProjectStopped,
        unsubscribeProjectsState,
        unsubscribeClaudeStatusChange,
        unsubscribeTerminalOutput
      );
    }

    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // ViewProject logic
  const currentItem = selectedItem
    ? items.find((item) => item.id === selectedItem)
    : null;
  const previewUrl = useMemo(() => currentItem?.url, [currentItem?.url]);
  const webUrl = useMemo(
    () => `http://${localIp}:${webPort}`,
    [localIp, webPort]
  );
  const isPanel = useMemo(
    () => currentItem?.type === ItemType.PANEL,
    [currentItem?.type]
  );

  const fetchLocalIp = useCallback(async () => {
    try {
      const result = await api.getLocalIp();
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

  useEffect(() => {
    if (
      activeTab === ProjectTab.TERMINAL &&
      currentItem &&
      terminalRef.current
    ) {
      const timer = setTimeout(() => {
        terminalRef.current?.fitTerminal(currentItem.id);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [activeTab, currentItem?.id, currentItem]);

  const handleProjectAdd = (projectData: {
    name: string;
    path: string;
    icon?: string;
    runCommand?: string;
    url?: string;
    yoloMode?: boolean;
    restrictedBranches?: string;
  }) => {
    if (editingProject) {
      // Check if the new name conflicts with existing items (excluding current project)
      if (projectData.name !== editingProject.name) {
        const existingItem = items.find(
          (item) =>
            item.name === projectData.name && item.id !== editingProject.id
        );
        if (existingItem) {
          toast.error(`Item with name "${projectData.name}" already exists`);
          return;
        }
      }

      // Update using unified structure
      updateStoredItem(editingProject.id, {
        id: projectData.name,
        type: ItemType.PROJECT,
        name: projectData.name,
        path: projectData.path,
        icon: projectData.icon,
        runCommand: projectData.runCommand,
        url: projectData.url,
        yoloMode: projectData.yoloMode ?? true,
        restrictedBranches: projectData.restrictedBranches,
      });

      // Update selected item if it was the one being edited
      if (selectedItem === editingProject.id) {
        setSelectedItem(projectData.name);
      }
    } else {
      // Check if item name already exists
      const existingItem = items.find((item) => item.name === projectData.name);
      if (existingItem) {
        toast.error(`Item with name "${projectData.name}" already exists`);
        return;
      }

      // Create new project using unified structure
      const newItem: UnifiedItem = {
        id: projectData.name,
        type: ItemType.PROJECT,
        name: projectData.name,
        path: projectData.path,
        icon: projectData.icon,
        runCommand: projectData.runCommand,
        url: projectData.url,
        yoloMode: projectData.yoloMode ?? true,
        restrictedBranches: projectData.restrictedBranches,
      };
      addItem(newItem);
      setSelectedItem(newItem.id);
    }
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItem(itemId);
    // Auto-close sidebar on mobile when selecting an item
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    // Notify about the project selection for notifications
    const item = items.find((i) => i.id === itemId);
    if (item?.type === ItemType.PROJECT) {
      api.setSelectedProject(itemId);
    }
  };

  const handleProjectStart = async (projectId: string, command: string) => {
    const project = items.find(
      (item) => item.id === projectId && item.type === ItemType.PROJECT
    );
    if (!project) return;

    // Select the project when starting it
    setSelectedItem(projectId);
    api.setSelectedProject(projectId);

    updateItem(projectId, {
      status: "running",
      output: [],
      lastActivity: new Date().toLocaleTimeString(),
    });

    try {
      const result = await api.startClaudeProcess(
        projectId,
        project.path!,
        command,
        project.name,
        project.yoloMode
      );
      if (!result.success) {
        updateItem(projectId, {
          status: "error",
          output: [`Error: ${result.error}`],
        });
        toast.error(`Failed to start process: ${result.error}`);
      } else {
        // Successfully started - assume ready state initially
        updateItem(projectId, {
          status: "ready",
          lastActivity: new Date().toLocaleTimeString(),
        });
      }
    } catch {
      updateItem(projectId, {
        status: "error",
        output: [`Error: Failed to start project`],
      });
      toast.error("Failed to start project");
    }
  };

  const handleProjectStop = async (projectId: string) => {
    try {
      await api.stopClaudeProcess(projectId);
    } catch (error) {
      console.error("Failed to stop project:", error);
    }
    updateItem(projectId, {
      status: "idle",
      lastActivity: new Date().toLocaleTimeString(),
    });
  };

  const handleProjectEdit = (projectId: string) => {
    const project = items.find(
      (item) => item.id === projectId && item.type === ItemType.PROJECT
    );
    if (project) {
      setEditingProject(project);
      setIsModalOpen(true);
    }
  };

  const handleItemDeleteRequest = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setDeleteConfirmation({
        isOpen: true,
        itemId: itemId,
        itemName: item.name,
      });
    }
  };

  const handleItemDeleteConfirm = () => {
    if (deleteConfirmation.itemId) {
      deleteItem(deleteConfirmation.itemId);
      if (selectedItem === deleteConfirmation.itemId) {
        setSelectedItem(null);
      }
    }
    setDeleteConfirmation({
      isOpen: false,
      itemId: null,
      itemName: null,
    });
  };

  const handleItemDeleteCancel = () => {
    setDeleteConfirmation({
      isOpen: false,
      itemId: null,
      itemName: null,
    });
  };

  const handleProjectReorder = (startIndex: number, endIndex: number) => {
    const projectItems = items.filter((item) => item.type === ItemType.PROJECT);
    const panelItems = items.filter((item) => item.type === ItemType.PANEL);

    const reorderedProjects = Array.from(projectItems);
    const [removed] = reorderedProjects.splice(startIndex, 1);
    reorderedProjects.splice(endIndex, 0, removed);

    setItems([...reorderedProjects, ...panelItems]);
  };

  const handlePanelReorder = (startIndex: number, endIndex: number) => {
    const projectItems = items.filter((item) => item.type === ItemType.PROJECT);
    const panelItems = items.filter((item) => item.type === ItemType.PANEL);

    const reorderedPanels = Array.from(panelItems);
    const [removed] = reorderedPanels.splice(startIndex, 1);
    reorderedPanels.splice(endIndex, 0, removed);

    setItems([...projectItems, ...reorderedPanels]);
  };

  // Setup DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleProjectDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = projects.findIndex((p) => p.id === active.id);
      const newIndex = projects.findIndex((p) => p.id === over.id);
      handleProjectReorder(oldIndex, newIndex);
    }
  };

  const handlePanelDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = panels.findIndex((p) => p.id === active.id);
      const newIndex = panels.findIndex((p) => p.id === over.id);
      handlePanelReorder(oldIndex, newIndex);
    }
  };

  const handlePanelEdit = (panelId: string) => {
    const panel = items.find(
      (item) => item.id === panelId && item.type === ItemType.PANEL
    );
    if (panel) {
      setEditingPanel(panel);
      setIsPanelModalOpen(true);
    }
  };

  const handlePanelSubmit = (panelData: {
    name: string;
    url: string;
    icon?: string;
  }) => {
    if (editingPanel) {
      // Update existing panel using unified structure
      updateStoredItem(editingPanel.id, {
        name: panelData.name,
        url: panelData.url,
        icon: panelData.icon,
      });

      // Update selected item if it was the one being edited
      if (selectedItem === editingPanel.id) {
        setSelectedItem(editingPanel.id);
      }
    } else {
      // Find the first available panel ID
      const existingIds = items
        .filter((item) => item.type === ItemType.PANEL)
        .map((item) => parseInt(item.id))
        .filter((id) => !isNaN(id));
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      const newPanelId = (maxId + 1).toString();

      const newItem: UnifiedItem = {
        id: newPanelId,
        type: ItemType.PANEL,
        name: panelData.name,
        url: panelData.url,
        icon: panelData.icon,
      };
      addItem(newItem);
      setSelectedItem(newItem.id);
    }
    setIsPanelModalOpen(false);
    setEditingPanel(null);
  };

  const handlePanelDelete = (panelId: string) => {
    const item = items.find((i) => i.id === panelId);
    if (item) {
      setDeleteConfirmation({
        isOpen: true,
        itemId: panelId,
        itemName: item.name,
      });
    }
  };

  const projects = useMemo(
    () => items.filter((item) => item.type === ItemType.PROJECT, []),
    [items]
  );

  const panels = useMemo(
    () => items.filter((item) => item.type === ItemType.PANEL, []),
    [items]
  );

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div
        className="h-16 glass-titlebar flex items-center px-4 select-none relative"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        <h1 className="text-lg font-medium text-gray-200 absolute left-1/2 transform -translate-x-1/2">
          Vibe Term
        </h1>

        {/* Mobile menu button - positioned on the right */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 hover:bg-gray-700/50 transition-colors ml-auto"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          <svg
            className="w-5 h-5 text-gray-300"
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
        </button>
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex overflow-hidden ${
          missingDeps.length > 0 ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {/* Mobile overlay for sidebar */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:relative z-50 lg:z-auto transition-transform duration-300 ease-in-out`}
        >
          <div className="w-80 min-w-64 max-w-80 lg:w-80 md:w-72 sm:w-64 h-full glass-sidebar p-4 pb-6 flex-shrink-0 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-200">Projects</h2>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Settings"
                >
                  <Icon name="settings" className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setIsModalOpen(true)}
                  title="Add Project"
                >
                  <Icon name="plus" className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleProjectDragEnd}
            >
              <SortableContext
                items={projects.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {projects.map((project) => (
                    <SortableProjectCard
                      key={project.id}
                      project={project}
                      selectedItem={selectedItem}
                      onItemSelect={handleItemSelect}
                      onProjectStart={handleProjectStart}
                      onProjectStop={handleProjectStop}
                      onProjectDelete={handleItemDeleteRequest}
                      onProjectEdit={handleProjectEdit}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {projects.length === 0 && (
              <NonIdealState
                icon={() => (
                  <Icon name="folder" className="h-8 w-8 text-gray-400" />
                )}
                title="No Projects Found"
                description="Add your first project to get started"
                action={
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    variant="outline"
                  >
                    <Icon name="plus" className="h-4 w-4 mr-2" />
                    Add Project
                  </Button>
                }
              />
            )}

            {/* Separator */}
            <div className="border-t border-gray-800 my-6"></div>

            {/* Panels Section */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-200">Panels</h2>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    setEditingPanel(null);
                    setIsPanelModalOpen(true);
                  }}
                  title="Add Panel"
                >
                  <Icon name="plus" className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 min-h-0">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handlePanelDragEnd}
                >
                  <SortableContext
                    items={panels.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {panels.map((panel) => (
                        <SortablePanelCard
                          key={panel.id}
                          panel={panel}
                          selectedItem={selectedItem}
                          onItemSelect={handleItemSelect}
                          onPanelEdit={handlePanelEdit}
                          onPanelDelete={handlePanelDelete}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {panels.length === 0 && (
                  <NonIdealState
                    icon={() => (
                      <Icon name="globe" className="h-8 w-8 text-gray-400" />
                    )}
                    title="No Panels"
                    description="Add panels to quickly access your favorite tools and dashboards."
                    action={
                      <Button
                        onClick={() => {
                          setEditingPanel(null);
                          setIsPanelModalOpen(true);
                        }}
                        variant="outline"
                      >
                        <Icon name="plus" className="h-4 w-4 mr-2" />
                        Add Panel
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
          {currentItem && (
            <div className="h-full flex-1 flex flex-col">
              <Tabs
                value={activeTab}
                onValueChange={(value: string) =>
                  setActiveTab(value as ProjectTab)
                }
                className="flex-1 flex flex-col"
              >
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
                              <Icon name="terminal" className="h-4 w-4" />
                              <span className="hidden sm:inline">Terminal</span>
                            </TabsTrigger>
                            <TabsTrigger
                              value={ProjectTab.GIT_DIFF}
                              className="flex items-center gap-2 whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start"
                            >
                              <Icon name="gitbranch" className="h-4 w-4" />
                              <span className="hidden sm:inline">Git Diff</span>
                            </TabsTrigger>
                            <TabsTrigger
                              value={ProjectTab.EDITOR}
                              className="flex items-center gap-2 whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start"
                            >
                              <Icon name="filetext" className="h-4 w-4" />
                              <span className="hidden sm:inline">Editor</span>
                            </TabsTrigger>
                            <TabsTrigger
                              value={ProjectTab.PREVIEW}
                              className={`flex items-center gap-2 whitespace-nowrap flex-1 md:flex-initial justify-center md:justify-start`}
                              disabled={!previewUrl}
                            >
                              <Icon name="globe" className="h-4 w-4" />
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
                      projects={items.filter(
                        (item) => item.type === ItemType.PROJECT
                      )}
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
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        maxWidth="lg"
        isOpen={isModalOpen}
        title={editingProject ? "Edit Project" : "Add Project"}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }}
      >
        <FormProject
          onSubmit={handleProjectAdd}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingProject(null);
          }}
          data={
            editingProject
              ? {
                  name: editingProject.name,
                  url: editingProject.url,
                  icon: editingProject.icon,
                  path: editingProject.path || "",
                  yoloMode: editingProject.yoloMode,
                  runCommand: editingProject.runCommand,
                  restrictedBranches: editingProject.restrictedBranches,
                }
              : undefined
          }
        />
      </Modal>

      <Modal
        maxWidth="md"
        isOpen={isPanelModalOpen}
        title={editingPanel ? "Edit Panel" : "Add Panel"}
        onClose={() => {
          setIsPanelModalOpen(false);
          setEditingPanel(null);
        }}
      >
        <FormPanel
          onSubmit={handlePanelSubmit}
          onCancel={() => {
            setIsPanelModalOpen(false);
            setEditingPanel(null);
          }}
          data={
            editingPanel
              ? {
                  name: editingPanel.name,
                  url: editingPanel.url || "",
                  icon: editingPanel.icon,
                }
              : undefined
          }
        />
      </Modal>

      <Modal
        maxWidth="2xl"
        title="Settings"
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      >
        <FormSettings onClose={() => setIsSettingsOpen(false)} />
      </Modal>

      {missingDeps.length > 0 && (
        <Modal
          isOpen={true}
          maxWidth="2xl"
          onClose={() => {}}
          showCloseButton={false}
          title="Missing Dependencies"
        >
          <FormDependencies data={{ missingDeps }} onClose={() => {}} />
        </Modal>
      )}

      <Modal
        maxWidth="md"
        intent="warning"
        title="Delete Item"
        showCloseButton={false}
        onClose={handleItemDeleteCancel}
        isOpen={deleteConfirmation.isOpen}
      >
        <FormConfirmation
          onCancel={handleItemDeleteCancel}
          onSubmit={handleItemDeleteConfirm}
          data={{
            title: "",
            cancelText: "Cancel",
            confirmText: "Delete",
            message: `Are you sure you want to delete "${deleteConfirmation.itemName}"?`,
          }}
        />
      </Modal>

      <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
    </div>
  );
}

export default App;
