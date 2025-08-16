import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Notification,
  dialog,
} from "electron";
import fs from "fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { ChildProcess, exec } from "child_process";
import { promisify } from "util";
import * as pty from "node-pty";
import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import { ShellUtils } from "../src/utils/shellUtils";

const execAsync = promisify(exec);

// Test variable to force missing dependencies modal
const FORCE_SHOW_DEPENDENCIES_MODAL = false; // Set to true for testing

// Check for required dependencies
async function checkDependencies(): Promise<string[]> {
  const missing: string[] = [];

  // Force missing dependencies for testing
  if (FORCE_SHOW_DEPENDENCIES_MODAL) {
    console.log("🧪 TESTING: Forcing missing dependencies modal");
    return ["tmux", "claude"];
  }

  // Check tmux
  const tmuxAvailable = await ShellUtils.checkDependency("tmux");
  if (tmuxAvailable) {
    console.log("✅ tmux is installed");
  } else {
    missing.push("tmux");
    console.log("❌ tmux is not installed");
  }

  // Check claude
  const claudeAvailable = await ShellUtils.checkDependency("claude");
  if (claudeAvailable) {
    console.log("✅ claude is installed");
  } else {
    missing.push("claude");
    console.log("❌ claude is not installed");
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
const processes = new Map<string, ChildProcess>(); // Legacy - kept for compatibility
const sharedPtyProcesses = new Map<string, any>(); // Shared PTY processes for both desktop and web
const terminalBuffers = new Map<string, string>(); // Store terminal history for each project

// Track currently selected project for notifications
let currentlySelectedProject: string | null = null;

// Web server variables
let webServer: any = null;
let webSocketServer: WebSocketServer | null = null;
const webClients = new Set<any>();

// Setup IPC handlers using IPCService
function setupIPCHandlers() {
  // Process management
  ipcMain.handle(
    "start-claude-process",
    async (
      _event,
      projectId: string,
      projectPath: string,
      command: string,
      projectName?: string,
      yoloMode?: boolean
    ) => {
      return await getOrCreateSharedPty(
        projectId,
        projectPath,
        projectName,
        yoloMode
      );
    }
  );

  ipcMain.handle("stop-claude-process", async (_event, projectId: string) => {
    const proc = sharedPtyProcesses.get(projectId);

    // Kill PTY process
    if (proc) {
      proc.kill();
      sharedPtyProcesses.delete(projectId);
    }

    // Kill the tmux session (silently fails if not running)
    const state = readStateFile();
    const projects =
      state.storedItems?.filter((item: any) => item.type === "project") || [];
    const project = projects.find((p: any) => p.id === projectId);

    if (project) {
      const sessionBase = project.name || projectId;
      const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);
      ShellUtils.killTmuxSession(tmuxSessionName);
    }

    return { success: true };
  });

  ipcMain.handle(
    "send-input",
    async (_event, projectId: string, input: string) => {
      const proc = sharedPtyProcesses.get(projectId);
      if (proc) {
        proc.write(input);
        return { success: true };
      }
      return { success: false, error: "Process not found" };
    }
  );

  ipcMain.handle(
    "test-command",
    async (_event, projectPath: string, command: string) => {
      console.log(`[Test] Testing command "${command}" in ${projectPath}`);

      const result = await ShellUtils.execute(command, {
        cwd: projectPath,
        timeout: 30000,
      });

      return {
        success: result.success,
        output: result.output || "",
        error: result.error || "",
      };
    }
  );

  // Write state file for web server access
  ipcMain.handle("write-state-file", async (_event, state) => {
    try {
      const stateFilePath = path.join(
        app.getPath("userData"),
        "web-server-state.json"
      );
      await fs.promises.writeFile(
        stateFilePath,
        JSON.stringify(state, null, 2),
        "utf8"
      );
      return { success: true };
    } catch (error: any) {
      console.error("Error writing state file:", error);
      return { success: false, error: error.message };
    }
  });
}

// Directory selection - using direct ipcMain to maintain original string return format
ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ["openDirectory"],
  });

  return result.canceled ? null : result.filePaths[0];
});

