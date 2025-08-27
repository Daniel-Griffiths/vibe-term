/**
 * Type definitions for IPC handlers
 * This file is imported by both electron and frontend for type safety
 */

import type { UnifiedItem } from "../client/types";

// Base response types
export interface BaseResponse {
  success: boolean;
  error?: string;
}

export interface DataResponse<T> extends BaseResponse {
  data: T;
}

// Specific response types
export interface PTYResult extends BaseResponse {
  projectId?: string;
}

export interface CommandResult extends BaseResponse {
  output?: string;
}

export interface ImageResult extends BaseResponse {
  data?: string;
  mimeType?: string;
}

export interface GitFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
}

export interface GitDiffResult {
  files: GitFile[];
  branch: string;
  ahead: number;
  behind: number;
}

export interface FileTreeItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeItem[];
  isExpanded?: boolean;
}

export interface LocalIpResult {
  localIp: string;
  hasTailscale: boolean;
}

export interface AppSettings {
  editor: {
    theme: string;
  };
  desktop: {
    notifications: boolean;
  };
  webServer: {
    enabled: boolean;
  };
  ai?: {
    defaultProvider?: string;
    providerAvailability?: Record<string, boolean>;
  };
}

export interface AppState {
  settings?: AppSettings;
  storedItems?: UnifiedItem[];
}

// Define the IPC handler signatures
export interface IPCHandlerMap {
  "start-claude-process": (
    projectId: string,
    projectPath: string,
    command?: string,
    projectName?: string,
    yoloMode?: boolean
  ) => Promise<PTYResult>;
  "stop-claude-process": (projectId: string) => Promise<BaseResponse>;
  "send-input": (projectId: string, input: string) => Promise<BaseResponse>;
  "test-command": (
    projectPath: string,
    command: string
  ) => Promise<CommandResult>;
  "write-state-file": (state: AppState) => Promise<BaseResponse>;
  "select-directory": () => Promise<DataResponse<{ path: string }>>;
  "get-git-diff": (projectPath: string) => Promise<DataResponse<GitDiffResult>>;
  "save-file": (
    projectPath: string,
    filePath: string,
    content: string
  ) => Promise<BaseResponse>;
  "revert-file": (
    projectPath: string,
    filePath: string
  ) => Promise<BaseResponse>;
  "get-project-files": (
    projectPath: string
  ) => Promise<DataResponse<FileTreeItem[]>>;
  "read-project-file": (
    projectPath: string,
    filePath: string
  ) => Promise<DataResponse<string>>;
  "read-image-file": (
    projectPath: string,
    filePath: string
  ) => Promise<ImageResult>;
  "git-commit": (projectPath: string, message: string) => Promise<BaseResponse>;
  "git-push": (projectPath: string) => Promise<CommandResult>;
  "set-selected-project": (projectId: string | null) => Promise<BaseResponse>;
  "get-local-ip": () => Promise<DataResponse<LocalIpResult>>;
  "get-stored-items": () => Promise<DataResponse<UnifiedItem[]>>;
  "add-stored-item": (item: UnifiedItem) => Promise<BaseResponse>;
  "update-stored-item": (
    id: string,
    updates: Partial<UnifiedItem>
  ) => Promise<BaseResponse>;
  "delete-stored-item": (id: string) => Promise<BaseResponse>;
  "get-app-settings": () => Promise<DataResponse<AppSettings>>;
  "update-app-settings": (
    settings: Partial<AppSettings>
  ) => Promise<BaseResponse>;
  "claude-hook": (hookType: string, projectId: string) => Promise<BaseResponse>;
}

// Type helper to extract return type of a handler
export type HandlerReturnType<K extends keyof IPCHandlerMap> = ReturnType<
  IPCHandlerMap[K]
>;

// Type helper to extract parameters of a handler
export type HandlerParams<K extends keyof IPCHandlerMap> = Parameters<
  IPCHandlerMap[K]
>;
