import { ipcMain, dialog, BrowserWindow, app, Notification } from "electron";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import { exec, ChildProcess } from "child_process";
import { ShellUtils } from "./utils/shell-utils";
import { AIProviderService } from "./utils/ai-provider-service";
import type { IPty } from "@lydell/node-pty";
import { broadcastToWebClients, closeWebServer, isWebServerRunning, createWebServer } from "./web-server";
import type { UnifiedItem } from "../client/types";
import type {
  BaseResponse,
  DataResponse,
  PTYResult,
  CommandResult,
  GitFile,
  GitDiffResult,
  FileTreeItem,
  LocalIpResult,
  ImageResult,
  AppSettings,
} from "./ipc-handler-types";

const execAsync = promisify(exec);

// Generic IPC handler type - now properly typed
type IPCHandler<TArgs extends any[] = any[], TResult = any> = (
  ...args: TArgs
) => Promise<TResult>;

// IPC handlers registry for automatic endpoint generation
const ipcHandlers = new Map<string, IPCHandler>();

// Dependencies for web server creation
let webServerDependencies: { ipcHandlers: Map<string, IPCHandler>; app: any } | null = null;

// Function to set web server dependencies (called from main.ts)
export function setWebServerDependencies(deps: { ipcHandlers: Map<string, IPCHandler>; app: any }) {
  webServerDependencies = deps;
}

// Helper function to register IPC handlers with proper typing
function registerIPCHandler<TArgs extends any[], TResult>(
  name: string,
  handler: IPCHandler<TArgs, TResult>
) {
  ipcHandlers.set(name, handler as IPCHandler);
  ipcMain.handle(name, async (_event, ...args) => handler(...(args as TArgs)));
}

// Internal interfaces for this file
interface WebSocketMessage {
  type: string;
  projectId?: string;
  data?: string;
  timestamp?: number;
}

interface AppState {
  settings?: AppSettings;
  storedItems?: UnifiedItem[];
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
  registerIPCHandler<[string, string, string?, string?, boolean?], PTYResult>(
    "start-ai-process",
    async (
      projectId,
      projectPath,
      command,
      projectName,
      yoloMode
    ): Promise<PTYResult> => {
      return await getOrCreateSharedPty(
        projectId,
        projectPath,
        projectName,
        yoloMode,
        command
      );
    }
  );