// Discord notification function
const sendDiscordNotification = async (
  webhookUrl: string,
  username: string,
  content: string
) => {
  try {
    const https = require("https");
    const url = require("url");

    const parsedUrl = url.parse(webhookUrl);
    const data = JSON.stringify({
      username: username,
      content: content,
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          reject(
            new Error(`Discord webhook returned status ${res.statusCode}`)
          );
        }
      });

      req.on("error", (error: any) => {
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

    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(port));
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Please stop the process using this port or choose a different port.`
          )
        );
      } else {
        reject(err);
      }
    });
  });
}

// Helper function to read state from file (outside web server to avoid app naming conflict)
const readStateFile = () => {
  try {
    const stateFilePath = path.join(
      app.getPath("userData"),
      "web-server-state.json"
    );
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading state file:", error);
  }
  return { settings: {}, storedItems: [] };
};

async function createWebServer(preferredPort = DEFAULT_WEB_SERVER_PORT) {
  const port = await checkPortAvailable(preferredPort);
  const expressApp = express();
  const server = createServer(expressApp);

  // Enable CORS for all routes
  expressApp.use(cors());
  expressApp.use(express.json());

  // Serve static files (we'll create a simple mobile-friendly interface)
  const webStaticPath = path.join(__dirname, "..", "web");
  expressApp.use(express.static(webStaticPath));

  // API Routes
  expressApp.get("/api/projects", (req, res) => {
    const state = readStateFile();
    const projects =
      state.storedItems?.filter((item: any) => item.type === "project") || [];
    res.json({ success: true, data: projects });
  });

  expressApp.get("/api/panels", (req, res) => {
    const state = readStateFile();
    const panels =
      state.storedItems?.filter((item: any) => item.type === "panel") || [];
    res.json({ success: true, data: panels });
  });

  expressApp.get("/api/settings", (req, res) => {
    const state = readStateFile();
    res.json({ success: true, data: state.settings || {} });
  });

  expressApp.post("/api/projects/:id/start", async (req, res) => {
    const { id } = req.params;
    const { command, projectName, yoloMode } = req.body;

    try {
      const state = readStateFile();
      const projects =
        state.storedItems?.filter((item: any) => item.type === "project") || [];
      const project = projects.find((p: any) => p.id === id);

      if (!project) {
        return res.json({ success: false, error: "Project not found" });
      }

      // Use the start command from the request, or fall back to project's runCommand
      // Use or create shared PTY process
      const result = await getOrCreateSharedPty(
        id,
        project.path,
        projectName,
        yoloMode
      );
      if (result.success) {
        res.json({ success: true });
      } else {
        res.json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.json({ success: false, error: error.message });
    }
  });

  expressApp.post("/api/projects/:id/stop", async (req, res) => {
    const { id } = req.params;
    const proc = sharedPtyProcesses.get(id);

    // Kill PTY process
    if (proc) {
      proc.kill();
      sharedPtyProcesses.delete(id);
    }

    // Clean up terminal buffer
    terminalBuffers.delete(id);

    // Kill the tmux session (silently fails if not running)
    const state = readStateFile();
    const projects =
      state.storedItems?.filter((item: any) => item.type === "project") || [];
    const project = projects.find((p: any) => p.id === id);

    if (project) {
      const sessionBase = project.name || id;
      const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);
      ShellUtils.killTmuxSession(tmuxSessionName);
    }

    broadcastToWebClients({
      type: "project-stopped",
      projectId: id,
    });

    res.json({ success: true });
  });

  expressApp.get("/api/projects/:id/status", async (req, res) => {
    const { id } = req.params;

    try {
      const state = readStateFile();
      const projects =
        state.storedItems?.filter((item: any) => item.type === "project") || [];
      const project = projects.find((p: any) => p.id === id);

      if (!project) {
        return res
          .status(404)
          .json({ success: false, error: "Project not found" });
      }

      // Check if PTY process exists (session is running)
      const hasProcess = sharedPtyProcesses.has(id);

      // Also check if tmux session exists
      const sessionBase = project.name || id;
      const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);
      const tmuxSessionExists = await ShellUtils.checkTmuxSession(
        tmuxSessionName
      );

      res.json({
        success: true,
        sessionExists: hasProcess || tmuxSessionExists,
        hasProcess,
        tmuxSessionExists,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  expressApp.post("/api/projects/:id/input", async (req, res) => {
    const { id } = req.params;
    const { input } = req.body;
    const proc = sharedPtyProcesses.get(id);

    if (proc) {
      proc.write(input);
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Process not found" });
    }
  });

  expressApp.post("/api/projects/:id/resize", async (req, res) => {
    const { id } = req.params;
    const { cols, rows } = req.body;
    const proc = sharedPtyProcesses.get(id);

    if (proc) {
      console.log(`[${id}] Resizing PTY to ${cols}×${rows}`);
      proc.resize(cols, rows);

      // Also notify desktop client of the new dimensions
      if (win && !win.isDestroyed()) {
        win.webContents.send("terminal-resize", {
          projectId: id,
          cols,
          rows,
        });
      }

      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Process not found" });
    }
  });

  expressApp.get("/api/projects/:id/history", async (req, res) => {
    const { id } = req.params;
    const buffer = terminalBuffers.get(id) || "";
    res.json({ success: true, data: buffer });
  });

  // WebSocket setup
  webSocketServer = new WebSocketServer({ server });

  webSocketServer.on("connection", (ws) => {
    webClients.add(ws);

    // Send current projects state
    const state = readStateFile();
    const projects =
      state.storedItems?.filter((item: any) => item.type === "project") || [];
    ws.send(
      JSON.stringify({
        type: "projects-state",
        data: projects,
      })
    );

    ws.on("close", () => {
      webClients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      webClients.delete(ws);
    });
  });

  return new Promise((resolve, reject) => {
    server
      .listen(port, "0.0.0.0", () => {
        console.log(`Web server started on http://0.0.0.0:${port}`);
        resolve({ server, port });
      })
      .on("error", (error) => {
        console.error("Failed to start web server:", error);
        reject(error);
      });
  });
}

