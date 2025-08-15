import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startClaudeProcess: (projectId: string, projectPath: string, command: string, projectName?: string, yoloMode?: boolean) => 
    ipcRenderer.invoke('start-claude-process', projectId, projectPath, command, projectName, yoloMode),
  
  stopClaudeProcess: (projectId: string) => 
    ipcRenderer.invoke('stop-claude-process', projectId),
  
  sendInput: (projectId: string, input: string) => 
    ipcRenderer.invoke('send-input', projectId, input),
  
  selectDirectory: () => 
    ipcRenderer.invoke('select-directory'),
  
  loadAppConfig: () => 
    ipcRenderer.invoke('load-app-config'),

  saveAppConfig: (config: any) => 
    ipcRenderer.invoke('save-app-config', config),
  
  onTerminalOutput: (callback: (data: any) => void) => {
    ipcRenderer.on('terminal-output', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('terminal-output');
  },
  
  onProcessExit: (callback: (data: any) => void) => {
    ipcRenderer.on('process-exit', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('process-exit');
  },
  
  onClaudeReady: (callback: (data: any) => void) => {
    ipcRenderer.on('claude-ready', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('claude-ready');
  },
  
  onClaudeWorking: (callback: (data: any) => void) => {
    ipcRenderer.on('claude-working', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('claude-working');
  },

  onBackgroundOutput: (callback: (data: any) => void) => {
    ipcRenderer.on('background-output', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('background-output');
  },
  
  onMissingDependencies: (callback: (deps: string[]) => void) => {
    ipcRenderer.on('missing-dependencies', (event, deps) => callback(deps));
    return () => ipcRenderer.removeAllListeners('missing-dependencies');
  },
  
  getGitDiff: (projectPath: string) => 
    ipcRenderer.invoke('get-git-diff', projectPath),
  
  saveFile: (projectPath: string, filePath: string, content: string) => 
    ipcRenderer.invoke('save-file', projectPath, filePath, content),
  
  revertFile: (projectPath: string, filePath: string) => 
    ipcRenderer.invoke('revert-file', projectPath, filePath),
  
  gitCommit: (projectPath: string, message: string) => 
    ipcRenderer.invoke('git-commit', projectPath, message),
  
  gitPush: (projectPath: string) => 
    ipcRenderer.invoke('git-push', projectPath),
  
  setSelectedProject: (projectId: string | null) => 
    ipcRenderer.invoke('set-selected-project', projectId),
  
  loadSettings: () => 
    ipcRenderer.invoke('load-settings'),
  
  saveSettings: (settings: any) => 
    ipcRenderer.invoke('save-settings', settings),
  
  getLocalIp: () =>
    ipcRenderer.invoke('get-local-ip'),
  
  testDiscordNotification: (discordSettings: any) => 
    ipcRenderer.invoke('test-discord-notification', discordSettings),
  
  sendDiscordNotification: (discordSettings: any, message: string) => 
    ipcRenderer.invoke('send-discord-notification', discordSettings, message),

  testCommand: (projectPath: string, command: string) => 
    ipcRenderer.invoke('test-command', projectPath, command),
  
  getProjectFiles: (projectPath: string) => 
    ipcRenderer.invoke('get-project-files', projectPath),
  
  readProjectFile: (projectPath: string, filePath: string) => 
    ipcRenderer.invoke('read-project-file', projectPath, filePath)
});

export {};