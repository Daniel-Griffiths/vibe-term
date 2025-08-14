export interface ElectronAPI {
  startClaudeProcess: (projectId: string, projectPath: string, command: string) => Promise<{ success: boolean; projectId?: string; error?: string }>;
  stopClaudeProcess: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  sendInput: (projectId: string, input: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<string | null>;
  loadProjects: () => Promise<Project[]>;
  saveProjects: (projects: any[]) => Promise<{ success: boolean }>;
  onTerminalOutput: (callback: (data: TerminalOutput) => void) => () => void;
  onProcessExit: (callback: (data: ProcessExit) => void) => () => void;
  onClaudeReady: (callback: (data: { projectId: string; timestamp: number }) => void) => () => void;
  onClaudeWorking: (callback: (data: { projectId: string; timestamp: number }) => void) => () => void;
}

export interface TerminalOutput {
  projectId: string;
  data: string;
  type: 'stdout' | 'stderr';
}

export interface ProcessExit {
  projectId: string;
  code: number | null;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'idle' | 'running' | 'ready' | 'working' | 'completed' | 'error';
  lastActivity: string;
  output: string[];
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}