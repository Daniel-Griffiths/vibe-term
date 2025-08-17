import { app, BrowserWindow, Notification, powerSaveBlocker } from "electron";
import fs from "fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ChildProcess, spawn } from "child_process";
import * as pty from "node-pty";
import { ShellUtils } from "../src/utils/shellUtils";
import { setupIPCHandlers, ipcHandlers } from "./ipc-handlers";
import {
  createWebServer,
  broadcastToWebClients,
  closeWebServer,
} from "./web-server";
import { setupClaudeHooks } from "../src/utils/claudeHookSetup";

// Application state stored in main process
interface UnifiedItem {
  id: string;
  name: string;
  type: "project" | "panel";
  path?: string;
  url?: string;
  icon?: string;
  runCommand?: string;
  yoloMode?: boolean;
  restrictedBranches?: string;
}

interface AppState {
  settings: {
    editor: { theme: string };
    desktop: { notifications: boolean };
    webServer: { enabled: boolean; port: number };
    discord: { enabled: boolean; username: string; webhookUrl: string };
  };
  storedItems: UnifiedItem[];
}

// In-memory application state
let appState: AppState = {
  settings: {
    editor: { theme: "vibe-term" },
    desktop: { notifications: true },
    webServer: { enabled: true, port: 6969 },
    discord: { enabled: false, username: "Vibe Term", webhookUrl: "" },
  },
  storedItems: [],
};

// Helper functions for state management
const getDataFilePath = () =>
  path.join(app.getPath("userData"), "app-data.json");

