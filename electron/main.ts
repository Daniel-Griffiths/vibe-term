import fs from "fs";
import path from "node:path";
import * as pty from "@lydell/node-pty";
import { fileURLToPath } from "node:url";
import { WEB_PORT } from "../shared/settings";
import { ShellUtils } from "./utils/shell-utils";
import { AIProviderService } from "./utils/ai-provider-service";
import type { UnifiedItem } from "../client/types";
import { ChildProcess, spawn } from "child_process";
import { ErrorHandler } from "./utils/error-handler";
import { OperatingSystem, getCurrentOS } from "./utils/os";
import { setupClaudeHooks } from "./utils/claude-hook-setup";
import { setupIPCHandlers, ipcHandlers, setWebServerDependencies } from "./ipc-handlers";
import { SettingsManager, AppState } from "./utils/settings-manager";
import { app, BrowserWindow, Notification, powerSaveBlocker } from "electron";
import {
  createWebServer,
  broadcastToWebClients,
  closeWebServer,
  restartWebServer,
  isWebServerRunning,
} from "./web-server";

let settingsManager: SettingsManager;

const initializeSettingsManager = () => {
  settingsManager = SettingsManager.getInstance();
};

const FORCE_SHOW_DEPENDENCIES_MODAL = false;

async function checkDependencies(): Promise<string[]> {
  const missing: string[] = [];

  if (FORCE_SHOW_DEPENDENCIES_MODAL) {
    return ["tmux", "claude"];
  }

  const tmuxAvailable = await ShellUtils.checkDependency("tmux");
  if (!tmuxAvailable) {
    missing.push("tmux");
  }

  // Check for AI providers and auto-select first available one
  const aiAvailability = await AIProviderService.checkAllProvidersAvailability();
  const availableProviders = AIProviderService.getAllProviders().filter(p => aiAvailability[p.id]);
  
  // Cache AI provider availability for later use
  settingsManager?.cacheAiProviderAvailability(aiAvailability);
  
  if (availableProviders.length > 0) {
    // Auto-select first available provider as default if none is set or current one is unavailable
    const currentSettings = settingsManager?.getSettings();
    const currentProvider = currentSettings?.ai?.defaultProvider;
    
    if (!currentProvider || !aiAvailability[currentProvider]) {
      const firstAvailable = availableProviders[0];
      console.log(`Auto-selecting AI provider: ${firstAvailable.name} (${firstAvailable.id})`);
      
      // Update settings with the first available provider
      const updatedSettings = {
        ...currentSettings,
        ai: {
          ...currentSettings?.ai,
          defaultProvider: firstAvailable.id
        }
      };
      settingsManager?.updateSettings(updatedSettings);
    }
  } else {
    // If no AI providers are available, show claude as missing for the modal
    missing.push("claude");
  }

  return missing;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
const sharedPtyProcesses = new Map<string, unknown>();
const backgroundProcesses = new Map<string, ChildProcess>();
const terminalBuffers = new Map<string, string>();

let webServer: unknown = null;
let powerSaveBlockerId: number | null = null;
let webServerHealthCheckInterval: NodeJS.Timeout | null = null;

const readStateFile = () => {
  if (!settingsManager) {
    return {
      settings: {
        editor: { theme: "vibe-term" },
        desktop: { notifications: true },
        webServer: { enabled: true },
        ai: { defaultProvider: "claude" },
      },
      storedItems: [],
    };
  }
  return settingsManager.getAppState();
};

function startWebServerHealthCheck() {
  if (webServerHealthCheckInterval) {
    clearInterval(webServerHealthCheckInterval);
  }

  const performHealthCheck = () => {
    const webServerSettings = settingsManager?.getSettings()?.webServer ?? {
      enabled: true,
    };

    if (webServerSettings.enabled) {
      if (!isWebServerRunning()) {
        console.log("Web server down - attempting restart");
        restartWebServer()
          .then((result) => {
            if (result) {
              webServer = result.server;
              if (win && !win.isDestroyed()) {
                win.webContents.send("web-server-restarted", {
                  port: result.port,
                });
              }
              console.log("Web server restarted successfully");

              startWebServerHealthCheck();
            } else {
              setTimeout(performHealthCheck, 30_000);
            }
          })
          .catch((error) => {
            console.error("Web server restart failed:", error);

            setTimeout(performHealthCheck, 30_000);
          });
      }
    } else {
      // Web server is disabled, ensure it's shut down
      if (isWebServerRunning()) {
        console.log("Web server disabled - shutting down");
        closeWebServer();
        webServer = null;
      }
    }
  };

  webServerHealthCheckInterval = setInterval(performHealthCheck, 30_000);
}

function stopWebServerHealthCheck() {
  if (webServerHealthCheckInterval) {
    clearInterval(webServerHealthCheckInterval);
    webServerHealthCheckInterval = null;
  }
}

const NOTIFICATION_DEBOUNCE_MS = 5000;
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

async function getOrCreateSharedPty(
  projectId: string,
  projectPath: string,
  projectName?: string,
  yoloMode?: boolean,
  runCommand?: string
) {
  try {
    await setupClaudeHooks(projectPath);

    if (sharedPtyProcesses.has(projectId)) {
      const currentBuffer = terminalBuffers.get(projectId) || "";
      if (currentBuffer) {
        if (win && !win.isDestroyed()) {
          win.webContents.send("terminal-output", {
            projectId,
            data: currentBuffer,
            type: "history",
          });
        }

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

    const sessionExists = await ShellUtils.checkTmuxSession(tmuxSessionName);
    const shouldStartClaude = !sessionExists;

    const attachCommand = ShellUtils.tmuxCommand({
      action: "attach",
      sessionName: tmuxSessionName,
    });

    // Get AI provider and generate command
    const settings = settingsManager?.getSettings();
    const aiProvider = AIProviderService.getProvider(settings?.ai?.defaultProvider);
    const aiCommand = AIProviderService.generateStartCommand(aiProvider, projectPath, undefined, yoloMode);

    const createCommand = ShellUtils.tmuxCommand({
      action: "new-attach",
      sessionName: tmuxSessionName,
      projectPath,
      startCommand: shouldStartClaude ? aiCommand : undefined,
    });

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

    if (win && !win.isDestroyed()) {
      win.webContents.send("terminal-output", {
        projectId,
        data: "",
        type: "system",
      });
    }

    broadcastToWebClients({
      type: "project-started",
      projectId: projectId,
      data: "",
    });

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

    proc.onData((data) => {
      if (!sharedPtyProcesses.has(projectId)) {
        return;
      }

      try {
        const currentBuffer = terminalBuffers.get(projectId) || "";
        const newBuffer = currentBuffer + data;

        const trimmedBuffer =
          newBuffer.length > 10000 ? newBuffer.slice(-10000) : newBuffer;
        terminalBuffers.set(projectId, trimmedBuffer);

        if (win && !win.isDestroyed()) {
          win.webContents.send("terminal-output", {
            projectId,
            data: data,
            type: "stdout",
          });
        }

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

        sharedPtyProcesses.delete(projectId);
        terminalBuffers.delete(projectId);
      }
    });

    proc.on("exit", (code) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("process-exit", { projectId, code });
        win.webContents.send("terminal-output", {
          projectId,
          data: `\nTerminal session ended with code ${code}\n`,
          type: "system",
        });
      }

      broadcastToWebClients({
        type: "process-exit",
        projectId: projectId,
        code: code,
      });

      if (code !== 0) {
        const desktopNotificationsEnabled =
          settingsManager?.getSettings()?.desktop?.notifications ?? true;
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
      if (win && !win.isDestroyed()) {
        win.webContents.send("terminal-output", {
          projectId,
          data: `Error: ${error.message}\n`,
          type: "error",
        });
      }

      const desktopNotificationsEnabled =
        settingsManager?.getSettings()?.desktop?.notifications ?? true;
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
    frame: false,
    show: false,
    hasShadow: true,
    transparent: false,
    backgroundColor: "#000000",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    ...(iconPath && { icon: iconPath }),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      devTools: VITE_DEV_SERVER_URL ? true : false,
    },
  });

  const currentOS = getCurrentOS();
  switch (currentOS) {
    case OperatingSystem.MACOS:
      if (iconPath && app.dock) {
        try {
          app.dock.setIcon(iconPath);
        } catch (error) {
          console.error("Failed to set dock icon:", error);
        }
      }
      break;
    case OperatingSystem.LINUX:
      break;
  }

  win.setWindowButtonVisibility(true);

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
    win?.webContents.send("main-process-ready");
    win?.maximize();
    win?.show();
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(RENDERER_DIST, "index.html");

    win.loadFile(indexPath);
  }
}

app.on("before-quit", async (event) => {
  event.preventDefault();

  if (
    powerSaveBlockerId !== null &&
    powerSaveBlocker.isStarted(powerSaveBlockerId)
  ) {
    powerSaveBlocker.stop(powerSaveBlockerId);
  }

  const state = readStateFile();
  const projects =
    state.storedItems?.filter((item: UnifiedItem) => item.type === "project") ||
    [];

  for (const project of projects) {
    const sessionBase = project.name || project.id;
    const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);
    ShellUtils.killTmuxSession(tmuxSessionName);
  }

  sharedPtyProcesses.forEach((proc) => proc.kill());
  sharedPtyProcesses.clear();

  backgroundProcesses.forEach((proc) => {
    proc.kill("SIGTERM");
  });
  backgroundProcesses.clear();

  stopWebServerHealthCheck();

  if (webServer) {
    webServer.close();
  }
  closeWebServer();

  app.exit(0);
});

app.on("window-all-closed", () => {
  const currentOS = getCurrentOS();
  switch (currentOS) {
    case OperatingSystem.MACOS:
      break;
    case OperatingSystem.LINUX:
      app.quit();
      break;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  initializeSettingsManager();

  powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");

  createWindow();

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

  // Set dependencies for web server creation in IPC handlers
  setWebServerDependencies({ ipcHandlers, app });

  const missingDeps = await checkDependencies();
  if (missingDeps.length > 0) {
    win?.webContents.once("did-finish-load", () => {
      win?.webContents.send("missing-dependencies", missingDeps);
    });
  }

  try {
    const webServerSettings = settingsManager?.getSettings()?.webServer ?? {
      enabled: true,
    };
    const enabled = webServerSettings.enabled;

    if (enabled) {
      const result = await createWebServer(
        {
          ipcHandlers,
          app,
        },
        WEB_PORT
      );
      webServer = result.server;
      const actualPort = result.port;

      if (win) {
        win.webContents.send("web-server-started", { port: actualPort });
      }

      startWebServerHealthCheck();
    }
  } catch (error) {
    ErrorHandler.logError(error, {
      operation: "start-web-server",
      additionalData: {
        port: WEB_PORT,
      },
    });
  }
});
