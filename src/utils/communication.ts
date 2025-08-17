/**
 * Universal communication utility that handles both Electron IPC and web API calls
 * depending on the environment.
 */

export interface ICommunicationAPI {
  // Project management
  startClaudeProcess: (projectId: string, projectPath: string, command?: string, projectName?: string, yoloMode?: boolean) => Promise<any>;
  stopClaudeProcess: (projectId: string) => Promise<any>;
  sendInput: (projectId: string, input: string) => Promise<any>;
  setSelectedProject: (projectId: string | null) => Promise<any>;
  
  // File system
  selectDirectory: () => Promise<string | null>;
  getProjectFiles: (projectPath: string) => Promise<any>;
  readProjectFile: (projectPath: string, filePath: string) => Promise<any>;
  readImageFile: (projectPath: string, filePath: string) => Promise<any>;
  saveFile: (projectPath: string, filePath: string, content: string) => Promise<any>;
  
  // Git operations
  getGitDiff: (projectPath: string) => Promise<any>;
  revertFile: (projectPath: string, filePath: string) => Promise<any>;
  gitCommit: (projectPath: string, message: string) => Promise<any>;
  gitPush: (projectPath: string) => Promise<any>;
  
  // Settings and config
  loadAppConfig: () => Promise<any>;
  saveAppConfig: (config: any) => Promise<any>;
  loadSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<any>;
  writeStateFile: (state: any) => Promise<any>;
  
  // Network and utilities
  getLocalIp: () => Promise<any>;
  testCommand: (projectPath: string, command: string) => Promise<any>;
  
  // Discord notifications
  testDiscordNotification: (discordSettings: any) => Promise<any>;
  sendDiscordNotification: (discordSettings: any, message: string) => Promise<any>;
  
  // Data management (new Electron-based storage)
  getStoredItems: () => Promise<any>;
  addStoredItem: (item: any) => Promise<any>;
  updateStoredItem: (id: string, updates: any) => Promise<any>;
  deleteStoredItem: (id: string) => Promise<any>;
  getAppSettings: () => Promise<any>;
  updateAppSettings: (settings: any) => Promise<any>;
  
  // Event listeners (only available in Electron)
  onTerminalOutput?: (callback: (data: any) => void) => () => void;
  onProcessExit?: (callback: (data: any) => void) => () => void;
  onClaudeReady?: (callback: (data: any) => void) => () => void;
  onClaudeWorking?: (callback: (data: any) => void) => () => void;
  onBackgroundOutput?: (callback: (data: any) => void) => () => void;
  onMissingDependencies?: (callback: (deps: string[]) => void) => () => void;
  onMainProcessReady?: (callback: () => void) => () => void;
}

