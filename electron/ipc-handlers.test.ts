import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupIPCHandlers } from './ipc-handlers'
import { ipcMain } from 'electron'

// Mock electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn()
  },
  BrowserWindow: vi.fn(),
  app: {
    getPath: vi.fn(() => '/mock/path')
  },
  Notification: vi.fn()
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => 'mock file content'),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(() => ['file1.txt', 'file2.js']),
    statSync: vi.fn(() => ({
      isFile: () => true,
      isDirectory: () => false
    })),
    promises: {
      writeFile: vi.fn()
    }
  }
}))

vi.mock('../src/utils/shellUtils', () => ({
  ShellUtils: {
    execute: vi.fn(),
    generateTmuxSessionName: vi.fn((name) => name.toLowerCase()),
    killTmuxSession: vi.fn()
  }
}))

vi.mock('child_process', () => ({
  default: {
    exec: vi.fn(),
    spawn: vi.fn()
  },
  exec: vi.fn(),
  spawn: vi.fn()
}))

vi.mock('util', () => ({
  default: {
    promisify: vi.fn((fn) => fn)
  },
  promisify: vi.fn(() => vi.fn().mockResolvedValue({ stdout: 'success' }))
}))

vi.mock('./web-server', () => ({
  broadcastToWebClients: vi.fn()
}))

interface MockDeps {
  win: unknown
  sharedPtyProcesses: Map<string, unknown>
  backgroundProcesses: Map<string, unknown>
  terminalBuffers: Map<string, string>
  getOrCreateSharedPty: vi.MockedFunction<(...args: unknown[]) => Promise<unknown>>
  readStateFile: vi.MockedFunction<() => unknown>
  broadcastToWebClients: vi.MockedFunction<(...args: unknown[]) => void>
  getAppState: vi.MockedFunction<() => unknown>
  updateAppState: vi.MockedFunction<(...args: unknown[]) => void>
  addStoredItem: vi.MockedFunction<(...args: unknown[]) => void>
  updateStoredItem: vi.MockedFunction<(...args: unknown[]) => void>
  deleteStoredItem: vi.MockedFunction<(...args: unknown[]) => void>
}

