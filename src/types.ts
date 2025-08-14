export interface ElectronAPI {
  startClaudeProcess: (projectId: string, projectPath: string, command: string, projectName?: string, yoloMode?: boolean) => Promise<{ success: boolean; projectId?: string; error?: string }>;
  stopClaudeProcess: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  sendInput: (projectId: string, input: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<string | null>;
  loadProjects: () => Promise<Project[]>;
  saveProjects: (projects: any[]) => Promise<{ success: boolean }>;
  onTerminalOutput: (callback: (data: TerminalOutput) => void) => () => void;
  onProcessExit: (callback: (data: ProcessExit) => void) => () => void;
  onClaudeReady: (callback: (data: { projectId: string; timestamp: number }) => void) => () => void;
  onClaudeWorking: (callback: (data: { projectId: string; timestamp: number }) => void) => () => void;
  onMissingDependencies: (callback: (deps: string[]) => void) => () => void;
  getGitDiff: (projectPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  saveFile: (projectPath: string, filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  revertFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
  gitCommit: (projectPath: string, message: string) => Promise<{ success: boolean; error?: string }>;
  gitPush: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
  setSelectedProject: (projectId: string | null) => Promise<{ success: boolean }>;
  loadSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getLocalIp: () => Promise<string>;
  testDiscordNotification: (discordSettings: any) => Promise<{ success: boolean; error?: string }>;
  sendDiscordNotification: (discordSettings: any, message: string) => Promise<{ success: boolean; error?: string }>;
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
  icon?: string;
  runCommand?: string;
  previewUrl?: string;
  yoloMode?: boolean;
  restrictedBranches?: string;
  status: 'idle' | 'running' | 'ready' | 'working' | 'completed' | 'error';
  lastActivity: string;
  output: string[];
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}