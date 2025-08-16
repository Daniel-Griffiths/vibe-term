import { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ProjectList from "./components/project-list";
import ViewProject from "./components/view-project";
import Modal from "./components/modal";
import FormProject from "./components/form-project";
import FormPanel from "./components/form-panel";
import FormSettings from "./components/form-settings";
import FormDependencies from "./components/form-dependencies";
import FormConfirmation from "./components/form-confirmation";
import { Button } from "./components/button";
import { useAppStore, initializeFileSync } from "./stores/settings";
import type { UnifiedItem, TerminalOutput, ProcessExit } from "./types";

function App() {
  // Use Zustand store for persistent state
  const {
    items,
    selectedItem,
    setItems,
    setSelectedItem,
    addItem,
    updateItem,
    updateStoredItem,
    deleteItem,
  } = useAppStore();

  // Local UI state only
  const [isElectron, setIsElectron] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<UnifiedItem | null>(
    null
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<UnifiedItem | null>(null);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    itemId: string | null;
    itemName: string | null;
  }>({
    isOpen: false,
    itemId: null,
    itemName: null,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-open sidebar on large screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };
    
    // Set initial state
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get projects and panels from unified items
  const projects = items.filter((item) => item.type === "project");
  const panels = items.filter((item) => item.type === "panel");

  useEffect(() => {
    // Initialize file sync for web server
    initializeFileSync();

    // Check if we're running in Electron
    if (typeof window !== "undefined" && window.electronAPI) {
      setIsElectron(true);

      console.log(`[IPC Debug] Setting up terminal output listener...`);
      const unsubscribeOutput = window.electronAPI.onTerminalOutput(
        (output: TerminalOutput) => {
          console.log(
            `[App Debug] *** TERMINAL OUTPUT RECEIVED IN APP.TSX ***`,
            {
              projectId: output.projectId,
              dataLength: output.data?.length,
              dataPreview: output.data?.substring(0, 50),
              timestamp: new Date().toISOString(),
            }
          );

          // Get current items from store and update
          const { items: currentItems } = useAppStore.getState();
          const currentItem = currentItems.find(
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

      const unsubscribeExit = window.electronAPI.onProcessExit(
        (exit: ProcessExit) => {
          updateItem(exit.projectId, {
            status: exit.code === 0 ? "completed" : "error",
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );

      const unsubscribeReady = window.electronAPI.onClaudeReady(
        (data: { projectId: string; timestamp: number }) => {
          updateItem(data.projectId, {
            status: "ready",
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );

      const unsubscribeWorking = window.electronAPI.onClaudeWorking(
        (data: { projectId: string; timestamp: number }) => {
          updateItem(data.projectId, {
            status: "working",
            lastActivity: new Date().toLocaleTimeString(),
          });
        }
      );

      const unsubscribeDeps = window.electronAPI.onMissingDependencies(
        (deps: string[]) => {
          setMissingDeps(deps);
        }
      );

      return () => {
        unsubscribeOutput();
        unsubscribeExit();
        unsubscribeReady();
        unsubscribeWorking();
        unsubscribeDeps();
      };
    }
  }, []); // Remove dependencies to prevent re-subscription

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
        type: "project",
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
        type: "project",
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
    // Notify Electron about the project selection for notifications
    const item = items.find((i) => i.id === itemId);
    if (item?.type === "project" && window.electronAPI?.setSelectedProject) {
      window.electronAPI.setSelectedProject(itemId);
    }
  };

  const handleProjectStart = async (projectId: string, command: string) => {
    const project = items.find(
      (item) => item.id === projectId && item.type === "project"
    );
    if (!project) return;

    // Select the project when starting it
    setSelectedItem(projectId);
    if (window.electronAPI?.setSelectedProject) {
      window.electronAPI.setSelectedProject(projectId);
    }

    updateItem(projectId, {
      status: "running",
      output: [],
      lastActivity: new Date().toLocaleTimeString(),
    });

    if (isElectron && window.electronAPI) {
      const result = await window.electronAPI.startClaudeProcess(
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
      }
    }
  };

  const handleProjectStop = async (projectId: string) => {
    if (isElectron && window.electronAPI) {
      await window.electronAPI.stopClaudeProcess(projectId);
    }
    updateItem(projectId, {
      status: "idle",
      lastActivity: new Date().toLocaleTimeString(),
    });
  };

  const handleProjectEdit = (projectId: string) => {
    const project = items.find(
      (item) => item.id === projectId && item.type === "project"
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
    const projectItems = items.filter((item) => item.type === "project");
    const panelItems = items.filter((item) => item.type === "panel");

    const reorderedProjects = Array.from(projectItems);
    const [removed] = reorderedProjects.splice(startIndex, 1);
    reorderedProjects.splice(endIndex, 0, removed);

    setItems([...reorderedProjects, ...panelItems]);
  };

  const handlePanelReorder = (startIndex: number, endIndex: number) => {
    const projectItems = items.filter((item) => item.type === "project");
    const panelItems = items.filter((item) => item.type === "panel");

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
      (item) => item.id === panelId && item.type === "panel"
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
        .filter((item) => item.type === "panel")
        .map((item) => parseInt(item.id))
        .filter((id) => !isNaN(id));
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      const newPanelId = (maxId + 1).toString();

      const newItem: UnifiedItem = {
        id: newPanelId,
        type: "panel",
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
    deleteItem(panelId);
    if (selectedItem === panelId) {
      setSelectedItem(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Custom Title Bar with Glass Effect */}
      <div
        className="h-16 glass-titlebar flex items-center justify-center px-4 select-none"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <h1 className="text-lg font-medium text-gray-200">Vibe Term</h1>
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
        
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-50 lg:z-auto transition-transform duration-300 ease-in-out`}>
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
