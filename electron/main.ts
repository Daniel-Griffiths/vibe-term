import { app, BrowserWindow, ipcMain, shell, Notification, dialog } from 'electron';
import fs from 'fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as pty from 'node-pty';
import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createServer } from 'http';
import net from 'net';
import { ShellUtils } from '../src/utils/shellUtils';
import { StorageService } from '../src/services/StorageService';
import { IPCService } from '../src/services/IPCService';

const execAsync = promisify(exec);

// Test variable to force missing dependencies modal
const FORCE_SHOW_DEPENDENCIES_MODAL = false; // Set to true for testing

// Check for required dependencies
async function checkDependencies(): Promise<string[]> {
  const missing: string[] = [];
  
  // Force missing dependencies for testing
  if (FORCE_SHOW_DEPENDENCIES_MODAL) {
    console.log('🧪 TESTING: Forcing missing dependencies modal');
    return ['tmux', 'claude'];
  }
  
  // Check tmux
  const tmuxAvailable = await ShellUtils.checkDependency('tmux');
  if (tmuxAvailable) {
    console.log('✅ tmux is installed');
  } else {
    missing.push('tmux');
    console.log('❌ tmux is not installed');
  }
  
  // Check claude
  const claudeAvailable = await ShellUtils.checkDependency('claude');
  if (claudeAvailable) {
    console.log('✅ claude is installed');
  } else {
    missing.push('claude');
    console.log('❌ claude is not installed');
  }
  
  return missing;
}

const DEFAULT_WEB_SERVER_PORT = 6969;

// Safely import liquid glass with fallback
let liquidGlass: any = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let win: BrowserWindow | null;
const processes = new Map<string, ChildProcess>(); // Legacy - kept for compatibility
const sharedPtyProcesses = new Map<string, any>(); // Shared PTY processes for both desktop and web
const terminalBuffers = new Map<string, string>(); // Store terminal history for each project
const backgroundProcesses = new Map<string, any>(); // Background start command processes

// Track currently selected project for notifications
let currentlySelectedProject: string | null = null;

// Web server variables
let webServer: any = null;
let webSocketServer: WebSocketServer | null = null;
const webClients = new Set<any>();

// Storage functions using StorageService
const loadProjects = () => StorageService.loadProjects().data || [];
const saveProjects = (projects: any[]) => StorageService.saveProjects(projects);
const loadSettings = () => StorageService.loadSettings().data;
const saveSettings = (settings: any) => StorageService.saveSettings(settings);

// Setup IPC handlers using IPCService
function setupIPCHandlers() {
  // Process management
  IPCService.handle('start-claude-process', async (projectId: string, projectPath: string, command: string, projectName?: string, yoloMode?: boolean) => {
    return await getOrCreateSharedPty(projectId, projectPath, projectName, yoloMode, command);
  });

  IPCService.handle('stop-claude-process', async (projectId: string) => {
    const proc = sharedPtyProcesses.get(projectId);
    const backgroundProc = backgroundProcesses.get(projectId);
    
    // Kill both PTY and background processes
    if (proc) {
      proc.kill();
      sharedPtyProcesses.delete(projectId);
    }
    
    if (backgroundProc) {
      backgroundProc.kill('SIGTERM');
      backgroundProcesses.delete(projectId);
    }
    
    return { success: true };
  });

  IPCService.handle('send-input', async (projectId: string, input: string) => {
    const proc = sharedPtyProcesses.get(projectId);
    if (proc) {
      proc.write(input);
      return { success: true };
    }
    return { success: false, error: 'Process not found' };
  });

  // Storage operations
  IPCService.handle('load-projects', () => loadProjects());
  IPCService.handle('save-projects', (projects: any[]) => {
    saveProjects(projects);
    return undefined; // Simple success
  });
  
  IPCService.handle('load-settings', () => loadSettings());
  IPCService.handle('save-settings', (settings: any) => {
    saveSettings(settings);
    return undefined; // Simple success
  });

  // Command testing
  IPCService.handle('test-command', async (projectPath: string, command: string) => {
    console.log(`[Test] Testing command "${command}" in ${projectPath}`);
    
    const result = await ShellUtils.execute(command, {
      cwd: projectPath,
      timeout: 30000
    });

    return {
      success: result.success,
      output: result.output || '',
      error: result.error || ''
    };
  });

  // Directory selection
  IPCService.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    });
    
    return result.canceled ? null : result.filePaths[0];
  });

  console.log('[IPC] Registered handlers:', IPCService.getRegisteredChannels());
}