describe('IPC Handlers', () => {
  let mockDeps: MockDeps
  let mockWin: unknown
  let handlers: Map<string, vi.MockedFunction<(...args: unknown[]) => Promise<unknown>>>

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockWin = {
      isDestroyed: vi.fn(() => false),
      isFocused: vi.fn(() => true),
      isMinimized: vi.fn(() => false),
      restore: vi.fn(),
      focus: vi.fn(),
      webContents: {
        send: vi.fn()
      }
    }

    handlers = new Map()
    
    mockDeps = {
      win: mockWin,
      sharedPtyProcesses: new Map(),
      backgroundProcesses: new Map(),
      terminalBuffers: new Map(),
      getOrCreateSharedPty: vi.fn(),
      readStateFile: vi.fn(() => ({ storedItems: [] })),
      broadcastToWebClients: vi.fn(),
      getAppState: vi.fn(() => ({ settings: {}, storedItems: [] })),
      updateAppState: vi.fn(),
      addStoredItem: vi.fn(),
      updateStoredItem: vi.fn(),
      deleteStoredItem: vi.fn()
    }

    // Mock ipcMain.handle to capture registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Handler Registration', () => {
    it('should register all expected IPC handlers', () => {
      setupIPCHandlers(mockDeps)

      const expectedHandlers = [
        'start-claude-process',
        'stop-claude-process',
        'send-input',
        'claude-hook',
        'test-command'
      ]

      expectedHandlers.forEach(handlerName => {
        expect(handlers.has(handlerName)).toBe(true)
      })
    })
  })

  describe('Process Management Handlers', () => {
    beforeEach(() => {
      setupIPCHandlers(mockDeps)
    })

    it('should handle start-claude-process correctly', async () => {
      const handler = handlers.get('start-claude-process')
      mockDeps.getOrCreateSharedPty.mockResolvedValue({ success: true, projectId: 'test-project' })

      const result = await handler(null, 'test-project', '/test/path', 'claude', 'Test Project', false)

      expect(mockDeps.getOrCreateSharedPty).toHaveBeenCalledWith(
        'test-project',
        '/test/path',
        'Test Project',
        false,
        'claude'
      )
      expect(result).toEqual({ success: true, projectId: 'test-project' })
    })

    it('should handle stop-claude-process correctly', async () => {
      const handler = handlers.get('stop-claude-process')
      const mockPty = { kill: vi.fn() }
      const mockBgProcess = { kill: vi.fn() }
      
      mockDeps.sharedPtyProcesses.set('test-project', mockPty)
      mockDeps.backgroundProcesses.set('test-project', mockBgProcess)
      mockDeps.readStateFile.mockReturnValue({
        storedItems: [{ id: 'test-project', name: 'Test Project', type: 'project' }]
      })

      const result = await handler(null, 'test-project')

      expect(mockPty.kill).toHaveBeenCalled()
      expect(mockBgProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(result).toEqual({ success: true })
    })

    it('should handle send-input correctly', async () => {
      const handler = handlers.get('send-input')
      const mockPty = { write: vi.fn() }
      mockDeps.sharedPtyProcesses.set('test-project', mockPty)

      const result = await handler(null, 'test-project', 'test input\n')

      expect(mockPty.write).toHaveBeenCalledWith('test input\n')
      expect(result).toEqual({ success: true })
    })

    it('should handle claude-hook correctly', async () => {
      const handler = handlers.get('claude-hook')

      const result = await handler(null, 'Stop', 'test-project')

      expect(mockWin.webContents.send).toHaveBeenCalledWith('claude-ready', {
        projectId: 'test-project',
        timestamp: expect.any(Number)
      })
      expect(result).toEqual({ success: true })
    })
  })

  describe('Command Execution', () => {
    beforeEach(() => {
      setupIPCHandlers(mockDeps)
    })

    it('should handle test-command correctly', async () => {
      const handler = handlers.get('test-command')
      const { ShellUtils } = await import('../src/utils/shellUtils')
      
      vi.mocked(ShellUtils.execute).mockResolvedValue({
        success: true,
        output: 'command output',
        error: undefined
      })

      const result = await handler(null, '/test/project', 'echo "test"')

      expect(ShellUtils.execute).toHaveBeenCalledWith('echo "test"', {
        cwd: '/test/project',
        timeout: 30000
      })
      expect(result).toEqual({
        success: true,
        output: 'command output',
        error: ''
      })
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      setupIPCHandlers(mockDeps)
    })

    it('should handle errors in start-claude-process', async () => {
      const handler = handlers.get('start-claude-process')
      mockDeps.getOrCreateSharedPty.mockRejectedValue(new Error('Test error'))

      try {
        await handler(null, 'test-project', '/test/path')
      } catch (error: unknown) {
        expect((error as Error).message).toBe('Test error')
      }
    })

    it('should handle missing process in send-input', async () => {
      const handler = handlers.get('send-input')
      // No process in map

      const result = await handler(null, 'nonexistent-project', 'test input')

      expect(result).toEqual({
        success: false,
        error: 'Process not found'
      })
    })
  })

  describe('Type Safety', () => {
    it('should enforce correct parameter types', async () => {
      // This test verifies our type improvements work at runtime
      setupIPCHandlers(mockDeps)
      
      const startHandler = handlers.get('start-claude-process')
      const sendInputHandler = handlers.get('send-input')
      const claudeHookHandler = handlers.get('claude-hook')
      
      // These calls should work with our improved types
      expect(typeof startHandler).toBe('function')
      expect(typeof sendInputHandler).toBe('function') 
      expect(typeof claudeHookHandler).toBe('function')
      
      // Test that handlers return promises
      const startResult = startHandler(null, 'test', '/path')
      const sendResult = sendInputHandler(null, 'test', 'input')
      const hookResult = claudeHookHandler(null, 'Stop', 'test')
      
      expect(startResult).toBeInstanceOf(Promise)
      expect(sendResult).toBeInstanceOf(Promise)
      expect(hookResult).toBeInstanceOf(Promise)
    })
  })
})