class WebCommunicationAPI implements ICommunicationAPI {
  private async callAPI(handlerName: string, args: any[] = []): Promise<any> {
    const response = await fetch(`/api/ipc/${handlerName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args })
    });
    return await response.json();
  }

  async startClaudeProcess(projectId: string, projectPath: string, command?: string, projectName?: string, yoloMode?: boolean): Promise<any> {
    return this.callAPI('start-claude-process', [projectId, projectPath, command, projectName, yoloMode]);
  }

  async stopClaudeProcess(projectId: string): Promise<any> {
    return this.callAPI('stop-claude-process', [projectId]);
  }

  async sendInput(projectId: string, input: string): Promise<any> {
    return this.callAPI('send-input', [projectId, input]);
  }

  async setSelectedProject(projectId: string | null): Promise<any> {
    return this.callAPI('set-selected-project', [projectId]);
  }

  async selectDirectory(): Promise<string | null> {
    // In web environment, this would need a different implementation
    // For now, return null as we can't open file dialogs in web
    return null;
  }

  async getProjectFiles(projectPath: string): Promise<any> {
    return this.callAPI('get-project-files', [projectPath]);
  }

  async readProjectFile(projectPath: string, filePath: string): Promise<any> {
    return this.callAPI('read-project-file', [projectPath, filePath]);
  }

  async readImageFile(projectPath: string, filePath: string): Promise<any> {
    return this.callAPI('read-image-file', [projectPath, filePath]);
  }

  async saveFile(projectPath: string, filePath: string, content: string): Promise<any> {
    return this.callAPI('save-file', [projectPath, filePath, content]);
  }

  async getGitDiff(projectPath: string): Promise<any> {
    return this.callAPI('get-git-diff', [projectPath]);
  }

  async revertFile(projectPath: string, filePath: string): Promise<any> {
    return this.callAPI('revert-file', [projectPath, filePath]);
  }

  async gitCommit(projectPath: string, message: string): Promise<any> {
    return this.callAPI('git-commit', [projectPath, message]);
  }

  async gitPush(projectPath: string): Promise<any> {
    return this.callAPI('git-push', [projectPath]);
  }

  async loadAppConfig(): Promise<any> {
    return this.callAPI('load-app-config');
  }

  async saveAppConfig(config: any): Promise<any> {
    return this.callAPI('save-app-config', [config]);
  }

  async loadSettings(): Promise<any> {
    return this.callAPI('load-settings');
  }

  async saveSettings(settings: any): Promise<any> {
    return this.callAPI('save-settings', [settings]);
  }

  async writeStateFile(state: any): Promise<any> {
    return this.callAPI('write-state-file', [state]);
  }

  async getLocalIp(): Promise<any> {
    return this.callAPI('get-local-ip');
  }

  async testCommand(projectPath: string, command: string): Promise<any> {
    return this.callAPI('test-command', [projectPath, command]);
  }

  async testDiscordNotification(discordSettings: any): Promise<any> {
    return this.callAPI('test-discord-notification', [discordSettings]);
  }

  async sendDiscordNotification(discordSettings: any, message: string): Promise<any> {
    return this.callAPI('send-discord-notification', [discordSettings, message]);
  }

  // Data management methods
  async getStoredItems(): Promise<any> {
    return this.callAPI('get-stored-items');
  }

  async addStoredItem(item: any): Promise<any> {
    return this.callAPI('add-stored-item', [item]);
  }

  async updateStoredItem(id: string, updates: any): Promise<any> {
    return this.callAPI('update-stored-item', [id, updates]);
  }

  async deleteStoredItem(id: string): Promise<any> {
    return this.callAPI('delete-stored-item', [id]);
  }

  async getAppSettings(): Promise<any> {
    return this.callAPI('get-app-settings');
  }

  async updateAppSettings(settings: any): Promise<any> {
    return this.callAPI('update-app-settings', [settings]);
  }

  // Terminal event methods - use WebSocket for web version
  onTerminalOutput(callback: (data: any) => void): () => void {
    return webSocketManager?.on('terminal-output', callback) || (() => {});
  }

  onProcessExit(callback: (data: any) => void): () => void {
    return webSocketManager?.on('process-exit', callback) || (() => {});
  }

  onClaudeReady(callback: (data: any) => void): () => void {
    return webSocketManager?.on('claude-ready', callback) || (() => {});
  }

  onClaudeWorking(callback: (data: any) => void): () => void {
    return webSocketManager?.on('claude-working', callback) || (() => {});
  }

  onBackgroundOutput(callback: (data: any) => void): () => void {
    return webSocketManager?.on('background-output', callback) || (() => {});
  }

  onMissingDependencies(callback: (deps: string[]) => void): () => void {
    return webSocketManager?.on('missing-dependencies', callback) || (() => {});
  }

  onMainProcessReady(callback: () => void): () => void {
    return webSocketManager?.on('main-process-ready', callback) || (() => {});
  }
}

class ElectronCommunicationAPI implements ICommunicationAPI {
  private electronAPI: any;

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  async startClaudeProcess(projectId: string, projectPath: string, command?: string, projectName?: string, yoloMode?: boolean): Promise<any> {
    return this.electronAPI.startClaudeProcess(projectId, projectPath, command, projectName, yoloMode);
  }

  async stopClaudeProcess(projectId: string): Promise<any> {
    return this.electronAPI.stopClaudeProcess(projectId);
  }

  async sendInput(projectId: string, input: string): Promise<any> {
    return this.electronAPI.sendInput(projectId, input);
  }

  async setSelectedProject(projectId: string | null): Promise<any> {
    return this.electronAPI.setSelectedProject(projectId);
  }

  async selectDirectory(): Promise<string | null> {
    return this.electronAPI.selectDirectory();
  }

  async getProjectFiles(projectPath: string): Promise<any> {
    return this.electronAPI.getProjectFiles(projectPath);
  }

  async readProjectFile(projectPath: string, filePath: string): Promise<any> {
    return this.electronAPI.readProjectFile(projectPath, filePath);
  }

  async readImageFile(projectPath: string, filePath: string): Promise<any> {
    return this.electronAPI.readImageFile(projectPath, filePath);
  }

  async saveFile(projectPath: string, filePath: string, content: string): Promise<any> {
    return this.electronAPI.saveFile(projectPath, filePath, content);
  }

  async getGitDiff(projectPath: string): Promise<any> {
    return this.electronAPI.getGitDiff(projectPath);
  }

  async revertFile(projectPath: string, filePath: string): Promise<any> {
    return this.electronAPI.revertFile(projectPath, filePath);
  }

  async gitCommit(projectPath: string, message: string): Promise<any> {
    return this.electronAPI.gitCommit(projectPath, message);
  }

  async gitPush(projectPath: string): Promise<any> {
    return this.electronAPI.gitPush(projectPath);
  }

  async loadAppConfig(): Promise<any> {
    return this.electronAPI.loadAppConfig();
  }

  async saveAppConfig(config: any): Promise<any> {
    return this.electronAPI.saveAppConfig(config);
  }

  async loadSettings(): Promise<any> {
    return this.electronAPI.loadSettings();
  }

  async saveSettings(settings: any): Promise<any> {
    return this.electronAPI.saveSettings(settings);
  }

  async writeStateFile(state: any): Promise<any> {
    return this.electronAPI.writeStateFile(state);
  }

  async getLocalIp(): Promise<any> {
    return this.electronAPI.getLocalIp();
  }

  async testCommand(projectPath: string, command: string): Promise<any> {
    return this.electronAPI.testCommand(projectPath, command);
  }

  async testDiscordNotification(discordSettings: any): Promise<any> {
    return this.electronAPI.testDiscordNotification(discordSettings);
  }

  async sendDiscordNotification(discordSettings: any, message: string): Promise<any> {
    return this.electronAPI.sendDiscordNotification(discordSettings, message);
  }

  // Data management methods
  async getStoredItems(): Promise<any> {
    return this.electronAPI.getStoredItems();
  }

  async addStoredItem(item: any): Promise<any> {
    return this.electronAPI.addStoredItem(item);
  }

  async updateStoredItem(id: string, updates: any): Promise<any> {
    return this.electronAPI.updateStoredItem(id, updates);
  }

  async deleteStoredItem(id: string): Promise<any> {
    return this.electronAPI.deleteStoredItem(id);
  }

  async getAppSettings(): Promise<any> {
    return this.electronAPI.getAppSettings();
  }

  async updateAppSettings(settings: any): Promise<any> {
    return this.electronAPI.updateAppSettings(settings);
  }

  onTerminalOutput(callback: (data: any) => void): () => void {
    return this.electronAPI.onTerminalOutput(callback);
  }

  onProcessExit(callback: (data: any) => void): () => void {
    return this.electronAPI.onProcessExit(callback);
  }

  onClaudeReady(callback: (data: any) => void): () => void {
    return this.electronAPI.onClaudeReady(callback);
  }

  onClaudeWorking(callback: (data: any) => void): () => void {
    return this.electronAPI.onClaudeWorking(callback);
  }

  onBackgroundOutput(callback: (data: any) => void): () => void {
    return this.electronAPI.onBackgroundOutput(callback);
  }

  onMissingDependencies(callback: (deps: string[]) => void): () => void {
    return this.electronAPI.onMissingDependencies(callback);
  }

  onMainProcessReady(callback: () => void): () => void {
    return this.electronAPI.onMainProcessReady(callback);
  }
}

// Environment detection
export const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
export const isWeb = !isElectron;


// Create the appropriate API instance
export const communicationAPI: ICommunicationAPI = isElectron 
  ? new ElectronCommunicationAPI() 
  : new WebCommunicationAPI();

// WebSocket communication for web environment
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    if (isWeb) {
      this.connect();
    }
  }

  private connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connection-status', { status: 'connected' });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit(message.type, message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        this.emit('connection-status', { status: 'disconnected' });
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('connection-status', { status: 'error', error });
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Global WebSocket manager for web environment
export const webSocketManager = isWeb ? new WebSocketManager() : null;