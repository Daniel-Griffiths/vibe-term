import { ipcMain, dialog, BrowserWindow, app, Notification } from "electron";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import { exec, ChildProcess } from "child_process";
import { ShellUtils } from "../src/utils/shellUtils";
import type { IPty } from "node-pty";

const execAsync = promisify(exec);

// Type definitions
interface GitFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
}

interface GitDiffResult {
  files: GitFile[];
  branch: string;
  ahead: number;
  behind: number;
}

interface FileTreeItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeItem[];
  isExpanded?: boolean;
}

interface LocalIpResult {
  localIp: string;
  hasTailscale: boolean;
}

interface DiscordSettings {
  webhookUrl?: string;
  username?: string;
  enabled?: boolean;
}

interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

interface BasicResult {
  success: boolean;
  error?: string;
}

interface DataResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ImageResult {
  success: boolean;
  data?: string;
  mimeType?: string;
  error?: string;
}

// IPC handler type
type IPCHandler = (...args: unknown[]) => Promise<unknown>;

// IPC handlers registry for automatic endpoint generation
const ipcHandlers = new Map<string, IPCHandler>();

// Helper function to register IPC handlers
function registerIPCHandler(name: string, handler: IPCHandler) {
  ipcHandlers.set(name, handler);
  ipcMain.handle(name, async (_event, ...args) => handler(...args));
}