// Discord notification function
const sendDiscordNotification = async (webhookUrl: string, username: string, content: string) => {
  try {
    const https = require('https');
    const url = require('url');
    
    const parsedUrl = url.parse(webhookUrl);
    const data = JSON.stringify({
      username: username,
      content: content
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          reject(new Error(`Discord webhook returned status ${res.statusCode}`));
        }
      });

      req.on('error', (error: any) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  } catch (error) {
    throw error;
  }
};

// Web server setup
async function checkPortAvailable(port: number) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(port));
    });
    
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Please stop the process using this port or choose a different port.`));
      } else {
        reject(err);
      }
    });
  });
}

async function createWebServer(preferredPort = DEFAULT_WEB_SERVER_PORT) {
  const port = await checkPortAvailable(preferredPort);
  const app = express();
  const server = createServer(app);
  
  // Enable CORS for all routes
  app.use(cors());
  app.use(express.json());
  
  // Serve static files (we'll create a simple mobile-friendly interface)
  const webStaticPath = path.join(__dirname, '..', 'web');
  app.use(express.static(webStaticPath));
  
  // API Routes
  app.get('/api/projects', (req, res) => {
    const projects = loadProjects();
    res.json({ success: true, data: projects });
  });
  
  app.get('/api/settings', (req, res) => {
    const settings = loadSettings();
    res.json({ success: true, data: settings });
  });
  
  app.post('/api/projects/:id/start', async (req, res) => {
    const { id } = req.params;
    const { command, projectName, yoloMode } = req.body;
    
    try {
      const projects = loadProjects();
      const project = projects.find((p: any) => p.id === id);
      
      if (!project) {
        return res.json({ success: false, error: 'Project not found' });
      }
      
      // Use the start command from the request, or fall back to project's runCommand
      const startCommand = command || project.runCommand;
      
      // Use or create shared PTY process
      const result = await getOrCreateSharedPty(id, project.path, projectName, yoloMode, startCommand);
      if (result.success) {
        res.json({ success: true });
      } else {
        res.json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/projects/:id/stop', async (req, res) => {
    const { id } = req.params;
    const proc = sharedPtyProcesses.get(id);
    const backgroundProc = backgroundProcesses.get(id);
    
    // Kill both PTY and background processes
    if (proc) {
      proc.kill();
      sharedPtyProcesses.delete(id);
    }
    
    if (backgroundProc) {
      console.log(`[${id}] Stopping background process`);
      backgroundProc.kill('SIGTERM');
      backgroundProcesses.delete(id);
    }
    
    // Clean up terminal buffer
    terminalBuffers.delete(id);
    
    broadcastToWebClients({ 
      type: 'project-stopped',
      projectId: id
    });
    
    res.json({ success: true });
  });
  
  app.post('/api/projects/:id/input', async (req, res) => {
    const { id } = req.params;
    const { input } = req.body;
    const proc = sharedPtyProcesses.get(id);
    
    if (proc) {
      proc.write(input);
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Process not found' });
    }
  });
  
  app.post('/api/projects/:id/resize', async (req, res) => {
    const { id } = req.params;
    const { cols, rows } = req.body;
    const proc = sharedPtyProcesses.get(id);
    
    if (proc) {
      console.log(`[${id}] Resizing PTY to ${cols}×${rows}`);
      proc.resize(cols, rows);
      
      // Also notify desktop client of the new dimensions
      if (win && !win.isDestroyed()) {
        win.webContents.send('terminal-resize', { 
          projectId: id, 
          cols, 
          rows 
        });
      }
      
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Process not found' });
    }
  });
  
  app.get('/api/projects/:id/history', async (req, res) => {
    const { id } = req.params;
    const buffer = terminalBuffers.get(id) || '';
    res.json({ success: true, data: buffer });
  });
  
  // WebSocket setup
  webSocketServer = new WebSocketServer({ server });
  
  webSocketServer.on('connection', (ws) => {
    console.log('Web client connected');
    webClients.add(ws);
    
    // Send current projects state
    const projects = loadProjects();
    ws.send(JSON.stringify({ 
      type: 'projects-state',
      data: projects
    }));
    
    ws.on('close', () => {
      console.log('Web client disconnected');
      webClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      webClients.delete(ws);
    });
  });
  
  return new Promise((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`Web server started on http://0.0.0.0:${port}`);
      resolve({ server, port });
    }).on('error', (error) => {
      console.error('Failed to start web server:', error);
      reject(error);
    });
  });
}

