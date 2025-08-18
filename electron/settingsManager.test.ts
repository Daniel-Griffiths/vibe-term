import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsManager } from './settingsManager'
import fs from 'fs'

// Mock electron and fs
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userdata')
  }
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn()
  }
}))

const mockedFs = vi.mocked(fs)

describe('SettingsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset singleton
    ;(SettingsManager as unknown as { instance: SettingsManager | undefined }).instance = undefined
  })

  describe('getInstance', () => {
    it('should create and return singleton instance', () => {
      const instance1 = SettingsManager.getInstance()
      const instance2 = SettingsManager.getInstance()
      
      expect(instance1).toBe(instance2)
      expect(instance1).toBeInstanceOf(SettingsManager)
    })
  })

  describe('Settings Management', () => {
    it('should return default settings when no file exists', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      const settings = manager.getSettings()
      
      expect(settings).toEqual({
        editor: { theme: 'vibe-term' },
        desktop: { notifications: true },
        webServer: { enabled: true, port: 6969 },
        discord: { enabled: false, username: 'Vibe Term', webhookUrl: '' }
      })
    })

    it('should load settings from file when it exists', () => {
      const mockAppState = {
        settings: {
          editor: { theme: 'dark' },
          desktop: { notifications: false }
        },
        storedItems: []
      }
      
      
      mockedFs.existsSync.mockReturnValue(true)
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockAppState))
      
      const manager = SettingsManager.getInstance()
      const settings = manager.getSettings()
      
      // Should merge with defaults
      expect(settings.editor.theme).toBe('dark')
      expect(settings.desktop.notifications).toBe(false)
      expect(settings.webServer.enabled).toBe(true) // Default value
    })

    it('should update settings and save to disk', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      
      manager.updateSettings({
        desktop: { notifications: false }
      })
      
      const settings = manager.getSettings()
      expect(settings.desktop.notifications).toBe(false)
      expect(mockedFs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe('Stored Items Management', () => {
    it('should start with empty stored items when no state file', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      const items = manager.getStoredItems()
      
      expect(items).toEqual([])
    })

    it('should add and retrieve stored items', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      const testItem = {
        id: 'test-1',
        name: 'Test Project',
        type: 'project' as const
      }
      
      manager.addStoredItem(testItem)
      const items = manager.getStoredItems()
      
      expect(items).toContain(testItem)
      expect(mockedFs.writeFileSync).toHaveBeenCalled()
    })

    it('should update stored items', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      const testItem = {
        id: 'test-1',
        name: 'Test Project',
        type: 'project' as const
      }
      
      manager.addStoredItem(testItem)
      manager.updateStoredItem('test-1', { name: 'Updated Project' })
      
      const item = manager.findStoredItem('test-1')
      expect(item?.name).toBe('Updated Project')
    })

    it('should delete stored items', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      const testItem = {
        id: 'test-1',
        name: 'Test Project',
        type: 'project' as const
      }
      
      manager.addStoredItem(testItem)
      manager.deleteStoredItem('test-1')
      
      const item = manager.findStoredItem('test-1')
      expect(item).toBeUndefined()
    })
  })

  describe('Utility Methods', () => {
    it('should check if desktop notifications are enabled', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      
      expect(manager.getSettings().desktop.notifications).toBe(true) // Default
      
      manager.updateSettings({ desktop: { notifications: false } })
      expect(manager.getSettings().desktop.notifications).toBe(false)
    })

    it('should find project by id', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      const testItem = {
        id: 'test-1',
        name: 'My Project',
        type: 'project' as const
      }
      
      manager.addStoredItem(testItem)
      
      const found = manager.findStoredItem('test-1')
      expect(found?.name).toBe('My Project')
      expect(manager.findStoredItem('nonexistent')).toBeUndefined()
    })

    it('should get complete app state', () => {
      
      mockedFs.existsSync.mockReturnValue(false)
      
      const manager = SettingsManager.getInstance()
      const testItem = {
        id: 'test-1',
        name: 'Test Project',
        type: 'project' as const
      }
      
      manager.addStoredItem(testItem)
      const state = manager.getAppState()
      
      expect(state).toHaveProperty('settings')
      expect(state).toHaveProperty('storedItems')
      expect(state.storedItems).toContain(testItem)
    })
  })
})