// Shared PTY process management
async function getOrCreateSharedPty(
  projectId: string,
  projectPath: string,
  projectName?: string,
  yoloMode?: boolean
) {
  try {
    // If PTY already exists, send current buffer and return success
    if (sharedPtyProcesses.has(projectId)) {
      console.log(`[${projectId}] Using existing shared PTY process`);
      
      // Send current terminal buffer to ensure UI is synced
      const currentBuffer = terminalBuffers.get(projectId) || "";
      if (currentBuffer) {
        // Send to desktop if window exists
        if (win && !win.isDestroyed()) {
          console.log(`[Main Process] Sending existing buffer to renderer:`, {
            projectId,
            bufferLength: currentBuffer.length,
            timestamp: new Date().toISOString(),
          });
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

    console.log(
      `[${projectId}] Creating shared PTY for tmux session: ${tmuxSessionName}`
    );

    // Check if tmux session exists
    const sessionExists = await ShellUtils.checkTmuxSession(tmuxSessionName);
    console.log(`[${projectId}] Session exists: ${sessionExists}`);

    // Build tmux command - create session if needed, then attach
    let tmuxCommand;
    if (!sessionExists) {
      // Create new session with a basic shell and immediately attach
      tmuxCommand = ShellUtils.tmuxCommand({
        action: "new-attach",
        sessionName: tmuxSessionName,
        projectPath,
      });
    } else {
      // Attach to existing session
      tmuxCommand = ShellUtils.tmuxCommand({
        action: "attach",
        sessionName: tmuxSessionName,
      });
    }

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

    // Send initial message to both desktop and web
    const initialMessage = !sessionExists
      ? `Creating new tmux session "${tmuxSessionName}" in ${projectPath}\r\n`
      : `Attaching to existing tmux session "${tmuxSessionName}"\r\n`;

    // Add a small delay to ensure UI handlers are ready
    setTimeout(() => {
      // Send to desktop if window exists
      if (win && !win.isDestroyed()) {
        console.log(`[Main Process] Sending initial message to renderer:`, {
          projectId,
          message: initialMessage.trim(),
          timestamp: new Date().toISOString(),
        });
        win.webContents.send("terminal-output", {
          projectId,
          data: initialMessage,
          type: "system",
        });
      } else {
        console.warn(
          `[Main Process] Cannot send initial message - window destroyed or missing`
        );
      }

      // Send to web clients
      broadcastToWebClients({
        type: "project-started",
        projectId: projectId,
        data: initialMessage,
      });
    }, 100);

    // Session established successfully
    if (!sessionExists) {
      console.log(`[${projectId}] New tmux session created`);
    } else {
      console.log(`[${projectId}] Attached to existing tmux session`);
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

          console.log(
            `[${projectId}] Notification check: windowFocused="${windowFocused}", notificationsEnabled="${desktopNotificationsEnabled}"`
          );

          if (!windowFocused && desktopNotificationsEnabled) {
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
            console.log(
              `[${projectId}] *** CLAUDE IS READY FOR INPUT (initial) ***`
            );
            sendStatusChange("ready");
          }
        }

        // Send to desktop
        if (win && !win.isDestroyed()) {
          console.log(`[Main Process] Sending terminal output to renderer:`, {
            projectId,
            dataLength: data?.length,
            dataPreview: data?.substring(0, 50),
            timestamp: new Date().toISOString(),
          });
          win.webContents.send("terminal-output", {
            projectId,
            data: data,
            type: "stdout",
          });
        } else {
          console.warn(
            `[Main Process] Cannot send terminal output - window destroyed or missing`
          );
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

        if (!windowFocused && desktopNotificationsEnabled) {
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

      if (!windowFocused && desktopNotificationsEnabled) {
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

function broadcastToWebClients(message: any) {
  const messageStr = JSON.stringify(message);
  webClients.forEach((client) => {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      try {
        client.send(messageStr);
      } catch (error) {
        console.error("Failed to send message to web client:", error);
        webClients.delete(client);
      }
    }
  });
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
    console.log(
      "Testing icon path:",
      testPath,
      "exists:",
      fs.existsSync(testPath)
    );
    if (fs.existsSync(testPath)) {
      iconPath = testPath;
      break;
    }
  }

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
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
      console.log("Failed to set dock icon:", error);
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
    console.log("Loading index.html from:", indexPath);

    // Use loadFile instead of loadURL for local files - it handles the protocol correctly
    win.loadFile(indexPath);
  }

  // Log when content loads
  win.webContents.once("did-finish-load", () => {});
}

// Clean up all tmux sessions and processes before quitting
app.on("before-quit", async (event) => {
  // Prevent default quit to allow cleanup
  event.preventDefault();

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

  // Close web server
  if (webServer) {
    webServer.close();
  }
  if (webSocketServer) {
    webSocketServer.close();
  }

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
  // Register IPC handlers first, before creating window
  setupIPCHandlers();

  createWindow();

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
      const result = await createWebServer(port);
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

ipcMain.handle("get-git-diff", async (event, projectPath: string) => {
  try {
    // Check if directory is a git repo
    const { stdout: isGitRepo } = await execAsync(
      "git rev-parse --is-inside-work-tree",
      { cwd: projectPath }
    ).catch(() => ({ stdout: "" }));

    if (!isGitRepo.trim()) {
      return { success: false, error: "Not a git repository" };
    }

    // Get current branch
    const { stdout: branch } = await execAsync("git branch --show-current", {
      cwd: projectPath,
    });

    // Get ahead/behind count
    let ahead = 0,
      behind = 0;
    try {
      const { stdout: revList } = await execAsync(
        "git rev-list --left-right --count HEAD...@{u}",
        { cwd: projectPath }
      );
      const [aheadStr, behindStr] = revList.trim().split("\t");
      ahead = parseInt(aheadStr) || 0;
      behind = parseInt(behindStr) || 0;
    } catch (e) {
      // No upstream branch
    }

    // Get list of changed files
    const { stdout: statusOutput } = await execAsync("git status --porcelain", {
      cwd: projectPath,
    });
    const files = [];

    if (statusOutput.trim()) {
      const lines = statusOutput.trim().split("\n");

      for (const line of lines) {
        // Handle git status format: XY filename (where X and Y are status codes)
        // Some lines might be missing the leading space for index status
        let status, filePath;
        if (line.length >= 3 && line[2] === " ") {
          // Standard format: "XY filename"
          status = line.substring(0, 2).trim();
          filePath = line.substring(3);
        } else if (line.length >= 2 && line[1] === " ") {
          // Format with single character status: "X filename"
          status = line.substring(0, 1).trim();
          filePath = line.substring(2);
        } else {
          // Fallback - try to find the first space
          const spaceIndex = line.indexOf(" ");
          if (spaceIndex > 0) {
            status = line.substring(0, spaceIndex).trim();
            filePath = line.substring(spaceIndex + 1);
          } else {
            console.warn(
              `[GIT DIFF] Could not parse git status line: "${line}"`
            );
            continue;
          }
        }

        let fileStatus: "added" | "modified" | "deleted" = "modified";
        if (status.includes("A") || status.includes("?")) fileStatus = "added";
        else if (status.includes("D")) fileStatus = "deleted";
        else fileStatus = "modified";

        let oldContent = "";
        let newContent = "";

        try {
          // Get the current file content
          if (fileStatus !== "deleted") {
            newContent = fs.readFileSync(
              path.join(projectPath, filePath),
              "utf8"
            );
          }

          // Get the original content from git
          if (fileStatus !== "added") {
            const { stdout } = await execAsync(`git show HEAD:"${filePath}"`, {
              cwd: projectPath,
            }).catch(() => ({ stdout: "" }));
            oldContent = stdout;
          }
        } catch (e) {
          console.error(`Error reading file ${filePath}:`, e);
        }

        // Count additions and deletions
        let additions = 0;
        let deletions = 0;

        if (fileStatus === "added") {
          additions = newContent.split("\n").length;
        } else if (fileStatus === "deleted") {
          deletions = oldContent.split("\n").length;
        } else {
          // Simple line count diff for modified files
          const oldLines = oldContent.split("\n");
          const newLines = newContent.split("\n");
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
          newContent,
        });
      }
    }

    return {
      success: true,
      data: {
        files,
        branch: branch.trim(),
        ahead,
        behind,
      },
    };
  } catch (error) {
    console.error("Git diff error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "save-file",
  async (event, projectPath: string, filePath: string, content: string) => {
    try {
      const fullPath = path.join(projectPath, filePath);
      fs.writeFileSync(fullPath, content, "utf8");
      return { success: true };
    } catch (error) {
      console.error("Save file error:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  "revert-file",
  async (event, projectPath: string, filePath: string) => {
    try {
      // Get the original content from git
      const { stdout } = await execAsync(`git show HEAD:"${filePath}"`, {
        cwd: projectPath,
      });

      // Write the original content back to the file
      const fullPath = path.join(projectPath, filePath);
      fs.writeFileSync(fullPath, stdout, "utf8");

      return { success: true };
    } catch (error) {
      console.error("Revert file error:", error);
      return { success: false, error: error.message };
    }
  }
);

// Get project file tree
ipcMain.handle("get-project-files", async (event, projectPath: string) => {
  try {
    const getFileTree = async (
      dirPath: string,
      relativePath: string = ""
    ): Promise<any[]> => {
      const items = [];
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        // Skip common ignore patterns
        if (
          file.startsWith(".") &&
          !file.startsWith(".env") &&
          file !== ".gitignore"
        )
          continue;
        if (
          file === "node_modules" ||
          file === ".git" ||
          file === "dist" ||
          file === "build"
        )
          continue;

        const fullPath = path.join(dirPath, file);
        const relativeFilePath = relativePath
          ? path.join(relativePath, file)
          : file;
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          const children = await getFileTree(fullPath, relativeFilePath);
          items.push({
            name: file,
            path: relativeFilePath,
            isDirectory: true,
            children: children.length > 0 ? children : undefined,
            isExpanded: false,
          });
        } else {
          items.push({
            name: file,
            path: relativeFilePath,
            isDirectory: false,
          });
        }
      }

      // Sort: directories first, then files, both alphabetically
      return items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    };

    const fileTree = await getFileTree(projectPath);
    return { success: true, data: fileTree };
  } catch (error) {
    console.error("Get project files error:", error);
    return { success: false, error: error.message };
  }
});

// Read file content
ipcMain.handle(
  "read-project-file",
  async (event, projectPath: string, filePath: string) => {
    try {
      const fullPath = path.join(projectPath, filePath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: "File not found" };
      }

      // Check if it's actually a file and not a directory
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) {
        return { success: false, error: "Path is not a file" };
      }

      // Read file content
      const content = fs.readFileSync(fullPath, "utf8");
      return { success: true, data: content };
    } catch (error) {
      console.error("Read project file error:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  "git-commit",
  async (event, projectPath: string, message: string) => {
    try {
      // Add all changes and commit
      await execAsync("git add .", { cwd: projectPath });
      await execAsync(
        `git commit --no-verify -m "${message.replace(/"/g, '\\"')}"`,
        { cwd: projectPath }
      );

      return { success: true };
    } catch (error) {
      console.error("Git commit error:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("git-push", async (event, projectPath: string) => {
  try {
    const { stdout } = await execAsync("git push", { cwd: projectPath });
    return { success: true, output: stdout };
  } catch (error) {
    console.error("Git push error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "set-selected-project",
  async (event, projectId: string | null) => {
    currentlySelectedProject = projectId;
    return { success: true };
  }
);

ipcMain.handle("get-local-ip", async () => {
  const interfaces = os.networkInterfaces();

  let localIp = "localhost";
  let tailscaleRunning = false;

  // Simple check: just see if tailscale status command works
  try {
    await execAsync("tailscale status");
    tailscaleRunning = true;
  } catch (error) {}

  // Get local network IP
  const priorityInterfaces = [
    "en0",
    "en1",
    "eth0",
    "wlan0",
    "Wi-Fi",
    "Ethernet",
  ];

  // Try priority interfaces first
  for (const name of priorityInterfaces) {
    if (interfaces[name]) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp !== "localhost") break;
    }
  }

  // Fallback: Look for any 192.168.x.x address
  if (localIp === "localhost") {
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (
          iface.family === "IPv4" &&
          !iface.internal &&
          iface.address.startsWith("192.168.")
        ) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp !== "localhost") break;
    }
  }

  return {
    localIp,
    hasTailscale: tailscaleRunning,
  };
});

// Discord notification handlers
ipcMain.handle("test-discord-notification", async (event, discordSettings) => {
  try {
    if (!discordSettings.webhookUrl) {
      return { success: false, error: "No webhook URL provided" };
    }

    await sendDiscordNotification(
      discordSettings.webhookUrl,
      discordSettings.username || "Vibe Term",
      "🧪 **Test Notification**\n\nThis is a test notification from Vibe Term. Your Discord notifications are working correctly!"
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "send-discord-notification",
  async (event, discordSettings, message) => {
    try {
      if (!discordSettings.webhookUrl || !discordSettings.enabled) {
        return {
          success: false,
          error: "Discord notifications not configured or disabled",
        };
      }

      await sendDiscordNotification(
        discordSettings.webhookUrl,
        discordSettings.username || "Vibe Term",
        message
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