// Shared PTY process management
async function getOrCreateSharedPty(projectId: string, projectPath: string, projectName?: string, yoloMode?: boolean, startCommand?: string) {
  try {
    // If PTY already exists, just return success
    if (sharedPtyProcesses.has(projectId)) {
      console.log(`[${projectId}] Using existing shared PTY process`);
      return { success: true, projectId };
    }

    const sessionBase = projectName || projectId;
    const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);
    
    console.log(`[${projectId}] Creating shared PTY for tmux session: ${tmuxSessionName}`);
    
    // Try to attach to existing session, or create new one if it doesn't exist
    const attachCommand = ShellUtils.attachTmuxSessionCommand(tmuxSessionName);
    const createCommand = ShellUtils.createTmuxSessionCommand(tmuxSessionName, projectPath);
    const tmuxCommand = `${ShellUtils.checkTmuxSessionCommand(tmuxSessionName)} 2>/dev/null && ${attachCommand} || ${createCommand} \\; set-option status off`;
    
    const proc = pty.spawn(ShellUtils.getPreferredShell(), ['-l', '-c', tmuxCommand], {
      cwd: projectPath,
      env: { 
        ...process.env,
        PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
        CLICOLOR_FORCE: '1',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'vscode',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        LC_CTYPE: 'en_US.UTF-8'
      },
      cols: 80,
      rows: 24
    });

    sharedPtyProcesses.set(projectId, proc);

    // Check if we're attaching to existing session or creating new one
    let isNewSession = true;
    try {
      const result = await ShellUtils.execute(ShellUtils.checkTmuxSessionCommand(tmuxSessionName));
      isNewSession = !result.success;
    } catch (e) {
      // Error checking, assume new session
    }
    
    // Start background process if provided (regardless of session state)
    if (startCommand) {
      console.log(`[${projectId}] Starting background process: ${startCommand} (isNewSession: ${isNewSession})`);
      console.log(`[${projectId}] Working directory: ${projectPath}`);
      
      const backgroundProc = spawn('/bin/zsh', ['-l', '-c', startCommand], {
        cwd: projectPath,
        env: { 
          ...process.env,
          PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
        },
        stdio: 'pipe'
      });
      
      backgroundProcesses.set(projectId, backgroundProc);
      
      // Send background process output to output terminal
      backgroundProc.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`[${projectId}] Background stdout:`, output);
        
        // Send to desktop output terminal
        if (win && !win.isDestroyed()) {
          win.webContents.send('background-output', { 
            projectId, 
            data: output,
            type: 'stdout' 
          });
        }
        
        // Send to web output terminal
        broadcastToWebClients({ 
          type: 'background-output',
          projectId: projectId,
          data: output
        });
      });
      
      backgroundProc.stderr?.on('data', (data) => {
        const output = data.toString();
        console.log(`[${projectId}] Background stderr:`, output);
        
        // Send to desktop output terminal
        if (win && !win.isDestroyed()) {
          win.webContents.send('background-output', { 
            projectId, 
            data: `\x1b[31m${output}\x1b[0m`, // Red text for errors
            type: 'stderr' 
          });
        }
        
        // Send to web output terminal
        broadcastToWebClients({ 
          type: 'background-output',
          projectId: projectId,
          data: `\x1b[31m${output}\x1b[0m` // Red text for errors
        });
      });
      
      backgroundProc.on('exit', (code) => {
        console.log(`[${projectId}] Background process exited with code:`, code);
        const exitMessage = `\x1b[33m[Process exited with code ${code}]\x1b[0m\r\n`; // Yellow text
        
        // Send to desktop output terminal
        if (win && !win.isDestroyed()) {
          win.webContents.send('background-output', { 
            projectId, 
            data: exitMessage,
            type: 'system' 
          });
        }
        
        // Send to web output terminal
        broadcastToWebClients({ 
          type: 'background-output',
          projectId: projectId,
          data: exitMessage
        });
        
        backgroundProcesses.delete(projectId);
      });
      
      backgroundProc.on('error', (error) => {
        console.log(`[${projectId}] Background process error:`, error);
        const errorMessage = `\x1b[31m[Error: ${error.message}]\x1b[0m\r\n`; // Red text
        
        // Send to desktop output terminal
        if (win && !win.isDestroyed()) {
          win.webContents.send('background-output', { 
            projectId, 
            data: errorMessage,
            type: 'error' 
          });
        }
        
        // Send to web output terminal
        broadcastToWebClients({ 
          type: 'background-output',
          projectId: projectId,
          data: errorMessage
        });
      });
    }
    
    // Send initial message to both desktop and web
    const initialMessage = isNewSession 
      ? `Creating new tmux session "${tmuxSessionName}" in ${projectPath}\r\n`
      : `Attaching to existing tmux session "${tmuxSessionName}"\r\n`;
    
    // Send to desktop if window exists
    if (win && !win.isDestroyed()) {
      win.webContents.send('terminal-output', { 
        projectId, 
        data: initialMessage, 
        type: 'system' 
      });
    }
    
    // Send to web clients
    broadcastToWebClients({ 
      type: 'project-started',
      projectId: projectId,
      data: initialMessage
    });

    // Auto-start Claude Code if this is a new session
    if (isNewSession) {
      setTimeout(() => {
        if (proc && sharedPtyProcesses.has(projectId)) {
          const claudeCommand = yoloMode ? 'claude --dangerously-skip-permissions\r' : 'claude\r';
          console.log(`[${projectId}] Auto-starting Claude Code in new tmux session with command: ${claudeCommand.trim()}`);
          proc.write(claudeCommand);
        }
      }, 200);
    }

    // Track the most recent state indicator
    let lastStateIndicator = null;
    let statusChangeTimeout = null;

    // Debounced status change function
    const sendStatusChange = (status, delay = 1000) => {
      if (statusChangeTimeout) {
        clearTimeout(statusChangeTimeout);
      }
      
      statusChangeTimeout = setTimeout(() => {
        if (status === 'ready') {
          // Send to desktop
          if (win && !win.isDestroyed()) {
            win.webContents.send('claude-ready', { 
              projectId,
              timestamp: Date.now()
            });
          }
          
          // Send to web clients
          broadcastToWebClients({ 
            type: 'project-ready',
            projectId: projectId,
            timestamp: Date.now()
          });
          
          // Send desktop notification if window is not focused and notifications are enabled
          const settings = loadSettings();
          const desktopNotificationsEnabled = settings?.desktop?.notifications !== false; // Default to true
          const windowFocused = win && !win.isDestroyed() && win.isFocused();
          
          console.log(`[${projectId}] Notification check: windowFocused="${windowFocused}", notificationsEnabled="${desktopNotificationsEnabled}"`);
          
          if (!windowFocused && desktopNotificationsEnabled) {
            // Get the actual project name from saved projects
            const projects = loadProjects();
            const project = projects.find((p: any) => p.id === projectId);
            const projectDisplayName = project?.name || projectId;
            const notification = new Notification({
              title: `${projectDisplayName} finished`,
              body: 'Claude Code process completed',
              icon: path.join(process.env.APP_ROOT || '', 'public', 'icon.png'),
              silent: false
            });
            
            notification.show();
            
            notification.on('click', () => {
              if (win) {
                if (win.isMinimized()) win.restore();
                win.focus();
              }
            });

            // Also send Discord notification if configured
            const settings = loadSettings();
            if (settings?.discord?.enabled && settings?.discord?.webhookUrl) {
              const discordMessage = `🎯 **Project Finished**\n\n**${projectDisplayName}** has completed successfully and is ready for input.`;
              sendDiscordNotification(
                settings.discord.webhookUrl,
                settings.discord.username || 'Vibe Term',
                discordMessage
              ).catch(error => {
                console.error('Failed to send Discord notification:', error);
              });
            }
          }
        } else if (status === 'working') {
          // Send to desktop
          if (win && !win.isDestroyed()) {
            win.webContents.send('claude-working', { 
              projectId,
              timestamp: Date.now()
            });
          }
          
          // Send to web clients
          broadcastToWebClients({ 
            type: 'project-working',
            projectId: projectId,
            timestamp: Date.now()
          });
        }
        statusChangeTimeout = null;
      }, delay);
    };

    // Handle PTY output - send to both desktop and web
    proc.onData((data) => {
      console.log(`[${projectId}] PTY DATA:`, data);
      
      // Check if process still exists before handling data
      if (!sharedPtyProcesses.has(projectId)) {
        return;
      }
      
      try {
        // Accumulate terminal history (keep last 10KB to avoid memory issues)
        const currentBuffer = terminalBuffers.get(projectId) || '';
        const newBuffer = currentBuffer + data;
        // Keep only last 10KB of history
        const trimmedBuffer = newBuffer.length > 10000 ? newBuffer.slice(-10000) : newBuffer;
        terminalBuffers.set(projectId, trimmedBuffer);
        // Check for circle (⏺) - Claude finished
        if (data.includes('⏺')) {
          lastStateIndicator = 'finished';
          console.log(`[${projectId}] *** CLAUDE FINISHED (⏺ detected) ***`);
          
          // Check if input box appears in the same data
          if ((data.includes('│') && data.includes('>')) || 
              (data.includes('╭') && data.includes('╰'))) {
            console.log(`[${projectId}] *** CLAUDE IS READY FOR INPUT ***`);
            sendStatusChange('ready');
          } else {
            // Wait a bit for input box to appear
            setTimeout(() => {
              sendStatusChange('ready');
            }, 100);
          }
        }
        // Check for asterisk/star symbols - Claude working
        else if (data.match(/[✳✽✻✶✢]/)) {
          if (lastStateIndicator !== 'working') {
            lastStateIndicator = 'working';
            console.log(`[${projectId}] *** CLAUDE IS WORKING/THINKING ***`);
            sendStatusChange('working');
          }
        }
        // Check for input box (initial ready state)
        else if ((data.includes('│') && data.includes('>')) || 
                 (data.includes('╭') && data.includes('╰')) ||
                 data.includes('⏵⏵')) {
          if (lastStateIndicator !== 'ready') {
            lastStateIndicator = 'ready';
            console.log(`[${projectId}] *** CLAUDE IS READY FOR INPUT (initial) ***`);
            sendStatusChange('ready');
          }
        }
        
        // Send to desktop
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal-output', { 
            projectId, 
            data: data, 
            type: 'stdout' 
          });
        }
        
        // Send to web clients
        broadcastToWebClients({ 
          type: 'terminal-output',
          projectId: projectId,
          data: data
        });
      } catch (error) {
        console.error(`Error handling PTY output for project ${projectId}:`, error);
        // Clean up the process if it's causing errors
        sharedPtyProcesses.delete(projectId);
        terminalBuffers.delete(projectId);
      }
    });

    proc.on('exit', (code) => {
      console.log(`[${projectId}] Shared PTY process exit:`, code);
      
      // Send to desktop
      if (win && !win.isDestroyed()) {
        win.webContents.send('process-exit', { projectId, code });
        win.webContents.send('terminal-output', { 
          projectId, 
          data: `\nTerminal session ended with code ${code}\n`, 
          type: 'system' 
        });
      }
      
      // Send to web clients
      broadcastToWebClients({ 
        type: 'process-exit',
        projectId: projectId,
        code: code
      });
      
      // Send desktop notification for non-zero exit codes if window is not focused
      if (code !== 0) {
        const settings = loadSettings();
        const desktopNotificationsEnabled = settings?.desktop?.notifications !== false; // Default to true
        const windowFocused = win && !win.isDestroyed() && win.isFocused();
        
        if (!windowFocused && desktopNotificationsEnabled) {
          const projects = loadProjects();
          const project = projects.find((p: any) => p.id === projectId);
          const projectDisplayName = project?.name || projectId;
          const notification = new Notification({
            title: `${projectDisplayName} failed`,
            body: `Process exited with code ${code}`,
            icon: path.join(process.env.APP_ROOT || '', 'public', 'icon.png'),
            silent: false
          });
          
          notification.show();
          
          notification.on('click', () => {
            if (win) {
              if (win.isMinimized()) win.restore();
              win.focus();
            }
          });
        }
      }
      
      sharedPtyProcesses.delete(projectId);
      terminalBuffers.delete(projectId);
    });

    proc.on('error', (error) => {
      console.log(`[${projectId}] Shared PTY process error:`, error);
      
      // Send to desktop
      if (win && !win.isDestroyed()) {
        win.webContents.send('terminal-output', { 
          projectId, 
          data: `Error: ${error.message}\n`, 
          type: 'error' 
        });
      }
      
      // Send desktop notification for errors if window is not focused
      const settings = loadSettings();
      const desktopNotificationsEnabled = settings?.desktop?.notifications !== false; // Default to true
      const windowFocused = win && !win.isDestroyed() && win.isFocused();
      
      if (!windowFocused && desktopNotificationsEnabled) {
        const projects = loadProjects();
        const project = projects.find((p: any) => p.id === projectId);
        const projectDisplayName = project?.name || projectId;
        const notification = new Notification({
          title: `${projectDisplayName} error`,
          body: error.message,
          icon: path.join(process.env.APP_ROOT || '', 'public', 'icon.png'),
          silent: false
        });
        
        notification.show();
        
        notification.on('click', () => {
          if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
          }
        });
      }
    });

    return { success: true, projectId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function broadcastToWebClients(message: any) {
  const messageStr = JSON.stringify(message);
  webClients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(messageStr);
      } catch (error) {
        console.error('Failed to send message to web client:', error);
        webClients.delete(client);
      }
    }
  });
}

