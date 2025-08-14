import { ipcMain, IpcMainInvokeEvent } from 'electron';

export interface IPCResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export type IPCHandler<TArgs extends any[] = any[], TReturn = any> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TReturn> | TReturn;

export class IPCService {
  private static handlers = new Map<string, IPCHandler>();
  private static isRegistered = false;

  /**
   * Register a single IPC handler with error handling
   */
  static handle<TArgs extends any[] = any[], TReturn = any>(
    channel: string,
    handler: (...args: TArgs) => Promise<TReturn> | TReturn
  ): void {
    const wrappedHandler: IPCHandler<TArgs, IPCResult<TReturn>> = async (event, ...args) => {
      try {
        console.log(`[IPC] Handling ${channel}`, args.length > 0 ? args : '');
        const result = await handler(...args);
        return { success: true, data: result };
      } catch (error) {
        console.error(`[IPC] Error in ${channel}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    this.handlers.set(channel, wrappedHandler);
    ipcMain.handle(channel, wrappedHandler);
  }

  /**
   * Register a simple success/error handler
   */
  static handleSimple<TArgs extends any[] = any[]>(
    channel: string,
    handler: (...args: TArgs) => Promise<void> | void
  ): void {
    this.handle(channel, async (...args) => {
      await handler(...args);
      return undefined; // Simple success response
    });
  }

  /**
   * Register multiple handlers at once
   */
  static registerHandlers(handlers: Record<string, (...args: any[]) => any>): void {
    Object.entries(handlers).forEach(([channel, handler]) => {
      this.handle(channel, handler);
    });
  }

  /**
   * Remove a handler
   */
  static removeHandler(channel: string): void {
    this.handlers.delete(channel);
    ipcMain.removeHandler(channel);
  }

  /**
   * Remove all handlers
   */
  static removeAllHandlers(): void {
    this.handlers.forEach((_, channel) => {
      ipcMain.removeHandler(channel);
    });
    this.handlers.clear();
  }

  /**
   * Get all registered channel names
   */
  static getRegisteredChannels(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a channel is registered
   */
  static isChannelRegistered(channel: string): boolean {
    return this.handlers.has(channel);
  }

  /**
   * Helper for creating standardized error responses
   */
  static createError(message: string, code?: string): IPCResult {
    return {
      success: false,
      error: message,
      ...(code && { code })
    };
  }

  /**
   * Helper for creating standardized success responses
   */
  static createSuccess<T>(data?: T): IPCResult<T> {
    return {
      success: true,
      ...(data !== undefined && { data })
    };
  }

  /**
   * Register handlers with automatic error boundaries and logging
   */
  static setupHandlers(handlerDefinitions: {
    [channel: string]: {
      handler: (...args: any[]) => any;
      description?: string;
      validation?: (args: any[]) => boolean;
    };
  }): void {
    Object.entries(handlerDefinitions).forEach(([channel, config]) => {
      const { handler, description, validation } = config;

      this.handle(channel, async (...args) => {
        // Optional validation
        if (validation && !validation(args)) {
          throw new Error(`Invalid arguments for ${channel}`);
        }

        // Log if description provided
        if (description) {
          console.log(`[IPC] ${description}`, args.length > 0 ? args : '');
        }

        return await handler(...args);
      });
    });
  }

  /**
   * Create a typed handler registration helper
   */
  static createTypedHandler<TArgs extends any[], TReturn>(
    channel: string,
    handler: (...args: TArgs) => Promise<TReturn> | TReturn
  ) {
    return {
      register: () => this.handle(channel, handler),
      channel,
      handler
    };
  }

  /**
   * Bulk register common CRUD operations
   */
  static registerCRUD<T>(
    resourceName: string,
    operations: {
      list?: () => Promise<T[]> | T[];
      get?: (id: string) => Promise<T | null> | T | null;
      create?: (data: Partial<T>) => Promise<T> | T;
      update?: (id: string, data: Partial<T>) => Promise<T> | T;
      delete?: (id: string) => Promise<void> | void;
    }
  ): void {
    const { list, get, create, update, delete: del } = operations;

    if (list) this.handle(`${resourceName}-list`, list);
    if (get) this.handle(`${resourceName}-get`, get);
    if (create) this.handle(`${resourceName}-create`, create);
    if (update) this.handle(`${resourceName}-update`, update);
    if (del) this.handle(`${resourceName}-delete`, del);
  }

  /**
   * Register handlers with automatic retry logic
   */
  static handleWithRetry<TArgs extends any[], TReturn>(
    channel: string,
    handler: (...args: TArgs) => Promise<TReturn> | TReturn,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): void {
    this.handle(channel, async (...args) => {
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await handler(...args);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt === maxRetries) {
            break;
          }

          console.warn(`[IPC] ${channel} attempt ${attempt} failed, retrying in ${retryDelay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      throw lastError;
    });
  }

  /**
   * Performance monitoring for handlers
   */
  static handleWithTiming<TArgs extends any[], TReturn>(
    channel: string,
    handler: (...args: TArgs) => Promise<TReturn> | TReturn
  ): void {
    this.handle(channel, async (...args) => {
      const startTime = Date.now();
      try {
        const result = await handler(...args);
        const duration = Date.now() - startTime;
        console.log(`[IPC] ${channel} completed in ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[IPC] ${channel} failed in ${duration}ms:`, error);
        throw error;
      }
    });
  }
}