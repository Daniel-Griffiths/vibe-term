import { app, BrowserWindow, ipcMain, Notification } from "electron";
import fs from "fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec } from "child_process";
import { promisify } from "util";
import * as pty from "node-pty";
const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
const processes = /* @__PURE__ */ new Map();
let currentlySelectedProject = null;
const getStoragePath = () => path.join(app.getPath("userData"), "projects.json");
const loadProjects = () => {
  try {
    const storagePath = getStoragePath();
    if (fs.existsSync(storagePath)) {
      const data = fs.readFileSync(storagePath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading projects:", error);
  }
  return [];
};
const saveProjects = (projects) => {
  try {
    const storagePath = getStoragePath();
    fs.writeFileSync(storagePath, JSON.stringify(projects, null, 2));
  } catch (error) {
    console.error("Error saving projects:", error);
  }
};
function createWindow() {
  const iconPaths = [
    path.join(process.env.APP_ROOT || "", "public", "icon.png"),
    path.join(__dirname, "..", "public", "icon.png"),
    path.join(process.cwd(), "public", "icon.png"),
    path.join(process.env.VITE_PUBLIC || "", "icon.png")
  ];
  let iconPath = null;
  for (const testPath of iconPaths) {
    console.log("Testing icon path:", testPath, "exists:", fs.existsSync(testPath));
    if (fs.existsSync(testPath)) {
      iconPath = testPath;
      break;
    }
  }
  console.log("Using icon path:", iconPath);
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    ...iconPath && { icon: iconPath },
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: "#000000",
    // Pure black background for older macOS
    vibrancy: "ultra-dark",
    // Use built-in vibrancy for subtle effect
    frame: false,
    hasShadow: true,
    transparent: false,
    // Solid background instead of transparency
    show: false
    // Don't show until ready
  });
  if (process.platform === "darwin" && iconPath) {
    try {
      app.dock.setIcon(iconPath);
    } catch (error) {
      console.log("Failed to set dock icon:", error);
    }
  }
  win.setWindowButtonVisibility(true);
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
    win?.show();
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.webContents.once("did-finish-load", () => {
    console.log("🎨 Vibe Term loaded with solid dark theme (macOS vibrancy)");
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    processes.forEach((proc) => proc.kill());
    processes.clear();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.handle("start-claude-process", async (event, projectId, projectPath, command, projectName, yoloMode) => {
  try {
    if (processes.has(projectId)) {
      processes.get(projectId)?.kill();
    }
    const sessionBase = projectName || projectId;
    const tmuxSessionName = sessionBase.toLowerCase().replace(/[^a-z0-9]/g, "-");
    console.log(`[${projectId}] Creating tmux session: ${tmuxSessionName}`);
    const tmuxCommand = `tmux kill-session -t "${tmuxSessionName}" 2>/dev/null || true; tmux new-session -s "${tmuxSessionName}" -c "${projectPath}" \\; set-option status off`;
    const proc = pty.spawn("/bin/bash", ["-c", tmuxCommand], {
      cwd: projectPath,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        FORCE_COLOR: "1",
        CLICOLOR_FORCE: "1"
      },
      cols: 80,
      rows: 24
    });
    processes.set(projectId, proc);
    win?.webContents.send("terminal-output", {
      projectId,
      data: `Starting tmux session "${tmuxSessionName}" in ${projectPath}\r
`,
      type: "system"
    });
    setTimeout(() => {
      if (proc) {
        const claudeCommand = yoloMode ? "claude --dangerously-skip-permissions\r" : "claude\r";
        console.log(`[${projectId}] Auto-starting Claude Code in tmux session with command: ${claudeCommand.trim()}`);
        proc.write(claudeCommand);
      }
    }, 200);
    let lastStateIndicator = null;
    let statusChangeTimeout = null;
    const sendStatusChange = (status, delay = 1e3) => {
      if (statusChangeTimeout) {
        clearTimeout(statusChangeTimeout);
      }
      statusChangeTimeout = setTimeout(() => {
        if (status === "ready") {
          win?.webContents.send("claude-ready", {
            projectId,
            timestamp: Date.now()
          });
          if (currentlySelectedProject !== projectId) {
            const projectName2 = projectId;
            const notification = new Notification({
              title: `${projectName2} finished`,
              body: "",
              icon: path.join(process.env.APP_ROOT || "", "public", "icon.png"),
              // Optional icon
              silent: false
            });
            notification.show();
            notification.on("click", () => {
              if (win) {
                if (win.isMinimized()) win.restore();
                win.focus();
              }
            });
          }
        } else if (status === "working") {
          win?.webContents.send("claude-working", {
            projectId,
            timestamp: Date.now()
          });
        }
        statusChangeTimeout = null;
      }, delay);
    };
    proc.onData((data) => {
      console.log(`[${projectId}] PTY DATA:`, data);
      if (data.includes("⏺")) {
        lastStateIndicator = "finished";
        console.log(`[${projectId}] *** CLAUDE FINISHED (⏺ detected) ***`);
        if (data.includes("│") && data.includes(">")) {
          console.log(`[${projectId}] *** CLAUDE IS READY FOR INPUT ***`);
          sendStatusChange("ready");
        } else {
          setTimeout(() => {
            sendStatusChange("ready");
          }, 100);
        }
      } else if (data.match(/[✳✽✻✶✢]/)) {
        if (lastStateIndicator !== "working") {
          lastStateIndicator = "working";
          console.log(`[${projectId}] *** CLAUDE IS WORKING/THINKING ***`);
          sendStatusChange("working");
        }
      } else if (data.includes("│") && data.includes(">") && data.includes("⏵⏵")) {
        if (lastStateIndicator !== "ready") {
          lastStateIndicator = "ready";
          console.log(`[${projectId}] *** CLAUDE IS READY FOR INPUT (initial) ***`);
          sendStatusChange("ready");
        }
      }
      win?.webContents.send("terminal-output", {
        projectId,
        data,
        type: "stdout"
      });
    });
    proc.on("exit", (code) => {
      console.log(`[${projectId}] Process exit:`, code);
      win?.webContents.send("process-exit", { projectId, code });
      win?.webContents.send("terminal-output", {
        projectId,
        data: `
Terminal session ended with code ${code}
`,
        type: "system"
      });
      processes.delete(projectId);
    });
    proc.on("error", (error) => {
      console.log(`[${projectId}] Process error:`, error);
      win?.webContents.send("terminal-output", {
        projectId,
        data: `Error: ${error.message}
`,
        type: "error"
      });
    });
    return { success: true, projectId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("stop-claude-process", async (event, projectId) => {
  const proc = processes.get(projectId);
  if (proc) {
    proc.kill();
    processes.delete(projectId);
    return { success: true };
  }
  return { success: false, error: "Process not found" };
});
ipcMain.handle("send-input", async (event, projectId, input) => {
  const proc = processes.get(projectId);
  if (proc) {
    console.log(`[${projectId}] Sending raw input to PTY:`, JSON.stringify(input));
    proc.write(input);
    return { success: true };
  }
  return { success: false, error: "PTY process not found" };
});
ipcMain.handle("select-directory", async () => {
  const { dialog } = await import("electron");
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});
ipcMain.handle("load-projects", async () => {
  return loadProjects();
});
ipcMain.handle("save-projects", async (event, projects) => {
  saveProjects(projects);
  return { success: true };
});
ipcMain.handle("get-git-diff", async (event, projectPath) => {
  try {
    const { stdout: isGitRepo } = await execAsync("git rev-parse --is-inside-work-tree", { cwd: projectPath }).catch(() => ({ stdout: "" }));
    if (!isGitRepo.trim()) {
      return { success: false, error: "Not a git repository" };
    }
    const { stdout: branch } = await execAsync("git branch --show-current", { cwd: projectPath });
    let ahead = 0, behind = 0;
    try {
      const { stdout: revList } = await execAsync("git rev-list --left-right --count HEAD...@{u}", { cwd: projectPath });
      const [aheadStr, behindStr] = revList.trim().split("	");
      ahead = parseInt(aheadStr) || 0;
      behind = parseInt(behindStr) || 0;
    } catch (e) {
    }
    const { stdout: statusOutput } = await execAsync("git status --porcelain", { cwd: projectPath });
    const files = [];
    if (statusOutput.trim()) {
      const lines = statusOutput.trim().split("\n");
      for (const line of lines) {
        let status, filePath;
        if (line.length >= 3 && line[2] === " ") {
          status = line.substring(0, 2).trim();
          filePath = line.substring(3);
        } else if (line.length >= 2 && line[1] === " ") {
          status = line.substring(0, 1).trim();
          filePath = line.substring(2);
        } else {
          const spaceIndex = line.indexOf(" ");
          if (spaceIndex > 0) {
            status = line.substring(0, spaceIndex).trim();
            filePath = line.substring(spaceIndex + 1);
          } else {
            console.warn(`[GIT DIFF] Could not parse git status line: "${line}"`);
            continue;
          }
        }
        let fileStatus = "modified";
        if (status.includes("A") || status.includes("?")) fileStatus = "added";
        else if (status.includes("D")) fileStatus = "deleted";
        else fileStatus = "modified";
        let oldContent = "";
        let newContent = "";
        try {
          if (fileStatus !== "deleted") {
            newContent = fs.readFileSync(path.join(projectPath, filePath), "utf8");
          }
          if (fileStatus !== "added") {
            const { stdout } = await execAsync(`git show HEAD:"${filePath}"`, { cwd: projectPath }).catch(() => ({ stdout: "" }));
            oldContent = stdout;
          }
        } catch (e) {
          console.error(`Error reading file ${filePath}:`, e);
        }
        let additions = 0;
        let deletions = 0;
        if (fileStatus === "added") {
          additions = newContent.split("\n").length;
        } else if (fileStatus === "deleted") {
          deletions = oldContent.split("\n").length;
        } else {
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
    console.error("Git diff error:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("save-file", async (event, projectPath, filePath, content) => {
  try {
    const fullPath = path.join(projectPath, filePath);
    fs.writeFileSync(fullPath, content, "utf8");
    return { success: true };
  } catch (error) {
    console.error("Save file error:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revert-file", async (event, projectPath, filePath) => {
  try {
    const { stdout } = await execAsync(`git show HEAD:"${filePath}"`, { cwd: projectPath });
    const fullPath = path.join(projectPath, filePath);
    fs.writeFileSync(fullPath, stdout, "utf8");
    return { success: true };
  } catch (error) {
    console.error("Revert file error:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("git-commit", async (event, projectPath, message) => {
  try {
    await execAsync("git add .", { cwd: projectPath });
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    return { success: true };
  } catch (error) {
    console.error("Git commit error:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("git-push", async (event, projectPath) => {
  try {
    const { stdout } = await execAsync("git push", { cwd: projectPath });
    return { success: true, output: stdout };
  } catch (error) {
    console.error("Git push error:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("set-selected-project", async (event, projectId) => {
  currentlySelectedProject = projectId;
  return { success: true };
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