function createWindow() {
  // Try multiple possible icon paths
  const iconPaths = [
    path.join(process.env.APP_ROOT || '', 'public', 'icon.png'),
    path.join(__dirname, '..', 'public', 'icon.png'),
    path.join(process.cwd(), 'public', 'icon.png'),
    path.join(process.env.VITE_PUBLIC || '', 'icon.png')
  ];
  
  let iconPath = null;
  for (const testPath of iconPaths) {
    console.log('Testing icon path:', testPath, 'exists:', fs.existsSync(testPath));
    if (fs.existsSync(testPath)) {
      iconPath = testPath;
      break;
    }
  }
  
  console.log('Using icon path:', iconPath);
  
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    ...(iconPath && { icon: iconPath }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#000000', // Pure black background for older macOS
    vibrancy: 'ultra-dark', // Use built-in vibrancy for subtle effect
    frame: false,
    hasShadow: true,
    transparent: false, // Solid background instead of transparency
    show: false // Don't show until ready
  });

  // Set app icon in dock (macOS specific)
  if (process.platform === 'darwin' && iconPath && app.dock) {
    try {
      app.dock.setIcon(iconPath);
    } catch (error) {
      console.log('Failed to set dock icon:', error);
    }
  }

  win.setWindowButtonVisibility(true);

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
    win?.show(); // Show window after loading
  });

  if (VITE_DEV_SERVER_URL) {
    console.log('Loading development server:', VITE_DEV_SERVER_URL);
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(RENDERER_DIST, 'index.html');
    console.log('App packaged:', app.isPackaged);
    console.log('RENDERER_DIST:', RENDERER_DIST);
    console.log('Loading index.html from:', indexPath);
    console.log('Index file exists:', fs.existsSync(indexPath));
    
    // Use loadFile instead of loadURL for local files - it handles the protocol correctly
    win.loadFile(indexPath);
  }

  // Log when content loads
  win.webContents.once("did-finish-load", () => {
    console.log('🎨 Vibe Term loaded with solid dark theme (macOS vibrancy)');
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    // Clean up shared PTY processes
    sharedPtyProcesses.forEach(proc => proc.kill());
    sharedPtyProcesses.clear();
    
    // Clean up background processes
    backgroundProcesses.forEach((proc, projectId) => {
      console.log(`Stopping background process for project: ${projectId}`);
      proc.kill('SIGTERM');
    });
    backgroundProcesses.clear();
    
    // Close web server
    if (webServer) {
      webServer.close();
    }
    if (webSocketServer) {
      webSocketServer.close();
    }
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  createWindow();
  
  // Check for required dependencies
  const missingDeps = await checkDependencies();
  console.log('Main process detected missing dependencies:', missingDeps);
  
  // Register IPC handlers
  setupIPCHandlers();
  if (missingDeps.length > 0) {
    // Send missing dependencies to renderer for user notification
    win?.webContents.once('did-finish-load', () => {
      console.log('Sending missing dependencies to renderer:', missingDeps);
      win?.webContents.send('missing-dependencies', missingDeps);
    });
  }
  
  // Start web server
  try {
    const settings = loadSettings();
    const port = settings?.webServer?.port || DEFAULT_WEB_SERVER_PORT;
    const enabled = settings?.webServer?.enabled !== false; // Default to enabled
    
    if (enabled) {
      const result = await createWebServer(port);
      webServer = result.server;
      const actualPort = result.port;
      console.log(`Web interface available at http://localhost:${actualPort}`);
      
      // Notify renderer about the actual port being used
      if (win) {
        win.webContents.send('web-server-started', { port: actualPort });
      }
    }
  } catch (error) {
    console.error('Failed to start web server:', error);
  }
});

