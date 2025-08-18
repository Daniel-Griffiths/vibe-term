// IPC Handler Types
// This file defines strict types for all IPC handlers to replace 'any' types

import type { UnifiedItem } from '../types'

// Base response interfaces
export interface BaseResponse {
  success: boolean
  error?: string
}

export interface DataResponse<T> extends BaseResponse {
  data: T
}

// Process management types
export interface PTYResult extends BaseResponse {
  projectId?: string
}

export interface CommandResult extends BaseResponse {
  output?: string
}

// Git operation types
export interface GitFile {
  path: string
  status: 'added' | 'modified' | 'deleted'
  additions: number
  deletions: number
  oldContent: string
  newContent: string
}

export interface GitDiffResult {
  files: GitFile[]
  branch: string
  ahead: number
  behind: number
}

// File system types
export interface FileTreeItem {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeItem[]
  isExpanded?: boolean
}

export interface ImageResult extends BaseResponse {
  data?: string
  mimeType?: string
}

// Network types
export interface LocalIpResult {
  localIp: string
  hasTailscale: boolean
}

// Settings types
export interface AppSettings {
  editor: {
    theme: string
  }
  desktop: {
    notifications: boolean
  }
  webServer: {
    enabled: boolean
    port: number
  }
  discord: {
    enabled: boolean
    username: string
    webhookUrl: string
  }
}

export interface DiscordSettings {
  webhookUrl?: string
  username?: string
  enabled?: boolean
}

// IPC Handler parameter types
export interface StartClaudeProcessParams {
  projectId: string
  projectPath: string
  command?: string
  projectName?: string
  yoloMode?: boolean
}

export interface ClaudeHookParams {
  hookType: string
  projectId: string
}

export interface StopClaudeProcessParams {
  projectId: string
}

export interface SendInputParams {
  projectId: string
  input: string
}

export interface TestCommandParams {
  projectPath: string
  command: string
}

export interface WriteStateFileParams {
  state: {
    settings?: AppSettings
    storedItems?: UnifiedItem[]
  }
}

export interface GitDiffParams {
  projectPath: string
}

export interface SaveFileParams {
  projectPath: string
  filePath: string
  content: string
}

export interface RevertFileParams {
  projectPath: string
  filePath: string
}

export interface GetProjectFilesParams {
  projectPath: string
}

export interface ReadProjectFileParams {
  projectPath: string
  filePath: string
}

export interface ReadImageFileParams {
  projectPath: string
  filePath: string
}

export interface GitCommitParams {
  projectPath: string
  message: string
}

export interface GitPushParams {
  projectPath: string
}

export interface TestDiscordNotificationParams {
  discordSettings: DiscordSettings
}

export interface SendDiscordNotificationParams {
  discordSettings: DiscordSettings
  message: string
}

export interface AddStoredItemParams {
  item: UnifiedItem
}

export interface UpdateStoredItemParams {
  id: string
  updates: Partial<UnifiedItem>
}

export interface DeleteStoredItemParams {
  id: string
}

export interface UpdateAppSettingsParams {
  settings: Partial<AppSettings>
}

// IPC Handler type definitions
export type IPCHandler<TParams = void, TResult = BaseResponse> = 
  TParams extends void 
    ? () => Promise<TResult>
    : (params: TParams) => Promise<TResult>

// Specific handler types
export type StartClaudeProcessHandler = IPCHandler<StartClaudeProcessParams, PTYResult>
export type ClaudeHookHandler = IPCHandler<ClaudeHookParams, BaseResponse>
export type StopClaudeProcessHandler = IPCHandler<StopClaudeProcessParams, BaseResponse>
export type SendInputHandler = IPCHandler<SendInputParams, BaseResponse>
export type TestCommandHandler = IPCHandler<TestCommandParams, CommandResult>
export type WriteStateFileHandler = IPCHandler<WriteStateFileParams, BaseResponse>
export type SelectDirectoryHandler = IPCHandler<void, DataResponse<{ path: string }>>
export type GetGitDiffHandler = IPCHandler<GitDiffParams, DataResponse<GitDiffResult>>
export type SaveFileHandler = IPCHandler<SaveFileParams, BaseResponse>
export type RevertFileHandler = IPCHandler<RevertFileParams, BaseResponse>
export type GetProjectFilesHandler = IPCHandler<GetProjectFilesParams, DataResponse<FileTreeItem[]>>
export type ReadProjectFileHandler = IPCHandler<ReadProjectFileParams, DataResponse<string>>
export type ReadImageFileHandler = IPCHandler<ReadImageFileParams, ImageResult>
export type GitCommitHandler = IPCHandler<GitCommitParams, BaseResponse>
export type GitPushHandler = IPCHandler<GitPushParams, CommandResult>
export type SetSelectedProjectHandler = IPCHandler<{ projectId: string | null }, BaseResponse>
export type GetLocalIpHandler = IPCHandler<void, DataResponse<LocalIpResult>>
export type TestDiscordNotificationHandler = IPCHandler<TestDiscordNotificationParams, BaseResponse>
export type SendDiscordNotificationHandler = IPCHandler<SendDiscordNotificationParams, BaseResponse>
export type GetStoredItemsHandler = IPCHandler<void, DataResponse<UnifiedItem[]>>
export type AddStoredItemHandler = IPCHandler<AddStoredItemParams, BaseResponse>
export type UpdateStoredItemHandler = IPCHandler<UpdateStoredItemParams, BaseResponse>
export type DeleteStoredItemHandler = IPCHandler<DeleteStoredItemParams, BaseResponse>
export type GetAppSettingsHandler = IPCHandler<void, DataResponse<AppSettings>>
export type UpdateAppSettingsHandler = IPCHandler<UpdateAppSettingsParams, BaseResponse>

// Registry of all handler types
export interface IPCHandlerRegistry {
  'start-claude-process': StartClaudeProcessHandler
  'claude-hook': ClaudeHookHandler
  'stop-claude-process': StopClaudeProcessHandler
  'send-input': SendInputHandler
  'test-command': TestCommandHandler
  'write-state-file': WriteStateFileHandler
  'select-directory': SelectDirectoryHandler
  'get-git-diff': GetGitDiffHandler
  'save-file': SaveFileHandler
  'revert-file': RevertFileHandler
  'get-project-files': GetProjectFilesHandler
  'read-project-file': ReadProjectFileHandler
  'read-image-file': ReadImageFileHandler
  'git-commit': GitCommitHandler
  'git-push': GitPushHandler
  'set-selected-project': SetSelectedProjectHandler
  'get-local-ip': GetLocalIpHandler
  'test-discord-notification': TestDiscordNotificationHandler
  'send-discord-notification': SendDiscordNotificationHandler
  'get-stored-items': GetStoredItemsHandler
  'add-stored-item': AddStoredItemHandler
  'update-stored-item': UpdateStoredItemHandler
  'delete-stored-item': DeleteStoredItemHandler
  'get-app-settings': GetAppSettingsHandler
  'update-app-settings': UpdateAppSettingsHandler
}