  registerIPCHandler<[string, string], BaseResponse>(
    "ai-hook",
    async (hookType, projectId): Promise<BaseResponse> => {
      try {
        // Determine status based on hook type
        let status: string;
        switch (hookType) {
          case "Stop":
          case "SubagentStop":
            status = "ready";
            break;
          case "UserPromptSubmit":
            status = "working";
            break;
          case "Notification":
            status = "waiting";
            break;
          default:
            status = "unknown";
        }

        // Send immediate status updates to both desktop and web clients
        if (win && !win.isDestroyed()) {
          if (status === "ready") {
            win.webContents.send("ai-ready", {
              projectId,
              timestamp: Date.now(),
            });

            // Send desktop notification if window is not focused and not recently sent
            const windowFocused = win.isFocused();
            if (!windowFocused && shouldSendNotification(projectId)) {
              const notification = new Notification({
                title: `${projectId} finished`,
                body: "AI task completed",
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
          } else if (status === "working") {
            win.webContents.send("ai-working", {
              projectId,
              timestamp: Date.now(),
            });
          }
        }

        // Broadcast to web clients
        const eventType =
          status === "ready"
            ? "project-ready"
            : status === "working"
            ? "project-working"
            : "ai-status-change";

        broadcastToWebClients({
          type: eventType,
          projectId: projectId,
          data: status,
          timestamp: Date.now(),
        });

        return { success: true };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error processing AI hook:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler<[string], BaseResponse>(
    "stop-ai-process",
    async (projectId): Promise<BaseResponse> => {
      const proc = sharedPtyProcesses.get(projectId);

      // Kill PTY process
      if (proc) {
        proc.kill();
        sharedPtyProcesses.delete(projectId);
      }

      // Kill background process if running
      const backgroundProc = backgroundProcesses.get(projectId);
      if (backgroundProc) {
        backgroundProc.kill("SIGTERM");
        backgroundProcesses.delete(projectId);
      }

      // Kill the tmux session (silently fails if not running)
      const state = readStateFile();
      const projects =
        state.storedItems?.filter(
          (item: UnifiedItem) => item.type === "project"
        ) || [];
      const project = projects.find((p: UnifiedItem) => p.id === projectId);

      if (project) {
        const sessionBase = project.name || projectId;
        const tmuxSessionName = ShellUtils.generateTmuxSessionName(sessionBase);
        ShellUtils.killTmuxSession(tmuxSessionName);
      }

      return { success: true };
    }
  );

  registerIPCHandler<[string, string], BaseResponse>(
    "send-input",
    async (projectId, input): Promise<BaseResponse> => {
      const proc = sharedPtyProcesses.get(projectId);
      if (proc) {
        proc.write(input);
        return { success: true };
      }
      return { success: false, error: "Process not found" };
    }
  );

  registerIPCHandler<[string, string], CommandResult>(
    "test-command",
    async (projectPath, command): Promise<CommandResult> => {
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
  registerIPCHandler<[AppState], BaseResponse>(
    "write-state-file",
    async (state): Promise<BaseResponse> => {
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error writing state file:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  // Directory selection
  registerIPCHandler<[], DataResponse<{ path: string }>>(
    "select-directory",
    async (): Promise<DataResponse<{ path: string }>> => {
      if (!win) {
        return {
          success: false,
          error: "Window not available",
          data: { path: "" },
        };
      }
      try {
        const result = await dialog.showOpenDialog(win, {
          properties: ["openDirectory"],
        });

        if (result.canceled || !result.filePaths[0]) {
          return {
            success: false,
            error: "Directory selection cancelled",
            data: { path: "" },
          };
        }

        return {
          success: true,
          data: { path: result.filePaths[0] },
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Directory selection error:", error);
        return { success: false, error: errorMessage, data: { path: "" } };
      }
    }
  );

  // Git operations
  registerIPCHandler<[string], DataResponse<GitDiffResult>>(
    "get-git-diff",
    async (projectPath): Promise<DataResponse<GitDiffResult>> => {
      try {
        // Check if directory is a git repo
        const { stdout: isGitRepo } = await execAsync(
          "git rev-parse --is-inside-work-tree",
          { cwd: projectPath }
        ).catch(() => ({ stdout: "" }));

        if (!isGitRepo.trim()) {
          return {
            success: false,
            error: "Not a git repository",
            data: { files: [], branch: "", ahead: 0, behind: 0 },
          };
        }

        // Get current branch
        const { stdout: branch } = await execAsync(
          "git branch --show-current",
          {
            cwd: projectPath,
          }
        );

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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Git diff error:", error);
        return {
          success: false,
          error: errorMessage,
          data: { files: [], branch: "", ahead: 0, behind: 0 },
        };
      }
    }
  );

  registerIPCHandler<[string, string, string], BaseResponse>(
    "save-file",
    async (projectPath, filePath, content): Promise<BaseResponse> => {
      try {
        const fullPath = path.join(projectPath, filePath);
        fs.writeFileSync(fullPath, content, "utf8");
        return { success: true };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Save file error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler<[string, string], BaseResponse>(
    "revert-file",
    async (projectPath, filePath): Promise<BaseResponse> => {
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Revert file error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  // File operations
  registerIPCHandler(
    "get-project-files",
    async (...args: unknown[]): Promise<DataResponse<FileTreeItem[]>> => {
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Get project files error:", error);
        return { success: false, error: errorMessage, data: [] };
      }
    }
  );

  registerIPCHandler(
    "read-project-file",
    async (...args: unknown[]): Promise<DataResponse<string>> => {
      const [projectPath, filePath] = args as [string, string];
      try {
        const fullPath = path.join(projectPath, filePath);

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          return { success: false, error: "File not found", data: "" };
        }

        // Check if it's actually a file and not a directory
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
          return { success: false, error: "Path is not a file", data: "" };
        }

        // Read file content
        const content = fs.readFileSync(fullPath, "utf8");
        return { success: true, data: content };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Read project file error:", error);
        return { success: false, error: errorMessage, data: "" };
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Read image file error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler(
    "git-commit",
    async (...args: unknown[]): Promise<BaseResponse> => {
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Git commit error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler(
    "git-push",
    async (...args: unknown[]): Promise<CommandResult> => {
      const [projectPath] = args as [string];
      try {
        const { stdout } = await execAsync("git push", { cwd: projectPath });
        return { success: true, output: stdout };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Git push error:", error);
        return { success: false, error: errorMessage };
      }
    }
  );

  registerIPCHandler("set-selected-project", async (): Promise<BasicResult> => {
    // Note: This would need to be passed from main.ts or handled differently
    // const [projectId] = args as [string | null];
    // currentlySelectedProject = projectId;
    return { success: true };
  });

  registerIPCHandler(
    "get-local-ip",
    async (): Promise<DataResponse<LocalIpResult>> => {
      const interfaces = os.networkInterfaces();

      let localIp = "localhost";
      let tailscaleIp = "";
      let tailscaleRunning = false;

      // Check if Tailscale is running and get its hostname/IP
      try {
        // First try to get the MagicDNS hostname
        try {
          const { stdout: statusOutput } = await execAsync("tailscale status --json");
          const status = JSON.parse(statusOutput);
          
          // Extract the hostname from the status
          if (status.Self && status.Self.DNSName) {
            // Remove the trailing dot if present
            tailscaleIp = status.Self.DNSName.replace(/\.$/, '');
            tailscaleRunning = true;
          }
        } catch (jsonError) {
          // Fallback to IP if JSON parsing fails or MagicDNS not available
          const { stdout } = await execAsync("tailscale ip -4");
          tailscaleIp = stdout.trim();
          tailscaleRunning = true;
        }
      } catch (error) {
        console.error("Tailscale not available:", error);
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

      // Prefer Tailscale IP if available
      const displayIp = tailscaleIp || localIp;

      return {
        success: true,
        data: {
          localIp: displayIp,
          hasTailscale: tailscaleRunning,
        },
      };
    }
  );

  // Data management IPC handlers
  registerIPCHandler(
    "get-stored-items",
    async (): Promise<{ success: boolean; data: UnifiedItem[] }> => {
      const state = getAppState();
      return { success: true, data: state.storedItems || [] };
    }
  );

  registerIPCHandler(
    "add-stored-item",
    async (...args: unknown[]): Promise<{ success: boolean }> => {
      const [item] = args as [UnifiedItem];
      addStoredItem(item);
      return { success: true };
    }
  );

  registerIPCHandler(
    "update-stored-item",
    async (...args: unknown[]): Promise<{ success: boolean }> => {
      const [id, updates] = args as [string, Partial<UnifiedItem>];
      updateStoredItem(id, updates);
      return { success: true };
    }
  );

  registerIPCHandler(
    "delete-stored-item",
    async (...args: unknown[]): Promise<{ success: boolean }> => {
      const [id] = args as [string];
      deleteStoredItem(id);
      return { success: true };
    }
  );

  registerIPCHandler(
    "get-app-settings",
    async (): Promise<{ success: boolean; data: any }> => {
      const state = getAppState();
      return { success: true, data: state.settings };
    }
  );

  registerIPCHandler(
    "update-app-settings",
    async (...args: unknown[]): Promise<{ success: boolean }> => {
      const [newSettings] = args as [Partial<AppSettings>];
      
      // Check if web server is being disabled
      const currentSettings = getAppState().settings;
      const wasWebServerEnabled = currentSettings?.webServer?.enabled ?? true;
      const isWebServerEnabled = newSettings?.webServer?.enabled ?? true;
      
      // Merge with existing settings
      const mergedSettings = {
        ...currentSettings,
        ...newSettings
      };
      
      // Update settings first
      updateAppState({ settings: mergedSettings });
      
      // Handle web server state change
      if (wasWebServerEnabled && !isWebServerEnabled) {
        // Web server was enabled, now disabled - shut it down
        if (isWebServerRunning()) {
          console.log("Web server disabled via settings - shutting down");
          closeWebServer();
        }
      } else if (!wasWebServerEnabled && isWebServerEnabled) {
        // Web server was disabled, now enabled - start it up
        if (!isWebServerRunning() && webServerDependencies) {
          console.log("Web server enabled via settings - starting up");
          try {
            await createWebServer(webServerDependencies, 1337);
            console.log("Web server started successfully");
          } catch (error) {
            console.error("Failed to start web server:", error);
          }
        }
      }
      
      return { success: true };
    }
  );

  // AI Provider management
  registerIPCHandler(
    "get-ai-providers",
    async (): Promise<{ success: boolean; data: any[] }> => {
      const providers = AIProviderService.getAllProviders();
      // Use cached availability instead of re-checking each time
      const cachedAvailability = settingsManager.getAiProviderAvailability() || {};
      
      const providersWithAvailability = providers.map(provider => ({
        ...provider,
        available: cachedAvailability[provider.id] || false
      }));
      
      return { success: true, data: providersWithAvailability };
    }
  );

  registerIPCHandler(
    "check-ai-provider",
    async (...args: unknown[]): Promise<{ success: boolean; available: boolean }> => {
      const [providerId] = args as [string];
      const available = await AIProviderService.checkProviderAvailability(providerId);
      return { success: true, available };
    }
  );

}

export { ipcHandlers };
