import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Electron APIs
const mockElectronAPI = {
  startClaudeProcess: vi.fn(),
  stopClaudeProcess: vi.fn(),
  sendInput: vi.fn(),
  selectDirectory: vi.fn(),
  getGitDiff: vi.fn(),
  saveFile: vi.fn(),
  revertFile: vi.fn(),
  gitCommit: vi.fn(),
  gitPush: vi.fn(),
  setSelectedProject: vi.fn(),
  getLocalIp: vi.fn(),
  testDiscordNotification: vi.fn(),
  sendDiscordNotification: vi.fn(),
  getProjectFiles: vi.fn(),
  readProjectFile: vi.fn(),
  readImageFile: vi.fn(),
  testCommand: vi.fn(),
  writeStateFile: vi.fn(),
  getStoredItems: vi.fn(),
  addStoredItem: vi.fn(),
  updateStoredItem: vi.fn(),
  deleteStoredItem: vi.fn(),
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
  onTerminalOutput: vi.fn(() => vi.fn()),
  onProcessExit: vi.fn(() => vi.fn()),
  onClaudeReady: vi.fn(() => vi.fn()),
  onClaudeWorking: vi.fn(() => vi.fn()),
  onMissingDependencies: vi.fn(() => vi.fn()),
  onMainProcessReady: vi.fn(() => vi.fn()),
};

// Setup global mocks
global.window = Object.assign(global.window || {}, {
  electronAPI: mockElectronAPI,
});

// Mock node modules for browser environment
vi.mock("node:fs", () => ({
  default: {},
  promises: {},
}));

vi.mock("node:path", () => ({
  default: {
    join: vi.fn((...args) => args.join("/")),
    dirname: vi.fn((p) => p.split("/").slice(0, -1).join("/")),
    basename: vi.fn((p) => p.split("/").pop() || ""),
    resolve: vi.fn((...args) => args.join("/")),
  },
}));

vi.mock("node:os", () => ({
  default: {
    platform: vi.fn(() => "darwin"),
    networkInterfaces: vi.fn(() => ({})),
  },
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

vi.mock("@lydell/node-pty", () => ({
  spawn: vi.fn(),
}));
