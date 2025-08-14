import { useState, useEffect } from 'react';
import ProjectList from './components/ProjectList';
import ProjectView from './components/ProjectView';
import ProjectModal from './components/ProjectModal';
import SettingsModal from './components/SettingsModal';
import DependenciesModal from './components/DependenciesModal';
import ConfirmationModal from './components/ConfirmationModal';
import type { Project, TerminalOutput, ProcessExit } from './types';

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [, setManuallyStopped] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    projectId: string | null;
    projectName: string | null;
  }>({
    isOpen: false,
    projectId: null,
    projectName: null
  });

  useEffect(() => {
    // Check if we're running in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectron(true);
      
      // Load saved projects
      window.electronAPI.loadProjects().then((savedProjects: Project[]) => {
        if (savedProjects.length > 0) {
          setProjects(savedProjects.map(p => ({ 
            ...p, 
            status: 'idle' as const, 
            output: [],
            // Ensure all new fields are present with defaults if missing
            icon: p.icon || 'folder',
            runCommand: p.runCommand || undefined,
            previewUrl: p.previewUrl || undefined,
            restrictedBranches: p.restrictedBranches || undefined
          })));
          setSelectedProject(savedProjects[0].id);
        }
        // No demo project - start with empty project list
      });
      
      const unsubscribeOutput = window.electronAPI.onTerminalOutput((output: TerminalOutput) => {
        setProjects(prev => prev.map(project => 
          project.id === output.projectId 
            ? { 
                ...project, 
                output: [...project.output, output.data],
                lastActivity: new Date().toLocaleTimeString()
              }
            : project
        ));
      });

      const unsubscribeExit = window.electronAPI.onProcessExit((exit: ProcessExit) => {
        setProjects(prev => prev.map(project => {
          if (project.id === exit.projectId) {
            // Check if this project was manually stopped using a synchronous check
            return project.status === 'idle' ? project : {
              ...project,
              status: exit.code === 0 ? 'completed' : 'error',
              lastActivity: new Date().toLocaleTimeString()
            };
          }
          return project;
        }));
        
        // Clean up the manually stopped set
        setManuallyStopped(prev => {
          const newSet = new Set(prev);
          newSet.delete(exit.projectId);
          return newSet;
        });
      });

      const unsubscribeReady = window.electronAPI.onClaudeReady((data: { projectId: string; timestamp: number }) => {
        setProjects(prev => prev.map(project => 
          project.id === data.projectId 
            ? { 
                ...project, 
                status: 'ready' as const,
                lastActivity: new Date().toLocaleTimeString()
              }
            : project
        ));
      });

      const unsubscribeWorking = window.electronAPI.onClaudeWorking((data: { projectId: string; timestamp: number }) => {
        setProjects(prev => prev.map(project => 
          project.id === data.projectId 
            ? { 
                ...project, 
                status: 'working' as const,
                lastActivity: new Date().toLocaleTimeString()
              }
            : project
        ));
      });

      const unsubscribeMissingDeps = window.electronAPI.onMissingDependencies((deps: string[]) => {
        console.log('App component received missing dependencies:', deps);
        setMissingDeps(deps);
      });

      return () => {
        unsubscribeOutput();
        unsubscribeExit();
        unsubscribeReady();
        unsubscribeWorking();
        unsubscribeMissingDeps();
      };
    } else {
      console.log('Running in browser mode - Electron APIs not available');
    }
  }, []);

  // Save projects whenever they change
  useEffect(() => {
    if (isElectron && projects.length > 0 && window.electronAPI) {
      // Only save the basic project info, not runtime data like output
      const projectsToSave = projects.map(p => ({
        id: p.id,
        name: p.name,
        path: p.path,
        icon: p.icon,
        runCommand: p.runCommand,
        previewUrl: p.previewUrl,
        restrictedBranches: p.restrictedBranches,
        lastActivity: p.lastActivity
      }));
      window.electronAPI.saveProjects(projectsToSave);
    }
  }, [projects, isElectron]);

  const handleProjectAdd = (projectData: {
    name: string;
    path: string;
    icon?: string;
    runCommand?: string;
    previewUrl?: string;
    yoloMode?: boolean;
    restrictedBranches?: string;
  }) => {
    if (editingProject) {
      // Update existing project
      setProjects(prev => prev.map(p => 
        p.id === editingProject.id 
          ? {
              ...p,
              name: projectData.name,
              path: projectData.path,
              icon: projectData.icon,
              runCommand: projectData.runCommand,
              previewUrl: projectData.previewUrl,
              yoloMode: projectData.yoloMode,
              restrictedBranches: projectData.restrictedBranches,
            }
          : p
      ));
      setEditingProject(null);
    } else {
      // Create new project
      const newProject: Project = {
        id: Date.now().toString(),
        name: projectData.name,
        path: projectData.path,
        icon: projectData.icon,
        runCommand: projectData.runCommand,
        previewUrl: projectData.previewUrl,
        yoloMode: projectData.yoloMode,
        restrictedBranches: projectData.restrictedBranches,
        status: 'idle',
        lastActivity: new Date().toLocaleTimeString(),
        output: []
      };
      setProjects(prev => [...prev, newProject]);
      setSelectedProject(newProject.id);
    }
    setIsModalOpen(false);
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    // Notify Electron about the project selection for notifications
    window.electronAPI.setSelectedProject(projectId);
  };

  const handleProjectStart = async (projectId: string, command: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    setProjects(prev => prev.map(p => 
      p.id === projectId 
        ? { ...p, status: 'running', output: [], lastActivity: new Date().toLocaleTimeString() }
        : p
    ));

    if (isElectron && window.electronAPI) {
      const result = await window.electronAPI.startClaudeProcess(projectId, project.path, command, project.name, project.yoloMode);
      if (!result.success) {
        setProjects(prev => prev.map(p => 
          p.id === projectId 
            ? { ...p, status: 'error', output: [`Error: ${result.error}`] }
            : p
        ));
      }
    } else {
      // Mock behavior for browser
      setTimeout(() => {
        setProjects(prev => prev.map(p => 
          p.id === projectId 
            ? { ...p, output: ['Mock: Claude Code started...', 'Mock: Ready for input'] }
            : p
        ));
      }, 1000);
    }
  };

  const handleProjectStop = async (projectId: string) => {
    // Mark as manually stopped before stopping
    setManuallyStopped(prev => new Set(prev).add(projectId));
    
    if (isElectron && window.electronAPI) {
      await window.electronAPI.stopClaudeProcess(projectId);
    }
    setProjects(prev => prev.map(p => 
      p.id === projectId 
        ? { ...p, status: 'idle', output: [], lastActivity: new Date().toLocaleTimeString() }
        : p
    ));
    
    // Also clear the terminal output
    handleClearOutput(projectId);
  };

  // Remove handleSendInput since XTermPanel handles input directly

  const handleClearOutput = (projectId: string) => {
    setProjects(prev => prev.map(project => 
      project.id === projectId 
        ? { ...project, output: [] }
        : project
    ));
  };

  const handleProjectEdit = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setEditingProject(project);
      setIsModalOpen(true);
    }
  };

  const handleProjectDeleteRequest = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setDeleteConfirmation({
        isOpen: true,
        projectId: projectId,
        projectName: project.name
      });
    }
  };

  const handleProjectDeleteConfirm = () => {
    if (deleteConfirmation.projectId) {
      setProjects(prev => prev.filter(project => project.id !== deleteConfirmation.projectId));
      if (selectedProject === deleteConfirmation.projectId) {
        setSelectedProject(null);
      }
    }
    setDeleteConfirmation({
      isOpen: false,
      projectId: null,
      projectName: null
    });
  };

  const handleProjectDeleteCancel = () => {
    setDeleteConfirmation({
      isOpen: false,
      projectId: null,
      projectName: null
    });
  };

  const currentProject = selectedProject ? projects.find(p => p.id === selectedProject) : null;

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Custom Title Bar with Glass Effect */}
      <div 
        className="h-16 glass-titlebar flex items-center justify-center px-4 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <h1 className="text-lg font-medium text-gray-200">Vibe Term</h1>
      </div>
      
      {/* Main Content */}
      <div className={`flex-1 flex overflow-hidden ${missingDeps.length > 0 ? 'pointer-events-none opacity-50' : ''}`}>
        <ProjectList
          projects={projects}
          selectedProject={selectedProject}
          onProjectSelect={handleProjectSelect}
          onProjectStart={handleProjectStart}
          onProjectStop={handleProjectStop}
          onProjectDelete={handleProjectDeleteRequest}
          onProjectEdit={handleProjectEdit}
          onOpenModal={() => {
            setEditingProject(null);
            setIsModalOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <ProjectView
          selectedProject={currentProject || null}
          projects={projects}
        />
      </div>
      
      {/* Dependencies Modal - Blocks everything when dependencies are missing */}
      {missingDeps.length > 0 && (
        <DependenciesModal missingDeps={missingDeps} />
      )}
      
      {/* Project Creation/Edit Modal */}
      {missingDeps.length === 0 && (
        <ProjectModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProject(null);
          }}
          onSubmit={handleProjectAdd}
          editingProject={editingProject}
        />
      )}

      {/* Settings Modal */}
      {missingDeps.length === 0 && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onConfirm={handleProjectDeleteConfirm}
        onCancel={handleProjectDeleteCancel}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteConfirmation.projectName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

export default App;
