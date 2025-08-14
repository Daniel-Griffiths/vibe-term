import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startClaudeProcess: (projectId: string, projectPath: string, command: string) => 
    ipcRenderer.invoke('start-claude-process', projectId, projectPath, command),
  
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
  }
});

export {};