ipcMain.handle('start-claude-process', async (event, projectId: string, projectPath: string, command: string, projectName?: string, yoloMode?: boolean) => {
  return await getOrCreateSharedPty(projectId, projectPath, projectName, yoloMode, command);
});

ipcMain.handle('stop-claude-process', async (event, projectId: string) => {
  const proc = sharedPtyProcesses.get(projectId);
  const backgroundProc = backgroundProcesses.get(projectId);
  
  // Kill both PTY and background processes
  if (proc) {
    proc.kill();
    sharedPtyProcesses.delete(projectId);
  }
  
  if (backgroundProc) {
    console.log(`[${projectId}] Stopping background process`);
    backgroundProc.kill('SIGTERM');
    backgroundProcesses.delete(projectId);
  }
  
  // Clean up terminal buffer
  terminalBuffers.delete(projectId);
  
  if (proc || backgroundProc) {
    return { success: true };
  }
  return { success: false, error: 'Process not found' };
});

ipcMain.handle('send-input', async (event, projectId: string, input: string) => {
  const proc = sharedPtyProcesses.get(projectId);
  if (proc) {
    console.log(`[${projectId}] Sending raw input to PTY:`, JSON.stringify(input));
    // Send raw input directly to PTY - let Claude handle its own input processing
    proc.write(input);
    return { success: true };
  }
  return { success: false, error: 'PTY process not found' };
});

