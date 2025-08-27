export interface ElectronAPI {
  startAIProcess: (projectId: string, projectPath: string, command: string, projectName?: string, yoloMode?: boolean) => Promise<{ success: boolean; projectId?: string; error?: string }>;
  stopAIProcess: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  sendInput: (projectId: string, input: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<string | null>;
  onTerminalOutput: (callback: (data: TerminalOutput) => void) => () => void;
  onProcessExit: (callback: (data: ProcessExit) => void) => () => void;
  onAIReady: (callback: (data: { projectId: string; timestamp: number }) => void) => () => void;
  onAIWorking: (callback: (data: { projectId: string; timestamp: number }) => void) => () => void;
  onMissingDependencies: (callback: (deps: string[]) => void) => () => void;
  getGitDiff: (projectPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  saveFile: (projectPath: string, filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  revertFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
  gitCommit: (projectPath: string, message: string) => Promise<{ success: boolean; error?: string }>;
  gitPush: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
  setSelectedProject: (projectId: string | null) => Promise<{ success: boolean }>;
  getLocalIp: () => Promise<{ localIp: string; hasTailscale: boolean }>;
  getProjectFiles: (projectPath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  readProjectFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  readImageFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; data?: string; mimeType?: string; error?: string }>;
  getAppSettings: () => Promise<{ success: boolean; data?: any; error?: string }>;
  updateAppSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getAIProviders: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  checkAIProvider: (providerId: string) => Promise<{ success: boolean; available: boolean; error?: string }>;
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

export enum ItemType {
  PROJECT = 'project',
  PANEL = 'panel',
}

export interface UnifiedItem {
  id: string;
  type: ItemType;
  name: string;
  icon?: string;
  url?: string;
  // Project-specific fields (optional for panels)
  path?: string;
  runCommand?: string;
  yoloMode?: boolean;
  restrictedBranches?: string;
  status?: 'idle' | 'running' | 'ready' | 'working' | 'completed' | 'error';
  lastActivity?: string;
  output?: string[];
}

export interface AppConfig {
  items: UnifiedItem[];  // Only unified array
  settings: {
    editor: {
      theme: string;
    };
    desktop: {
      notifications: boolean;
    };
    webServer: {
      enabled: boolean;
      port: number;
    };
    ai: {
      defaultProvider: string; // Default AI provider ID
    };
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}