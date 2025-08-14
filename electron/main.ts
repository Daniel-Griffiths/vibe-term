import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as pty from 'node-pty';

const execAsync = promisify(exec);

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

// Storage for projects
const getStoragePath = () => path.join(app.getPath('userData'), 'projects.json');

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

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#000000', // Pure black background for older macOS
    vibrancy: 'ultra-dark', // Use built-in vibrancy for subtle effect
    frame: false,
    hasShadow: true,
    transparent: false // Solid background instead of transparency
  });

  win.setWindowButtonVisibility(true);

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
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
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

ipcMain.handle('start-claude-process', async (event, projectId: string, projectPath: string, command: string) => {
  try {
    if (processes.has(projectId)) {
      processes.get(projectId)?.kill();
    }

    // Create tmux session name from project ID (sanitized)
    const tmuxSessionName = `claude-${projectId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    console.log(`[${projectId}] Creating tmux session: ${tmuxSessionName}`);
    
    // Kill existing tmux session if it exists, then create new one with no status bar
    const tmuxCommand = `tmux kill-session -t "${tmuxSessionName}" 2>/dev/null || true; tmux new-session -s "${tmuxSessionName}" -c "${projectPath}" \\; set-option status off`;
    
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

    // Send initial prompt
    win?.webContents.send('terminal-output', { 
      projectId, 
      data: `Starting tmux session "${tmuxSessionName}" in ${projectPath}\r\n`, 
      type: 'system' 
    });

    // Auto-start Claude Code with dangerous permissions after tmux is ready
    setTimeout(() => {
      if (proc) {
        console.log(`[${projectId}] Auto-starting Claude Code in tmux session`);
        proc.write('claude --dangerously-skip-permissions\r');
      }
    }, 200);

    // Track the most recent state indicator
    let lastStateIndicator = null;

    proc.onData((data) => {
      console.log(`[${projectId}] PTY DATA:`, data);
      
      // Check for circle (⏺) - Claude finished
      if (data.includes('⏺')) {
        lastStateIndicator = 'finished';
        console.log(`[${projectId}] *** CLAUDE FINISHED (⏺ detected) ***`);
        
        // Check if input box appears in the same data
        if (data.includes('│') && data.includes('>')) {
          console.log(`[${projectId}] *** CLAUDE IS READY FOR INPUT ***`);
          win?.webContents.send('claude-ready', { 
            projectId,
            timestamp: Date.now()
          });
        } else {
          // Wait a bit for input box to appear
          setTimeout(() => {
            win?.webContents.send('claude-ready', { 
              projectId,
              timestamp: Date.now()
            });
          }, 100);
        }
      }
      // Check for asterisk/star symbols - Claude working
      else if (data.match(/[✳✽✻✶✢]/)) {
        if (lastStateIndicator !== 'working') {
          lastStateIndicator = 'working';
          console.log(`[${projectId}] *** CLAUDE IS WORKING/THINKING ***`);
          win?.webContents.send('claude-working', { 
            projectId,
            timestamp: Date.now()
          });
        }
      }
      // Check for input box (initial ready state)
      else if (data.includes('│') && data.includes('>') && data.includes('⏵⏵')) {
        if (lastStateIndicator !== 'ready') {
          lastStateIndicator = 'ready';
          console.log(`[${projectId}] *** CLAUDE IS READY FOR INPUT (initial) ***`);
          win?.webContents.send('claude-ready', { 
            projectId,
            timestamp: Date.now()
          });
        }
      }
      
      win?.webContents.send('terminal-output', { 
        projectId, 
        data: data, 
        type: 'stdout' 
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