ipcMain.handle('select-directory', async () => {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('load-projects', async () => {
  return loadProjects();
});

ipcMain.handle('save-projects', async (event, projects) => {
  saveProjects(projects);
  return { success: true };
});

ipcMain.handle('get-git-diff', async (event, projectPath: string) => {
  try {
    // Check if directory is a git repo
    const { stdout: isGitRepo } = await execAsync('git rev-parse --is-inside-work-tree', { cwd: projectPath }).catch(() => ({ stdout: '' }));
    
    if (!isGitRepo.trim()) {
      return { success: false, error: 'Not a git repository' };
    }

    // Get current branch
    const { stdout: branch } = await execAsync('git branch --show-current', { cwd: projectPath });
    
    // Get ahead/behind count
    let ahead = 0, behind = 0;
    try {
      const { stdout: revList } = await execAsync('git rev-list --left-right --count HEAD...@{u}', { cwd: projectPath });
      const [aheadStr, behindStr] = revList.trim().split('\t');
      ahead = parseInt(aheadStr) || 0;
      behind = parseInt(behindStr) || 0;
    } catch (e) {
      // No upstream branch
    }

    // Get list of changed files
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectPath });
    const files = [];

    if (statusOutput.trim()) {
      const lines = statusOutput.trim().split('\n');
      
      for (const line of lines) {
        // Handle git status format: XY filename (where X and Y are status codes)
        // Some lines might be missing the leading space for index status
        let status, filePath;
        if (line.length >= 3 && line[2] === ' ') {
          // Standard format: "XY filename"
          status = line.substring(0, 2).trim();
          filePath = line.substring(3);
        } else if (line.length >= 2 && line[1] === ' ') {
          // Format with single character status: "X filename"  
          status = line.substring(0, 1).trim();
          filePath = line.substring(2);
        } else {
          // Fallback - try to find the first space
          const spaceIndex = line.indexOf(' ');
          if (spaceIndex > 0) {
            status = line.substring(0, spaceIndex).trim();
            filePath = line.substring(spaceIndex + 1);
          } else {
            console.warn(`[GIT DIFF] Could not parse git status line: "${line}"`);
            continue;
          }
        }
        
        let fileStatus: 'added' | 'modified' | 'deleted' = 'modified';
        if (status.includes('A') || status.includes('?')) fileStatus = 'added';
        else if (status.includes('D')) fileStatus = 'deleted';
        else fileStatus = 'modified';

        let oldContent = '';
        let newContent = '';
        
        try {
          // Get the current file content
          if (fileStatus !== 'deleted') {
            newContent = fs.readFileSync(path.join(projectPath, filePath), 'utf8');
          }
          
          // Get the original content from git
          if (fileStatus !== 'added') {
            const { stdout } = await execAsync(`git show HEAD:"${filePath}"`, { cwd: projectPath }).catch(() => ({ stdout: '' }));
            oldContent = stdout;
          }
        } catch (e) {
          console.error(`Error reading file ${filePath}:`, e);
        }

        // Count additions and deletions
        let additions = 0;
        let deletions = 0;
        
        if (fileStatus === 'added') {
          additions = newContent.split('\n').length;
        } else if (fileStatus === 'deleted') {
          deletions = oldContent.split('\n').length;
        } else {
          // Simple line count diff for modified files
          const oldLines = oldContent.split('\n');
          const newLines = newContent.split('\n');
          const diff = newLines.length - oldLines.length;
          if (diff > 0) {
            additions = diff;
          } else {
            deletions = Math.abs(diff);
          }
        }

        files.push({
          path: filePath,
          status: fileStatus,
          additions,
          deletions,
          oldContent,
          newContent
        });
      }
    }

    return {
      success: true,
      data: {
        files,
        branch: branch.trim(),
        ahead,
        behind
      }
    };
  } catch (error) {
    console.error('Git diff error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file', async (event, projectPath: string, filePath: string, content: string) => {
  try {
    const fullPath = path.join(projectPath, filePath);
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Save file error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('revert-file', async (event, projectPath: string, filePath: string) => {
  try {
    // Get the original content from git
    const { stdout } = await execAsync(`git show HEAD:"${filePath}"`, { cwd: projectPath });
    
    // Write the original content back to the file
    const fullPath = path.join(projectPath, filePath);
    fs.writeFileSync(fullPath, stdout, 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error('Revert file error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-commit', async (event, projectPath: string, message: string) => {
  try {
    // Add all changes and commit
    await execAsync('git add .', { cwd: projectPath });
    await execAsync(`git commit --no-verify -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    
    return { success: true };
  } catch (error) {
    console.error('Git commit error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-push', async (event, projectPath: string) => {
  try {
    const { stdout } = await execAsync('git push', { cwd: projectPath });
    return { success: true, output: stdout };
  } catch (error) {
    console.error('Git push error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-selected-project', async (event, projectId: string | null) => {
  console.log(`Setting currently selected project to: "${projectId}"`);
  currentlySelectedProject = projectId;
  return { success: true };
});

// Settings IPC handlers
ipcMain.handle('load-settings', async () => {
  return loadSettings();
});

ipcMain.handle('get-local-ip', async () => {
  const interfaces = os.networkInterfaces();
  
  console.log('All network interfaces:', Object.keys(interfaces));
  
  // On macOS, en0 is typically the primary network interface (WiFi or Ethernet)
  // On Windows, it might be "Wi-Fi" or "Ethernet"
  // On Linux, it might be "eth0" or "wlan0"
  const priorityInterfaces = ['en0', 'en1', 'eth0', 'wlan0', 'Wi-Fi', 'Ethernet'];
  
  // Try priority interfaces first
  for (const name of priorityInterfaces) {
    if (interfaces[name]) {
      console.log(`Checking interface ${name}:`, interfaces[name]);
      for (const iface of interfaces[name]) {
        // Look for IPv4 addresses that are not internal
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`Found IP on ${name}: ${iface.address}`);
          return iface.address;
        }
      }
    }
  }
  
  // Fallback: Look for any 192.168.x.x address (common for home networks)
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        console.log(`Found IP on ${name}: ${iface.address}`);
        return iface.address;
      }
    }
  }
  
  // Fallback: Look for any non-internal IPv4 address
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`Found IP on ${name}: ${iface.address}`);
        return iface.address;
      }
    }
  }
  
  console.log('No external IP found, using localhost');
  return 'localhost';
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const oldSettings = loadSettings();
    saveSettings(settings);
    
    // Check if web server settings changed
    const webServerChanged = 
      !oldSettings?.webServer ||
      oldSettings.webServer.enabled !== settings.webServer?.enabled ||
      oldSettings.webServer.port !== settings.webServer?.port;
    
    if (webServerChanged) {
      // Restart web server with new settings
      if (webServer) {
        webServer.close();
        webServer = null;
      }
      
      if (webSocketServer) {
        webSocketServer.close();
        webSocketServer = null;
      }
      
      if (settings.webServer?.enabled !== false) {
        try {
          const result = await createWebServer(settings.webServer?.port || DEFAULT_WEB_SERVER_PORT);
          webServer = result.server;
          console.log(`Web server restarted on port ${result.port}`);
        } catch (error) {
          console.error('Failed to restart web server:', error);
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Discord notification handlers
ipcMain.handle('test-discord-notification', async (event, discordSettings) => {
  try {
    if (!discordSettings.webhookUrl) {
      return { success: false, error: 'No webhook URL provided' };
    }

    await sendDiscordNotification(
      discordSettings.webhookUrl,
      discordSettings.username || 'Vibe Term',
      '🧪 **Test Notification**\n\nThis is a test notification from Vibe Term. Your Discord notifications are working correctly!'
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-discord-notification', async (event, discordSettings, message) => {
  try {
    if (!discordSettings.webhookUrl || !discordSettings.enabled) {
      return { success: false, error: 'Discord notifications not configured or disabled' };
    }

    await sendDiscordNotification(
      discordSettings.webhookUrl,
      discordSettings.username || 'Vibe Term',
      message
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-command', async (event, projectPath: string, command: string) => {
  try {
    console.log(`[Test] Testing command "${command}" in ${projectPath}`);
    
    const result = await ShellUtils.execute(command, {
      cwd: projectPath,
      timeout: 30000
    });

    return {
      success: result.success,
      output: result.output || '',
      error: result.error || ''
    };
  } catch (error: any) {
    console.log(`[Test] Exception:`, error);
    return { success: false, error: error.message };
  }
});