const saveAppState = async () => {
  try {
    await fs.promises.writeFile(
      getDataFilePath(),
      JSON.stringify(appState, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Failed to save app state:", error);
  }
};

const loadAppState = async () => {
  try {
    const data = await fs.promises.readFile(getDataFilePath(), "utf8");
    appState = { ...appState, ...JSON.parse(data) };
  } catch (error) {
    // Not an error - app data file doesn't exist on first run
  }
};

// Test variable to force missing dependencies modal
const FORCE_SHOW_DEPENDENCIES_MODAL = false; // Set to true for testing

// Check for required dependencies
async function checkDependencies(): Promise<string[]> {
  const missing: string[] = [];

  // Force missing dependencies for testing
  if (FORCE_SHOW_DEPENDENCIES_MODAL) {
    return ["tmux", "claude"];
  }

  // Check tmux
  const tmuxAvailable = await ShellUtils.checkDependency("tmux");
  if (!tmuxAvailable) {
    missing.push("tmux");
  }

  // Check claude
  const claudeAvailable = await ShellUtils.checkDependency("claude");
  if (!claudeAvailable) {
    missing.push("claude");
  }

  return missing;
}

const DEFAULT_WEB_SERVER_PORT = 6969;

// Safely import liquid glass with fallback
const liquidGlass: any = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
const sharedPtyProcesses = new Map<string, any>(); // Shared PTY processes for both desktop and web
const backgroundProcesses = new Map<string, ChildProcess>(); // Background processes for runCommand
const terminalBuffers = new Map<string, string>(); // Store terminal history for each project

// Power save blocker to keep PC awake
let powerSaveBlockerId: number | null = null;

// Web server variables
let webServer: any = null;

// Helper function to read state from file (outside web server to avoid app naming conflict)
const readStateFile = () => {
  return appState;
};

// Notification debouncing
const NOTIFICATION_DEBOUNCE_MS = 5000; // 5 seconds debounce period
const lastNotificationTime = new Map<string, number>();

function shouldSendNotification(projectId: string): boolean {
  const now = Date.now();
  const lastTime = lastNotificationTime.get(projectId);

  if (!lastTime || now - lastTime > NOTIFICATION_DEBOUNCE_MS) {
    lastNotificationTime.set(projectId, now);
    return true;
  }

  return false;
}

// Shared PTY process management
async function getOrCreateSharedPty(
  projectId: string,
  projectPath: string,
  projectName?: string,
  yoloMode?: boolean,
  runCommand?: string
) {
  try {
    // Set up Claude hooks for status detection
    await setupClaudeHooks(projectPath);

    // If PTY already exists, send current buffer and return success
    if (sharedPtyProcesses.has(projectId)) {
      // Send current terminal buffer to ensure UI is synced
      const currentBuffer = terminalBuffers.get(projectId) || "";
      if (currentBuffer) {
        // Send to desktop if window exists
        if (win && !win.isDestroyed()) {
          win.webContents.send("terminal-output", {
            projectId,
            data: currentBuffer,
            type: "history",
          });
        }

        // Send to web clients
        broadcastToWebClients({
          type: "terminal-output",
          projectId: projectId,
          data: currentBuffer,
        });
      }

      return { success: true, projectId };
    }

    const sessionBase = projectName || projectId;
    const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);

    // Check if session exists first to determine if we should send Claude command
    const sessionExists = await ShellUtils.checkTmuxSession(tmuxSessionName);
    const shouldStartClaude = !sessionExists;

    // Use a more robust approach: try to attach first, fallback to create if session doesn't exist
    // This avoids race conditions where session state changes between check and action
    const attachCommand = ShellUtils.tmuxCommand({
      action: "attach",
      sessionName: tmuxSessionName,
    });

    const createCommand = ShellUtils.tmuxCommand({
      action: "new-attach",
      sessionName: tmuxSessionName,
      projectPath,
    });

    // Try attach first, fallback to create on failure
    const tmuxCommand = `(${attachCommand}) || (${createCommand})`;

    const proc = pty.spawn(
      ShellUtils.getPreferredShell(),
      ["-l", "-c", tmuxCommand],
      {
        cwd: projectPath,
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
          TERM: "xterm-256color",
          FORCE_COLOR: "1",
          CLICOLOR_FORCE: "1",
          COLORTERM: "truecolor",
          TERM_PROGRAM: "vscode",
          LANG: "en_US.UTF-8",
          LC_ALL: "en_US.UTF-8",
          LC_CTYPE: "en_US.UTF-8",
        },
        cols: 80,
        rows: 24,
      }
    );

    sharedPtyProcesses.set(projectId, proc);

    // Add a small delay to ensure UI handlers are ready
    if (win && !win.isDestroyed()) {
      win.webContents.send("terminal-output", {
        projectId,
        data: "",
        type: "system",
      });
    }

    // Send to web clients
    broadcastToWebClients({
      type: "project-started",
      projectId: projectId,
      data: "",
    });

    // Send Claude command only if we created a new session
    if (shouldStartClaude) {
      const claudeCommand = yoloMode
        ? "claude --dangerously-skip-permissions\r"
        : "claude\r";
      proc.write(claudeCommand);
    }

    // Start background runCommand if provided
    if (runCommand && runCommand.trim()) {
      try {
        const backgroundProc = spawn(
          ShellUtils.getPreferredShell(),
          ["-l", "-c", runCommand],
          {
            cwd: projectPath,
            env: {
              ...process.env,
              PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
            },
            detached: false,
            stdio: ["ignore", "pipe", "pipe"],
          }
        );

        backgroundProcesses.set(projectId, backgroundProc);

        backgroundProc.on("exit", (code) => {
          backgroundProcesses.delete(projectId);
        });

        backgroundProc.on("error", (error) => {
          console.error(`[${projectId}] Background process error:`, error);
          backgroundProcesses.delete(projectId);
        });
      } catch (error) {
        console.error(
          `[${projectId}] Failed to start background command:`,
          error
        );
      }
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
        if (status === "ready") {
          // Send to desktop
          if (win && !win.isDestroyed()) {
            win.webContents.send("claude-ready", {
              projectId,
              timestamp: Date.now(),
            });
          }

          // Send to web clients
          broadcastToWebClients({
            type: "project-ready",
            projectId: projectId,
            timestamp: Date.now(),
          });

          // Send desktop notification if window is not focused and notifications are enabled
          // TODO: Connect to proper settings source
          const desktopNotificationsEnabled = true; // Default to true
          const windowFocused = win && !win.isDestroyed() && win.isFocused();

          if (
            !windowFocused &&
            desktopNotificationsEnabled &&
            shouldSendNotification(projectId)
          ) {
            // Get the actual project name from saved projects
            // TODO: Connect to proper data source
            const projectDisplayName = projectId;
            const notification = new Notification({
              title: `${projectDisplayName} finished`,
              body: "Claude Code process completed",
              icon: path.join(process.env.APP_ROOT || "", "public", "icon.png"),
              silent: false,
            });

            notification.show();

            notification.on("click", () => {
              if (win) {
                if (win.isMinimized()) win.restore();
                win.focus();
              }
            });

            // Also send Discord notification if configured
            // TODO: Connect to proper settings source
            // Discord notifications disabled until proper integration
          }
        } else if (status === "working") {
          // Send to desktop
          if (win && !win.isDestroyed()) {
            win.webContents.send("claude-working", {
              projectId,
              timestamp: Date.now(),
            });
          }

          // Send to web clients
          broadcastToWebClients({
            type: "project-working",
            projectId: projectId,
            timestamp: Date.now(),
          });
        }
        statusChangeTimeout = null;
      }, delay);
    };

    // Handle PTY output - send to both desktop and web
    proc.onData((data) => {
      // Check if process still exists before handling data
      if (!sharedPtyProcesses.has(projectId)) {
        return;
      }

      try {
        // Accumulate terminal history (keep last 10KB to avoid memory issues)
        const currentBuffer = terminalBuffers.get(projectId) || "";
        const newBuffer = currentBuffer + data;
        // Keep only last 10KB of history
        const trimmedBuffer =
          newBuffer.length > 10000 ? newBuffer.slice(-10000) : newBuffer;
        terminalBuffers.set(projectId, trimmedBuffer);
        // Check for circle (⏺) - Claude finished
        if (data.includes("⏺")) {
          lastStateIndicator = "finished";

          // Check if input box appears in the same data
          if (
            (data.includes("│") && data.includes(">")) ||
            (data.includes("╭") && data.includes("╰"))
          ) {
            sendStatusChange("ready");
          } else {
            // Wait a bit for input box to appear
            setTimeout(() => {
              sendStatusChange("ready");
            }, 100);
          }
        }
        // Check for asterisk/star symbols - Claude working
        else if (data.match(/[✳✽✻✶✢]/)) {
          if (lastStateIndicator !== "working") {
            lastStateIndicator = "working";
            sendStatusChange("working");
          }
        }
        // Check for input box (initial ready state)
        else if (
          (data.includes("│") && data.includes(">")) ||
          (data.includes("╭") && data.includes("╰")) ||
          data.includes("⏵⏵")
        ) {
          if (lastStateIndicator !== "ready") {
            lastStateIndicator = "ready";
            sendStatusChange("ready");
          }
        }

        // Send to desktop
        if (win && !win.isDestroyed()) {
          win.webContents.send("terminal-output", {
            projectId,
            data: data,
            type: "stdout",
          });
        }

        // Send to web clients
        broadcastToWebClients({
          type: "terminal-output",
          projectId: projectId,
          data: data,
        });
      } catch (error) {
        console.error(
          `Error handling PTY output for project ${projectId}:`,
          error
        );
        // Clean up the process if it's causing errors
        sharedPtyProcesses.delete(projectId);
        terminalBuffers.delete(projectId);
      }
    });

    proc.on("exit", (code) => {
      // Send to desktop
      if (win && !win.isDestroyed()) {
        win.webContents.send("process-exit", { projectId, code });
        win.webContents.send("terminal-output", {
          projectId,
          data: `\nTerminal session ended with code ${code}\n`,
          type: "system",
        });
      }

      // Send to web clients
      broadcastToWebClients({
        type: "process-exit",
        projectId: projectId,
        code: code,
      });

      // Send desktop notification for non-zero exit codes if window is not focused
      if (code !== 0) {
        // TODO: Connect to proper settings source
        const desktopNotificationsEnabled = true; // Default to true
        const windowFocused = win && !win.isDestroyed() && win.isFocused();

        if (
          !windowFocused &&
          desktopNotificationsEnabled &&
          shouldSendNotification(`${projectId}-error`)
        ) {
          // TODO: Connect to proper data source
          const projectDisplayName = projectId;
          const notification = new Notification({
            title: `${projectDisplayName} failed`,
            body: `Process exited with code ${code}`,
            icon: path.join(process.env.APP_ROOT || "", "public", "icon.png"),
            silent: false,
          });

          notification.show();

          notification.on("click", () => {
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

    proc.on("error", (error) => {
      // Send to desktop
      if (win && !win.isDestroyed()) {
        win.webContents.send("terminal-output", {
          projectId,
          data: `Error: ${error.message}\n`,
          type: "error",
        });
      }

      // Send desktop notification for errors if window is not focused
      // TODO: Connect to proper settings source
      const desktopNotificationsEnabled = true; // Default to true
      const windowFocused = win && !win.isDestroyed() && win.isFocused();

      if (
        !windowFocused &&
        desktopNotificationsEnabled &&
        shouldSendNotification(`${projectId}-error`)
      ) {
        // TODO: Connect to proper data source
        const projectDisplayName = projectId;
        const notification = new Notification({
          title: `${projectDisplayName} error`,
          body: error.message,
          icon: path.join(process.env.APP_ROOT || "", "public", "icon.png"),
          silent: false,
        });

        notification.show();

        notification.on("click", () => {
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

function createWindow() {
  // Try multiple possible icon paths
  const iconPaths = [
    path.join(process.env.APP_ROOT || "", "public", "icon.png"),
    path.join(__dirname, "..", "public", "icon.png"),
    path.join(process.cwd(), "public", "icon.png"),
    path.join(process.env.VITE_PUBLIC || "", "icon.png"),
  ];

  let iconPath = null;
  for (const testPath of iconPaths) {
    if (fs.existsSync(testPath)) {
      iconPath = testPath;
      break;
    }
  }

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 300,
    minHeight: 600,
    ...(iconPath && { icon: iconPath }),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      nativeWindowOpen: false,
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: "#000000", // Pure black background for older macOS
    vibrancy: "ultra-dark", // Use built-in vibrancy for subtle effect
    frame: false,
    hasShadow: true,
    transparent: false, // Solid background instead of transparency
    show: false, // Don't show until ready
  });

  // Set app icon in dock (macOS specific)
  if (process.platform === "darwin" && iconPath && app.dock) {
    try {
      app.dock.setIcon(iconPath);
    } catch (error) {
      console.error("Failed to set dock icon:", error);
    }
  }

  win.setWindowButtonVisibility(true);

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
    win?.webContents.send("main-process-ready");
    win?.show(); // Show window after loading
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(RENDERER_DIST, "index.html");
    // Use loadFile instead of loadURL for local files - it handles the protocol correctly
    win.loadFile(indexPath);
  }
}

// Clean up all tmux sessions and processes before quitting
app.on("before-quit", async (event) => {
  // Prevent default quit to allow cleanup
  event.preventDefault();

  // Stop power save blocker
  if (
    powerSaveBlockerId !== null &&
    powerSaveBlocker.isStarted(powerSaveBlockerId)
  ) {
    powerSaveBlocker.stop(powerSaveBlockerId);
  }

  // Kill all tmux sessions associated with projects (silently fail if not running)
  const state = readStateFile();
  const projects =
    state.storedItems?.filter((item: any) => item.type === "project") || [];

  for (const project of projects) {
    const sessionBase = project.name || project.id;
    const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);
    ShellUtils.killTmuxSession(tmuxSessionName);
  }

  // Clean up shared PTY processes
  sharedPtyProcesses.forEach((proc) => proc.kill());
  sharedPtyProcesses.clear();

  // Clean up background processes
  backgroundProcesses.forEach((proc) => {
    proc.kill("SIGTERM");
  });
  backgroundProcesses.clear();

  // Close web server
  if (webServer) {
    webServer.close();
  }
  closeWebServer();

  // Now actually quit
  app.exit(0);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  // Load app state from disk
  await loadAppState();

  // Start power save blocker to keep PC awake while app is running
  powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");

  createWindow();

  // Register IPC handlers after creating window so win is available
  setupIPCHandlers({
    win,
    sharedPtyProcesses,
    backgroundProcesses,
    terminalBuffers,
    getOrCreateSharedPty,
    readStateFile,
    broadcastToWebClients,
    getAppState: () => appState,
    updateAppState: (newState: Partial<AppState>) => {
      appState = { ...appState, ...newState };
      saveAppState();
    },
    addStoredItem: (item: UnifiedItem) => {
      appState.storedItems.push(item);
      saveAppState();
    },
    updateStoredItem: (id: string, updates: Partial<UnifiedItem>) => {
      const index = appState.storedItems.findIndex((item) => item.id === id);
      if (index !== -1) {
        appState.storedItems[index] = {
          ...appState.storedItems[index],
          ...updates,
        };
        saveAppState();
      }
    },
    deleteStoredItem: (id: string) => {
      appState.storedItems = appState.storedItems.filter(
        (item) => item.id !== id
      );
      saveAppState();
    },
  });

  // Check for required dependencies
  const missingDeps = await checkDependencies();
  if (missingDeps.length > 0) {
    // Send missing dependencies to renderer for user notification
    win?.webContents.once("did-finish-load", () => {
      win?.webContents.send("missing-dependencies", missingDeps);
    });
  }

  // Start web server with default settings
  try {
    const port = DEFAULT_WEB_SERVER_PORT;
    const enabled = true; // Default to enabled

    if (enabled) {
      const result = await createWebServer(
        {
          ipcHandlers,
          app,
        },
        port
      );
      webServer = result.server;
      const actualPort = result.port;

      // Notify renderer about the actual port being used
      if (win) {
        win.webContents.send("web-server-started", { port: actualPort });
      }
    }
  } catch (error) {
    console.error("Failed to start web server:", error);
  }
});

// IPC handlers are set up in setupIPCHandlers()
