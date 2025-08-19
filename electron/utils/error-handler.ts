/**
 * Centralized error handling utilities for Vibe Term
 * Provides consistent error formatting, logging, and response patterns
 */

import type { BaseResponse } from "../../src/types/ipc";

export interface ErrorContext {
  operation: string;
  projectId?: string;
  filePath?: string;
  additionalData?: Record<string, unknown>;
}

export class ErrorHandler {
  /**
   * Create a standardized error response
   */
  static createErrorResponse(
    error: unknown,
    context: ErrorContext
  ): BaseResponse {
    const errorMessage = this.extractErrorMessage(error);

    // Log the error with context
    this.logError(error, context);

    return {
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Extract a user-friendly error message from various error types
   */
  static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    if (typeof error === "object" && error !== null) {
      const errorObj = error as Record<string, unknown>;
      if (typeof errorObj.message === "string") {
        return errorObj.message;
      }
      if (typeof errorObj.error === "string") {
        return errorObj.error;
      }
    }

    return "Unknown error occurred";
  }

  /**
   * Log errors with consistent formatting and context
   */
  static logError(error: unknown, context: ErrorContext): void {
    const timestamp = new Date().toISOString();
    const errorMessage = this.extractErrorMessage(error);

    console.error(`[${timestamp}] Error in ${context.operation}:`, {
      error: errorMessage,
      projectId: context.projectId,
      filePath: context.filePath,
      additionalData: context.additionalData,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  /**
   * Wrap async operations with standardized error handling
   */
  static async wrapAsync<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T | BaseResponse> {
    try {
      return await operation();
    } catch (error) {
      return this.createErrorResponse(error, context);
    }
  }

  /**
   * Check if a value is an error response
   */
  static isErrorResponse(value: unknown): value is BaseResponse {
    return (
      typeof value === "object" &&
      value !== null &&
      "success" in value &&
      (value as BaseResponse).success === false
    );
  }

  /**
   * Validate required parameters and return error if missing
   */
  static validateRequiredParams(
    params: Record<string, unknown>,
    required: string[],
    operation: string
  ): BaseResponse | null {
    const missing = required.filter((key) => {
      const value = params[key];
      return value === undefined || value === null || value === "";
    });

    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required parameters for ${operation}: ${missing.join(
          ", "
        )}`,
      };
    }

    return null;
  }

  /**
   * Handle file system errors with appropriate messages
   */
  static handleFileSystemError(error: unknown, filePath: string): BaseResponse {
    const errorMessage = this.extractErrorMessage(error);

    // Provide more specific error messages for common file system errors
    if (errorMessage.includes("ENOENT")) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    if (errorMessage.includes("EACCES")) {
      return {
        success: false,
        error: `Permission denied: ${filePath}`,
      };
    }

    if (errorMessage.includes("EISDIR")) {
      return {
        success: false,
        error: `Expected file but found directory: ${filePath}`,
      };
    }

    return {
      success: false,
      error: `File system error: ${errorMessage}`,
    };
  }

  /**
   * Handle Git operation errors with appropriate messages
   */
  static handleGitError(error: unknown, operation: string): BaseResponse {
    const errorMessage = this.extractErrorMessage(error);

    // Provide more specific error messages for common Git errors
    if (errorMessage.includes("not a git repository")) {
      return {
        success: false,
        error: "Directory is not a Git repository",
      };
    }

    if (errorMessage.includes("nothing to commit")) {
      return {
        success: false,
        error: "No changes to commit",
      };
    }

    if (errorMessage.includes("working tree clean")) {
      return {
        success: false,
        error: "Working tree is clean, no changes to process",
      };
    }

    return {
      success: false,
      error: `Git ${operation} failed: ${errorMessage}`,
    };
  }
}