// Discord notification function
const sendDiscordNotification = async (
  webhookUrl: string,
  username: string,
  content: string
): Promise<BasicResult> => {
  const https = await import("https");
  const url = await import("url");

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
    const req = https.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve({ success: true });
      } else {
        reject(new Error(`Discord webhook returned status ${res.statusCode}`));
      }
    });

    req.on("error", (error: Error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
};

interface Project {
  id: string;
  type: string;
  name: string;
  path: string;
  runCommand?: string;
}

interface AppState {
  settings?: Record<string, unknown>;
  storedItems?: Array<Project>;
}

interface PTYResult {
  success: boolean;
  projectId?: string;
  error?: string;
}

interface WebSocketMessage {
  type: string;
  projectId?: string;
  data?: string;
  timestamp?: number;
}

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

interface IPCHandlerDependencies {
  win: BrowserWindow | null;
  sharedPtyProcesses: Map<string, IPty>;
  backgroundProcesses: Map<string, ChildProcess>;
  terminalBuffers: Map<string, string>;
  getOrCreateSharedPty: (
    projectId: string,
    projectPath: string,
    projectName?: string,
    yoloMode?: boolean,
    runCommand?: string
  ) => Promise<PTYResult>;
  readStateFile: () => AppState;
  broadcastToWebClients: (message: WebSocketMessage) => void;
  getAppState: () => AppState;
  updateAppState: (newState: Partial<AppState>) => void;
  addStoredItem: (item: UnifiedItem) => void;
  updateStoredItem: (id: string, updates: Partial<UnifiedItem>) => void;
  deleteStoredItem: (id: string) => void;
}

export function setupIPCHandlers(deps: IPCHandlerDependencies): void {
  const {
    win,
    sharedPtyProcesses,
    backgroundProcesses,
    getOrCreateSharedPty,
    readStateFile,
    getAppState,
    updateAppState,
    addStoredItem,
    updateStoredItem,
    deleteStoredItem,
  } = deps;

  // Process management
  registerIPCHandler(
    "start-claude-process",
    async (...args: unknown[]): Promise<PTYResult> => {
      const [projectId, projectPath, command, projectName, yoloMode] = args as [
        string,
        string,
        string | undefined,
        string | undefined,
        boolean | undefined
      ];
      return await getOrCreateSharedPty(
        projectId,
        projectPath,
        projectName,
        yoloMode,
        command
      );
    }
  );

  registerIPCHandler("claude-hook", async (...args: unknown[]): Promise<BasicResult> => {
    const [hookType, projectId] = args as [string, string];
    
    try {
      console.log(`[Claude Hook] Received ${hookType} hook for project ${projectId}`);
      
      // Determine status based on hook type
      let status: string;
      switch (hookType) {
        case 'Stop':
        case 'SubagentStop':
          status = 'ready';
          break;
        case 'UserPromptSubmit':
          status = 'working';
          break;
        case 'Notification':
          status = 'waiting';
          break;
        default:
          status = 'unknown';
      }
      
      // Send immediate status updates to both desktop and web clients
      if (win && !win.isDestroyed()) {
        if (status === 'ready') {
          win.webContents.send("claude-ready", {
            projectId,
            timestamp: Date.now(),
          });
          
          // Send desktop notification if window is not focused
          const windowFocused = win.isFocused();
          if (!windowFocused) {
            const notification = new Notification({
              title: `${projectId} finished`,
              body: "Claude Code task completed",
              silent: false,
            });
            notification.show();
            notification.on("click", () => {
              if (win && !win.isDestroyed()) {
                if (win.isMinimized()) win.restore();
                win.focus();
              }
            });
          }
        } else if (status === 'working') {
          win.webContents.send("claude-working", {
            projectId,
            timestamp: Date.now(),
          });
        }
      }
      
      // Broadcast to web clients
      const eventType = status === 'ready' ? 'project-ready' : 
                       status === 'working' ? 'project-working' : 
                       'claude-status-change';
      
      broadcastToWebClients({
        type: eventType,
        projectId: projectId,
        data: status,
        timestamp: Date.now()
      });
      
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error('Error processing Claude hook:', error);
      return { success: false, error: errorMessage };
    }
  });

  registerIPCHandler("stop-claude-process", async (...args: unknown[]): Promise<BasicResult> => {
    const [projectId] = args as [string];
    const proc = sharedPtyProcesses.get(projectId);

    // Kill PTY process
    if (proc) {
      proc.kill();
      sharedPtyProcesses.delete(projectId);
    }

    // Kill background process if running
    const backgroundProc = backgroundProcesses.get(projectId);
    if (backgroundProc) {
      console.log(`[${projectId}] Killing background process`);
      backgroundProc.kill("SIGTERM");
      backgroundProcesses.delete(projectId);
    }

    // Kill the tmux session (silently fails if not running)
    const state = readStateFile();
    const projects =
      state.storedItems?.filter((item: Project) => item.type === "project") || [];
    const project = projects.find((p: Project) => p.id === projectId);

    if (project) {
      const sessionBase = project.name || projectId;
      const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);
      ShellUtils.killTmuxSession(tmuxSessionName);
    }

    return { success: true };
  });

  registerIPCHandler("send-input", async (...args: unknown[]): Promise<BasicResult> => {
    const [projectId, input] = args as [string, string];
    const proc = sharedPtyProcesses.get(projectId);
    if (proc) {
      proc.write(input);
      return { success: true };
    }
    return { success: false, error: "Process not found" };
  });

  registerIPCHandler(
    "test-command",
    async (...args: unknown[]): Promise<CommandResult> => {
      const [projectPath, command] = args as [string, string];
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
  registerIPCHandler("write-state-file", async (...args: unknown[]): Promise<BasicResult> => {
    const [state] = args as [AppState];
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error writing state file:", error);
      return { success: false, error: errorMessage };
    }
  });

  // Directory selection
  registerIPCHandler("select-directory", async (): Promise<DataResult<{ path: string }>> => {
    if (!win) {
      console.warn("Window not available for directory selection");
      return { success: false, error: "Window not available" };
    }
    try {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openDirectory"],
      });
      
      if (result.canceled || !result.filePaths[0]) {
        return { success: false, error: "Directory selection cancelled" };
      }
      
      return { 
        success: true, 
        data: { path: result.filePaths[0] }
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Directory selection error:", error);
      return { success: false, error: errorMessage };
    }
  });

  // Git operations
  registerIPCHandler("get-git-diff", async (...args: unknown[]): Promise<DataResult<GitDiffResult>> => {
    const [projectPath] = args as [string];
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
      } catch (error) {
        console.error("Failed to get git ahead/behind count:", error);
      }

      // Get list of changed files
      const { stdout: statusOutput } = await execAsync(
        "git status --porcelain",
        {
          cwd: projectPath,
        }
      );
      const files: GitFile[] = [];

      if (statusOutput.trim()) {
        const lines = statusOutput.trim().split("\n");

        for (const line of lines) {
          // Handle git status format: XY filename (where X and Y are status codes)
          // Some lines might be missing the leading space for index status
          let status: string, filePath: string;
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
          if (status.includes("A") || status.includes("?"))
            fileStatus = "added";
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
              const { stdout } = await execAsync(
                `git show HEAD:"${filePath}"`,
                {
                  cwd: projectPath,
                }
              ).catch(() => ({ stdout: "" }));
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Git diff error:", error);
      return { success: false, error: errorMessage };
    }
  });

  registerIPCHandler(
    "save-file",
    async (...args: unknown[]): Promise<BasicResult> => {
      const [projectPath, filePath, content] = args as [string, string, string];
      try {
        const fullPath = path.join(projectPath, filePath);
        fs.writeFileSync(fullPath, content, "utf8");
        return { success: true };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Save file error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler(
    "revert-file",
    async (...args: unknown[]): Promise<BasicResult> => {
      const [projectPath, filePath] = args as [string, string];
      try {
        // Get the original content from git
        const { stdout } = await execAsync(`git show HEAD:"${filePath}"`, {
          cwd: projectPath,
        });

        // Write the original content back to the file
        const fullPath = path.join(projectPath, filePath);
        fs.writeFileSync(fullPath, stdout, "utf8");

        return { success: true };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Revert file error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  // File operations
  registerIPCHandler("get-project-files", async (...args: unknown[]): Promise<DataResult<FileTreeItem[]>> => {
    const [projectPath] = args as [string];
    try {
      const getFileTree = async (
        dirPath: string,
        relativePath: string = ""
      ): Promise<FileTreeItem[]> => {
        const items: FileTreeItem[] = [];
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Get project files error:", error);
      return { success: false, error: errorMessage };
    }
  });

  registerIPCHandler(
    "read-project-file",
    async (...args: unknown[]): Promise<DataResult<string>> => {
      const [projectPath, filePath] = args as [string, string];
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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Read project file error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler(
    "read-image-file",
    async (...args: unknown[]): Promise<ImageResult> => {
      const [projectPath, filePath] = args as [string, string];
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

        // Read file as base64
        const buffer = fs.readFileSync(fullPath);
        const base64 = buffer.toString("base64");

        // Determine MIME type based on extension
        const ext = path.extname(fullPath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".bmp": "image/bmp",
          ".svg": "image/svg+xml",
          ".webp": "image/webp",
          ".ico": "image/x-icon",
          ".tiff": "image/tiff",
          ".tif": "image/tiff",
          ".avif": "image/avif",
        };
        const mimeType = mimeTypes[ext] || "image/jpeg";

        return { success: true, data: base64, mimeType };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Read image file error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler(
    "git-commit",
    async (...args: unknown[]): Promise<BasicResult> => {
      const [projectPath, message] = args as [string, string];
      try {
        // Add all changes and commit
        await execAsync("git add .", { cwd: projectPath });
        await execAsync(
          `git commit --no-verify -m "${message.replace(/"/g, '\\"')}"`,
          { cwd: projectPath }
        );

        return { success: true };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Git commit error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler("git-push", async (...args: unknown[]): Promise<CommandResult> => {
    const [projectPath] = args as [string];
    try {
      const { stdout } = await execAsync("git push", { cwd: projectPath });
      return { success: true, output: stdout };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Git push error:", error);
      return { success: false, error: errorMessage };
    }
  });

  registerIPCHandler(
    "set-selected-project",
    async (): Promise<BasicResult> => {
      // Note: This would need to be passed from main.ts or handled differently
      // const [projectId] = args as [string | null];
      // currentlySelectedProject = projectId;
      return { success: true };
    }
  );

  registerIPCHandler("get-local-ip", async (): Promise<DataResult<LocalIpResult>> => {
    const interfaces = os.networkInterfaces();

    let localIp = "localhost";
    let tailscaleRunning = false;

    // Simple check: just see if tailscale status command works
    try {
      await execAsync("tailscale status");
      tailscaleRunning = true;
    } catch (error) {
      // Silently fail - tailscale not available
    }

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
        for (const iface of interfaces[name]!) {
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
        if (interfaces[name]) {
          for (const iface of interfaces[name]!) {
            if (
              iface.family === "IPv4" &&
              !iface.internal &&
              iface.address.startsWith("192.168.")
            ) {
              localIp = iface.address;
              break;
            }
          }
        }
        if (localIp !== "localhost") break;
      }
    }

    return {
      success: true,
      data: {
        localIp,
        hasTailscale: tailscaleRunning,
      }
    };
  });

  // Discord notification handlers
  registerIPCHandler("test-discord-notification", async (...args: unknown[]): Promise<BasicResult> => {
    const [discordSettings] = args as [DiscordSettings];
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  });

  registerIPCHandler(
    "send-discord-notification",
    async (...args: unknown[]): Promise<BasicResult> => {
      const [discordSettings, message] = args as [DiscordSettings, string];
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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: errorMessage };
      }
    }
  );

  // Data management IPC handlers
  registerIPCHandler("get-stored-items", async (): Promise<{ success: boolean; data: UnifiedItem[] }> => {
    const state = getAppState();
    console.log('[IPC Debug] get-stored-items called, returning:', state.storedItems);
    return { success: true, data: state.storedItems };
  });

  registerIPCHandler("add-stored-item", async (...args: unknown[]): Promise<{ success: boolean }> => {
    const [item] = args as [UnifiedItem];
    addStoredItem(item);
    return { success: true };
  });

  registerIPCHandler("update-stored-item", async (...args: unknown[]): Promise<{ success: boolean }> => {
    const [id, updates] = args as [string, Partial<UnifiedItem>];
    updateStoredItem(id, updates);
    return { success: true };
  });

  registerIPCHandler("delete-stored-item", async (...args: unknown[]): Promise<{ success: boolean }> => {
    const [id] = args as [string];
    deleteStoredItem(id);
    return { success: true };
  });

  registerIPCHandler("get-app-settings", async (): Promise<{ success: boolean; data: any }> => {
    const state = getAppState();
    console.log('[IPC Debug] get-app-settings called, returning:', state.settings);
    return { success: true, data: state.settings };
  });

  registerIPCHandler("update-app-settings", async (...args: unknown[]): Promise<{ success: boolean }> => {
    const [settings] = args as [any];
    updateAppState({ settings });
    return { success: true };
  });
}

export { ipcHandlers };
