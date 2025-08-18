import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorHandler } from './error-handler'

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('extractErrorMessage', () => {
    it('should extract message from Error objects', () => {
      const error = new Error('Test error message')
      const result = ErrorHandler.extractErrorMessage(error)
      expect(result).toBe('Test error message')
    })

    it('should return string errors directly', () => {
      const result = ErrorHandler.extractErrorMessage('String error')
      expect(result).toBe('String error')
    })

    it('should extract message from error objects', () => {
      const error = { message: 'Object error message' }
      const result = ErrorHandler.extractErrorMessage(error)
      expect(result).toBe('Object error message')
    })

    it('should extract error property from objects', () => {
      const error = { error: 'Error property message' }
      const result = ErrorHandler.extractErrorMessage(error)
      expect(result).toBe('Error property message')
    })

    it('should return default message for unknown error types', () => {
      const result = ErrorHandler.extractErrorMessage(null)
      expect(result).toBe('Unknown error occurred')
    })
  })

  describe('createErrorResponse', () => {
    it('should create standardized error response', () => {
      const error = new Error('Test error')
      const context = { operation: 'test-operation', projectId: 'test-project' }
      
      const result = ErrorHandler.createErrorResponse(error, context)
      
      expect(result).toEqual({
        success: false,
        error: 'Test error'
      })
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('validateRequiredParams', () => {
    it('should return null when all required params are present', () => {
      const params = { projectId: 'test', path: '/test' }
      const required = ['projectId', 'path']
      
      const result = ErrorHandler.validateRequiredParams(params, required, 'test-operation')
      
      expect(result).toBeNull()
    })

    it('should return error when required params are missing', () => {
      const params = { projectId: 'test' }
      const required = ['projectId', 'path']
      
      const result = ErrorHandler.validateRequiredParams(params, required, 'test-operation')
      
      expect(result).toEqual({
        success: false,
        error: 'Missing required parameters for test-operation: path'
      })
    })

    it('should return error when params are empty strings', () => {
      const params = { projectId: '', path: '/test' }
      const required = ['projectId', 'path']
      
      const result = ErrorHandler.validateRequiredParams(params, required, 'test-operation')
      
      expect(result).toEqual({
        success: false,
        error: 'Missing required parameters for test-operation: projectId'
      })
    })
  })

  describe('wrapAsync', () => {
    it('should return result when operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true, data: 'test' })
      const context = { operation: 'test-operation' }
      
      const result = await ErrorHandler.wrapAsync(operation, context)
      
      expect(result).toEqual({ success: true, data: 'test' })
      expect(operation).toHaveBeenCalledOnce()
    })

    it('should return error response when operation fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      const context = { operation: 'test-operation' }
      
      const result = await ErrorHandler.wrapAsync(operation, context)
      
      expect(result).toEqual({
        success: false,
        error: 'Operation failed'
      })
    })
  })

  describe('isErrorResponse', () => {
    it('should identify error responses correctly', () => {
      const errorResponse = { success: false, error: 'Test error' }
      const successResponse = { success: true, data: 'test' }
      
      expect(ErrorHandler.isErrorResponse(errorResponse)).toBe(true)
      expect(ErrorHandler.isErrorResponse(successResponse)).toBe(false)
      expect(ErrorHandler.isErrorResponse(null)).toBe(false)
      expect(ErrorHandler.isErrorResponse('string')).toBe(false)
    })
  })

  describe('handleFileSystemError', () => {
    it('should handle ENOENT errors', () => {
      const error = new Error('ENOENT: no such file or directory')
      const result = ErrorHandler.handleFileSystemError(error, '/test/file.txt')
      
      expect(result).toEqual({
        success: false,
        error: 'File not found: /test/file.txt'
      })
    })

    it('should handle EACCES errors', () => {
      const error = new Error('EACCES: permission denied')
      const result = ErrorHandler.handleFileSystemError(error, '/test/file.txt')
      
      expect(result).toEqual({
        success: false,
        error: 'Permission denied: /test/file.txt'
      })
    })

    it('should handle EISDIR errors', () => {
      const error = new Error('EISDIR: illegal operation on a directory')
      const result = ErrorHandler.handleFileSystemError(error, '/test/directory')
      
      expect(result).toEqual({
        success: false,
        error: 'Expected file but found directory: /test/directory'
      })
    })

    it('should handle generic file system errors', () => {
      const error = new Error('Some other file system error')
      const result = ErrorHandler.handleFileSystemError(error, '/test/file.txt')
      
      expect(result).toEqual({
        success: false,
        error: 'File system error: Some other file system error'
      })
    })
  })

  describe('handleGitError', () => {
    it('should handle "not a git repository" errors', () => {
      const error = new Error('fatal: not a git repository')
      const result = ErrorHandler.handleGitError(error, 'status')
      
      expect(result).toEqual({
        success: false,
        error: 'Directory is not a Git repository'
      })
    })

    it('should handle "nothing to commit" errors', () => {
      const error = new Error('nothing to commit, working tree clean')
      const result = ErrorHandler.handleGitError(error, 'commit')
      
      expect(result).toEqual({
        success: false,
        error: 'No changes to commit'
      })
    })

    it('should handle generic git errors', () => {
      const error = new Error('Some git error')
      const result = ErrorHandler.handleGitError(error, 'push')
      
      expect(result).toEqual({
        success: false,
        error: 'Git push failed: Some git error'
      })
    })
  })
})