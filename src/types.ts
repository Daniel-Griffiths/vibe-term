export interface ElectronAPI {
  startClaudeProcess: (projectId: string, projectPath: string, command: string, projectName?: string, yoloMode?: boolean) => Promise<{ success: boolean; projectId?: string; error?: string }>;
  stopClaudeProcess: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  sendInput: (projectId: string, input: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<string | null>;
  loadAppConfig: () => Promise<AppConfig>;
  saveAppConfig: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;
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
  getLocalIp: () => Promise<{ localIp: string; hasTailscale: boolean }>;
  testDiscordNotification: (discordSettings: any) => Promise<{ success: boolean; error?: string }>;
  sendDiscordNotification: (discordSettings: any, message: string) => Promise<{ success: boolean; error?: string }>;
  getProjectFiles: (projectPath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  readProjectFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
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

export type ItemType = 'project' | 'panel';

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
    discord: {
      enabled: boolean;
      username: string;
      webhookUrl: string;
    };
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}