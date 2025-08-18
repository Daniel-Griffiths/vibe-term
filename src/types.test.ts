import { describe, it, expect } from 'vitest'
import { ItemType } from './types'
import type { UnifiedItem, TerminalOutput, ProcessExit } from './types'

describe('Current Type Definitions', () => {
  describe('UnifiedItem', () => {
    it('should have correct structure for project items', () => {
      const projectItem: UnifiedItem = {
        id: 'test-project',
        type: 'project' as ItemType,
        name: 'Test Project',
        path: '/test/path',
        runCommand: 'npm start',
        yoloMode: true,
        restrictedBranches: 'main,develop',
        status: 'idle',
        lastActivity: '10:30:45',
        output: ['line 1', 'line 2']
      }

      expect(projectItem.id).toBe('test-project')
      expect(projectItem.type).toBe('project')
      expect(projectItem.name).toBe('Test Project')
      expect(projectItem.path).toBe('/test/path')
      expect(projectItem.runCommand).toBe('npm start')
      expect(projectItem.yoloMode).toBe(true)
      expect(projectItem.restrictedBranches).toBe('main,develop')
      expect(projectItem.status).toBe('idle')
      expect(projectItem.lastActivity).toBe('10:30:45')
      expect(Array.isArray(projectItem.output)).toBe(true)
    })

    it('should have correct structure for panel items', () => {
      const panelItem: UnifiedItem = {
        id: 'test-panel',
        type: 'panel' as ItemType,
        name: 'Test Panel',
        url: 'https://example.com',
        icon: 'globe'
      }

      expect(panelItem.id).toBe('test-panel')
      expect(panelItem.type).toBe('panel')
      expect(panelItem.name).toBe('Test Panel')
      expect(panelItem.url).toBe('https://example.com')
      expect(panelItem.icon).toBe('globe')
    })

    it('should support all status values', () => {
      const statuses: Array<UnifiedItem['status']> = [
        'idle', 'running', 'ready', 'working', 'completed', 'error', undefined
      ]

      statuses.forEach(status => {
        const item: UnifiedItem = {
          id: 'test',
          type: 'project' as ItemType,
          name: 'Test',
          status
        }
        expect(item.status).toBe(status)
      })
    })
  })

  describe('TerminalOutput', () => {
    it('should have correct structure', () => {
      const output: TerminalOutput = {
        projectId: 'test-project',
        data: 'console output',
        type: 'stdout'
      }

      expect(output.projectId).toBe('test-project')
      expect(output.data).toBe('console output')
      expect(output.type).toBe('stdout')
    })

    it('should support both stdout and stderr types', () => {
      const stdoutOutput: TerminalOutput = {
        projectId: 'test',
        data: 'output',
        type: 'stdout'
      }

      const stderrOutput: TerminalOutput = {
        projectId: 'test',
        data: 'error',
        type: 'stderr'
      }

      expect(stdoutOutput.type).toBe('stdout')
      expect(stderrOutput.type).toBe('stderr')
    })
  })

  describe('ProcessExit', () => {
    it('should have correct structure', () => {
      const processExit: ProcessExit = {
        projectId: 'test-project',
        code: 0
      }

      expect(processExit.projectId).toBe('test-project')
      expect(processExit.code).toBe(0)
    })

    it('should support null exit codes', () => {
      const processExit: ProcessExit = {
        projectId: 'test-project',
        code: null
      }

      expect(processExit.projectId).toBe('test-project')
      expect(processExit.code).toBe(null)
    })
  })

  describe('ItemType enum', () => {
    it('should have correct values', () => {
      expect(ItemType.PROJECT).toBe('project')
      expect(ItemType.PANEL).toBe('panel')
    })
  })
})