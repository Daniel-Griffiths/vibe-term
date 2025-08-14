import { app, BrowserWindow, ipcMain, shell, Notification } from 'electron';
import fs from 'fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as pty from 'node-pty';
import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createServer } from 'http';
import net from 'net';

const execAsync = promisify(exec);

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
const processes = new Map<string, ChildProcess>();
const ptyProcesses = new Map<string, any>();

// Track currently selected project for notifications
let currentlySelectedProject: string | null = null;

// Web server variables
let webServer: any = null;
let webSocketServer: WebSocketServer | null = null;
const webClients = new Set<any>();

// Storage for projects and settings
const getStoragePath = () => path.join(app.getPath('userData'), 'projects.json');
const getSettingsPath = () => path.join(app.getPath('userData'), 'settings.json');

const loadProjects = () => {
  try {
    const storagePath = getStoragePath();
    if (fs.existsSync(storagePath)) {
      const data = fs.readFileSync(storagePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading projects:', error);
  }
  return [];
};

const saveProjects = (projects: any[]) => {
  try {
    const storagePath = getStoragePath();
    fs.writeFileSync(storagePath, JSON.stringify(projects, null, 2));
  } catch (error) {
    console.error('Error saving projects:', error);
  }
};

// Settings storage functions
const loadSettings = () => {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return null;
};

const saveSettings = (settings: any) => {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

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
  app.use(express.static(path.join(__dirname, '..', 'web')));
  
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
      
      // Use the same logic as the Electron app
      if (processes.has(id)) {
        processes.get(id)?.kill();
      }

      const sessionBase = projectName || id;
      const tmuxSessionName = sessionBase.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Try to attach to existing session, or create new one if it doesn't exist
      const tmuxCommand = `tmux has-session -t "${tmuxSessionName}" 2>/dev/null && tmux attach-session -t "${tmuxSessionName}" || tmux new-session -s "${tmuxSessionName}" -c "${project.path}" \\; set-option status off`;
      
      const proc = pty.spawn('/bin/bash', ['-c', tmuxCommand], {
        cwd: project.path,
        env: { 
          ...process.env,
          TERM: 'xterm-256color',
          FORCE_COLOR: '1',
          CLICOLOR_FORCE: '1'
        },
        cols: 80,
        rows: 24
      });

      processes.set(id, proc);
      
      // Check if we're attaching to existing session or creating new one
      let isNewSession = true;
      try {
        const { stdout } = await execAsync(`tmux has-session -t "${tmuxSessionName}" 2>/dev/null && echo "exists" || echo "new"`);
        isNewSession = stdout.trim() === 'new';
      } catch (e) {
        // Error checking, assume new session
      }
      
      // Broadcast to web clients
      broadcastToWebClients({ 
        type: 'project-started',
        projectId: id,
        data: isNewSession 
          ? `Creating new tmux session "${tmuxSessionName}" in ${project.path}\r\n`
          : `Attaching to existing tmux session "${tmuxSessionName}"\r\n`
      });

      // Only auto-start Claude Code if this is a new session
      if (isNewSession) {
        setTimeout(() => {
          if (proc) {
            const claudeCommand = yoloMode ? 'claude --dangerously-skip-permissions\r' : 'claude\r';
            proc.write(claudeCommand);
          }
        }, 200);
      }

      // Handle PTY output
      proc.onData((data) => {
        broadcastToWebClients({ 
          type: 'terminal-output',
          projectId: id,
          data: data
        });
        
        // Same status detection logic as Electron app
        if (data.includes('⏺')) {
          setTimeout(() => {
            broadcastToWebClients({ 
              type: 'project-ready',
              projectId: id,
              timestamp: Date.now()
            });
          }, 100);
        }
      });

      proc.on('exit', (code) => {
        broadcastToWebClients({ 
          type: 'process-exit',
          projectId: id,
          code: code
        });
        processes.delete(id);
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/projects/:id/stop', async (req, res) => {
    const { id } = req.params;
    const proc = processes.get(id);
    
    if (proc) {
      proc.kill();
      processes.delete(id);
      broadcastToWebClients({ 
        type: 'project-stopped',
        projectId: id
      });
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Process not found' });
    }
  });
  
  app.post('/api/projects/:id/input', async (req, res) => {
    const { id } = req.params;
    const { input } = req.body;
    const proc = processes.get(id);
    
    if (proc) {
      proc.write(input);
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Process not found' });
    }
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
  if (process.platform === 'darwin' && iconPath) {
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
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // Log when content loads
  win.webContents.once("did-finish-load", () => {
    console.log('🎨 Vibe Term loaded with solid dark theme (macOS vibrancy)');
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    processes.forEach(proc => proc.kill());
    processes.clear();
    
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
  try {
    // Clean up any existing PTY process for this project (but don't kill tmux session)
    if (processes.has(projectId)) {
      processes.get(projectId)?.kill();
      processes.delete(projectId);
    }

    // Create tmux session name from project name (if available) or project ID (sanitized)
    const sessionBase = projectName || projectId;
    const tmuxSessionName = sessionBase.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    console.log(`[${projectId}] Checking for existing tmux session: ${tmuxSessionName}`);
    
    // Try to attach to existing session, or create new one if it doesn't exist
    const tmuxCommand = `tmux has-session -t "${tmuxSessionName}" 2>/dev/null && tmux attach-session -t "${tmuxSessionName}" || tmux new-session -s "${tmuxSessionName}" -c "${projectPath}" \\; set-option status off`;
    
    const proc = pty.spawn('/bin/bash', ['-c', tmuxCommand], {
      cwd: projectPath,
      env: { 
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
        CLICOLOR_FORCE: '1'
      },
      cols: 80,
      rows: 24
    });

    processes.set(projectId, proc);

    // Check if we're attaching to existing session or creating new one
    let isNewSession = true;
    try {
      const { stdout } = await execAsync(`tmux has-session -t "${tmuxSessionName}" 2>/dev/null && echo "exists" || echo "new"`);
      isNewSession = stdout.trim() === 'new';
    } catch (e) {
      // Error checking, assume new session
    }

    // Send initial prompt
    win?.webContents.send('terminal-output', { 
      projectId, 
      data: isNewSession 
        ? `Creating new tmux session "${tmuxSessionName}" in ${projectPath}\r\n`
        : `Attaching to existing tmux session "${tmuxSessionName}"\r\n`, 
      type: 'system' 
    });

    // Only auto-start Claude Code if this is a new session
    if (isNewSession) {
      setTimeout(() => {
        if (proc) {
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
          win?.webContents.send('claude-ready', { 
            projectId,
            timestamp: Date.now()
          });
          
          // Send to web clients
          broadcastToWebClients({ 
            type: 'project-ready',
            projectId: projectId,
            timestamp: Date.now()
          });
          
          // Send desktop notification if this project is not currently selected
          if (currentlySelectedProject !== projectId) {
            const projectName = projectId; // Could be enhanced to get actual project name
            const notification = new Notification({
              title: `${projectName} finished`,
              body: '',
              icon: path.join(process.env.APP_ROOT || '', 'public', 'icon.png'), // Optional icon
              silent: false
            });
            
            notification.show();
            
            // Optional: Click notification to focus the app
            notification.on('click', () => {
              if (win) {
                if (win.isMinimized()) win.restore();
                win.focus();
              }
            });

            // Also send Discord notification if configured
            const settings = loadSettings();
            if (settings?.discord?.enabled && settings?.discord?.webhookUrl) {
              const discordMessage = `🎯 **Project Finished**\n\n**${projectName}** has completed successfully and is ready for input.`;
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
          win?.webContents.send('claude-working', { 
            projectId,
            timestamp: Date.now()
          });
          
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

    proc.onData((data) => {
      console.log(`[${projectId}] PTY DATA:`, data);
      
      // Check for circle (⏺) - Claude finished
      if (data.includes('⏺')) {
        lastStateIndicator = 'finished';
        console.log(`[${projectId}] *** CLAUDE FINISHED (⏺ detected) ***`);
        
        // Check if input box appears in the same data
        if (data.includes('│') && data.includes('>')) {
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
      else if (data.includes('│') && data.includes('>') && data.includes('⏵⏵')) {
        if (lastStateIndicator !== 'ready') {
          lastStateIndicator = 'ready';
          console.log(`[${projectId}] *** CLAUDE IS READY FOR INPUT (initial) ***`);
          sendStatusChange('ready');
        }
      }
      
      // Send to Electron renderer
      win?.webContents.send('terminal-output', { 
        projectId, 
        data: data, 
        type: 'stdout' 
      });
      
      // Send to web clients
      broadcastToWebClients({ 
        type: 'terminal-output',
        projectId: projectId,
        data: data
      });
    });

    proc.on('exit', (code) => {
      console.log(`[${projectId}] Process exit:`, code);
      win?.webContents.send('process-exit', { projectId, code });
      win?.webContents.send('terminal-output', { 
        projectId, 
        data: `\nTerminal session ended with code ${code}\n`, 
        type: 'system' 
      });
      processes.delete(projectId);
    });

    proc.on('error', (error) => {
      console.log(`[${projectId}] Process error:`, error);
      win?.webContents.send('terminal-output', { 
        projectId, 
        data: `Error: ${error.message}\n`, 
        type: 'error' 
      });
    });

    return { success: true, projectId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-claude-process', async (event, projectId: string) => {
  const proc = processes.get(projectId);
  if (proc) {
    proc.kill();
    processes.delete(projectId);
    return { success: true };
  }
  return { success: false, error: 'Process not found' };
});

ipcMain.handle('send-input', async (event, projectId: string, input: string) => {
  const proc = processes.get(projectId);
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
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    
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
  currentlySelectedProject = projectId;
  return { success: true };
});

// Settings IPC handlers
ipcMain.handle('load-settings', async () => {
  return loadSettings();
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