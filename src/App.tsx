import { useState, useEffect, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ProjectList } from "./components/project-list";
import { ViewProject } from "./components/view-project";
import { Modal } from "./components/modal";
import { FormProject } from "./components/form-project";
import { FormPanel } from "./components/form-panel";
import { FormSettings } from "./components/form-settings";
import { FormDependencies } from "./components/form-dependencies";
import { FormConfirmation } from "./components/form-confirmation";
import { useAppState } from "./hooks/use-app-state";
import { api } from "./utils/api";
import { webSocketManager } from "./utils/websocket-manager";
import { isElectron, isWeb } from "./utils/environment";
import type { UnifiedItem, TerminalOutput, ProcessExit } from "./types";
import { ItemType } from "./types";

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
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

  // Get projects and panels from unified items
  const projects = items.filter((item) => item.type === ItemType.PROJECT);
  const panels = items.filter((item) => item.type === ItemType.PANEL);

  useEffect(() => {
    console.log(
      "[App Debug] useEffect running, isElectron:",
      isElectron,
      "isWeb:",
      isWeb
    );

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
    } catch (error) {
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

  const currentItem = selectedItem
    ? items.find((item) => item.id === selectedItem)
    : null;

  const handlePanelAdd = () => {
    setEditingPanel(null);
    setIsPanelModalOpen(true);
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

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Custom Title Bar with Glass Effect */}
      <div
        className="h-16 glass-titlebar flex items-center px-4 select-none relative"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {/* Centered title */}
        <h1 className="text-lg font-medium text-gray-200 absolute left-1/2 transform -translate-x-1/2">
          Vibe Term
        </h1>

        {/* Mobile menu button - positioned on the right */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 hover:bg-gray-700/50 transition-colors ml-auto"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
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
          <ProjectList
            projects={projects}
            selectedProject={
              selectedItem && projects.find((p) => p.id === selectedItem)
                ? selectedItem
                : null
            }
            panels={panels}
            selectedPanel={
              selectedItem && panels.find((p) => p.id === selectedItem)
                ? selectedItem
                : null
            }
            onProjectSelect={handleItemSelect}
            onProjectStart={handleProjectStart}
            onProjectStop={handleProjectStop}
            onProjectEdit={handleProjectEdit}
            onProjectDelete={handleItemDeleteRequest}
            onProjectReorder={handleProjectReorder}
            onOpenModal={() => setIsModalOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onPanelSelect={handleItemSelect}
            onPanelAdd={handlePanelAdd}
            onPanelEdit={handlePanelEdit}
            onPanelDelete={handlePanelDelete}
            onPanelReorder={handlePanelReorder}
          />
        </div>

        <div className="flex-1 relative">
          {currentItem && (
            <ViewProject
              selectedItem={currentItem}
              items={items}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }}
        title={editingProject ? "Edit Project" : "Add Project"}
        maxWidth="lg"
      >
        <FormProject
          data={
            editingProject
              ? {
                  name: editingProject.name,
                  path: editingProject.path || "",
                  icon: editingProject.icon,
                  runCommand: editingProject.runCommand,
                  url: editingProject.url,
                  yoloMode: editingProject.yoloMode,
                  restrictedBranches: editingProject.restrictedBranches,
                }
              : undefined
          }
          onSubmit={handleProjectAdd}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingProject(null);
          }}
        />
      </Modal>

      <Modal
        isOpen={isPanelModalOpen}
        onClose={() => {
          setIsPanelModalOpen(false);
          setEditingPanel(null);
        }}
        title={editingPanel ? "Edit Panel" : "Add Panel"}
        maxWidth="md"
      >
        <FormPanel
          data={
            editingPanel
              ? {
                  name: editingPanel.name,
                  url: editingPanel.url || "",
                  icon: editingPanel.icon,
                }
              : undefined
          }
          onSubmit={handlePanelSubmit}
          onCancel={() => {
            setIsPanelModalOpen(false);
            setEditingPanel(null);
          }}
        />
      </Modal>

      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
        maxWidth="2xl"
      >
        <FormSettings onClose={() => setIsSettingsOpen(false)} />
      </Modal>

      {missingDeps.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => {}}
          title="Missing Dependencies"
          maxWidth="2xl"
          showCloseButton={false}
        >
          <FormDependencies data={{ missingDeps }} onClose={() => {}} />
        </Modal>
      )}

      <Modal
        isOpen={deleteConfirmation.isOpen}
        onClose={handleItemDeleteCancel}
        title="Delete Item"
        showCloseButton={false}
        maxWidth="md"
        intent="warning"
      >
        <FormConfirmation
          data={{
            title: "",
            message: `Are you sure you want to delete "${deleteConfirmation.itemName}"?`,
            confirmText: "Delete",
            cancelText: "Cancel",
          }}
          onSubmit={handleItemDeleteConfirm}
          onCancel={handleItemDeleteCancel}
        />
      </Modal>

      <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
    </div>
  );
}

export default App;
