"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  startClaudeProcess: (projectId, projectPath, command, projectName) => electron.ipcRenderer.invoke("start-claude-process", projectId, projectPath, command, projectName),
  stopClaudeProcess: (projectId) => electron.ipcRenderer.invoke("stop-claude-process", projectId),
  sendInput: (projectId, input) => electron.ipcRenderer.invoke("send-input", projectId, input),
  selectDirectory: () => electron.ipcRenderer.invoke("select-directory"),
  loadProjects: () => electron.ipcRenderer.invoke("load-projects"),
  saveProjects: (projects) => electron.ipcRenderer.invoke("save-projects", projects),
  onTerminalOutput: (callback) => {
    electron.ipcRenderer.on("terminal-output", (event, data) => callback(data));
    return () => electron.ipcRenderer.removeAllListeners("terminal-output");
  },
  onProcessExit: (callback) => {
    electron.ipcRenderer.on("process-exit", (event, data) => callback(data));
    return () => electron.ipcRenderer.removeAllListeners("process-exit");
  },
  onClaudeReady: (callback) => {
    electron.ipcRenderer.on("claude-ready", (event, data) => callback(data));
    return () => electron.ipcRenderer.removeAllListeners("claude-ready");
  },
  onClaudeWorking: (callback) => {
    electron.ipcRenderer.on("claude-working", (event, data) => callback(data));
    return () => electron.ipcRenderer.removeAllListeners("claude-working");
  },
  getGitDiff: (projectPath) => electron.ipcRenderer.invoke("get-git-diff", projectPath),
  saveFile: (projectPath, filePath, content) => electron.ipcRenderer.invoke("save-file", projectPath, filePath, content),
  revertFile: (projectPath, filePath) => electron.ipcRenderer.invoke("revert-file", projectPath, filePath),
  gitCommit: (projectPath, message) => electron.ipcRenderer.invoke("git-commit", projectPath, message),
  gitPush: (projectPath) => electron.ipcRenderer.invoke("git-push", projectPath),
  setSelectedProject: (projectId) => electron.ipcRenderer.invoke("set-selected-project", projectId)
});
