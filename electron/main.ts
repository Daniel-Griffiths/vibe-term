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
import { SettingsManager, AppState } from "./settingsManager";
import { ErrorHandler } from "./errorHandler";
import type { UnifiedItem } from "../src/types";

// Global settings manager instance
let settingsManager: SettingsManager;

// Initialize settings manager
const initializeSettingsManager = () => {
  settingsManager = SettingsManager.getInstance();
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

// Safely import liquid glass with fallback (unused placeholder)
// const liquidGlass: unknown = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
const sharedPtyProcesses = new Map<string, unknown>(); // Shared PTY processes for both desktop and web
const backgroundProcesses = new Map<string, ChildProcess>(); // Background processes for runCommand
const terminalBuffers = new Map<string, string>(); // Store terminal history for each project

// Power save blocker to keep PC awake
let powerSaveBlockerId: number | null = null;

// Web server variables
let webServer: unknown = null;

// Helper function to read state from file (outside web server to avoid app naming conflict)
const readStateFile = () => {
  if (!settingsManager) {
    // Return minimal default state if settings manager not initialized yet
    return {
      settings: {
        editor: { theme: "vibe-term" },
        desktop: { notifications: true },
        webServer: { enabled: true, port: 6969 },
        discord: { enabled: false, username: "Vibe Term", webhookUrl: "" },
      },
      storedItems: [],
    };
  }
  return settingsManager.getAppState();
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

    const claudeCommand = yoloMode
      ? "claude --dangerously-skip-permissions"
      : "claude";

    const createCommand = ShellUtils.tmuxCommand({
      action: "new-attach",
      sessionName: tmuxSessionName,
      projectPath,
      startCommand: shouldStartClaude ? claudeCommand : undefined,
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

        backgroundProc.on("exit", () => {
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

    // Status changes are now handled by Claude hooks
    // No need for manual status tracking or debouncing here

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

        // Status detection is now handled by Claude hooks
        // No need to parse terminal output for status indicators

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
        const desktopNotificationsEnabled = settingsManager?.getSettings()?.desktop?.notifications ?? true;
        const windowFocused = win && !win.isDestroyed() && win.isFocused();

        if (
          !windowFocused &&
          desktopNotificationsEnabled &&
          shouldSendNotification(`${projectId}-error`)
        ) {
          const project = settingsManager?.findStoredItem(projectId);
          const projectDisplayName = project?.name ?? projectId;
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
      const desktopNotificationsEnabled = settingsManager?.getSettings()?.desktop?.notifications ?? true;
      const windowFocused = win && !win.isDestroyed() && win.isFocused();

      if (
        !windowFocused &&
        desktopNotificationsEnabled &&
        shouldSendNotification(`${projectId}-error`)
      ) {
        const project = settingsManager?.findStoredItem(projectId);
        const projectDisplayName = project?.name ?? projectId;
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
    state.storedItems?.filter((item: UnifiedItem) => item.type === "project") || [];

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
  // Initialize settings manager
  initializeSettingsManager();

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
    getAppState: () => settingsManager?.getAppState() ?? readStateFile(),
    updateAppState: (newState: Partial<AppState>) => {
      settingsManager?.updateAppState(newState);
    },
    addStoredItem: (item: UnifiedItem) => {
      settingsManager?.addStoredItem(item);
    },
    updateStoredItem: (id: string, updates: Partial<UnifiedItem>) => {
      settingsManager?.updateStoredItem(id, updates);
    },
    deleteStoredItem: (id: string) => {
      settingsManager?.deleteStoredItem(id);
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

  // Start web server with settings from SettingsManager
  try {
    const webServerSettings = settingsManager?.getSettings()?.webServer ?? { enabled: true, port: 6969 };
    const port = webServerSettings.port;
    const enabled = webServerSettings.enabled;

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
    ErrorHandler.logError(error, {
      operation: 'start-web-server',
      additionalData: { port: settingsManager?.getSettings()?.webServer?.port ?? 6969 }
    });
  }
});

// IPC handlers are set up in setupIPCHandlers()
