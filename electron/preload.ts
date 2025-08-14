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
  
  loadProjects: () => 
    ipcRenderer.invoke('load-projects'),
  
  saveProjects: (projects: any[]) => 
    ipcRenderer.invoke('save-projects', projects),
  
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
  
  testDiscordNotification: (discordSettings: any) => 
    ipcRenderer.invoke('test-discord-notification', discordSettings),
  
  sendDiscordNotification: (discordSettings: any, message: string) => 
    ipcRenderer.invoke('send-discord-notification', discordSettings, message)
});

export {};