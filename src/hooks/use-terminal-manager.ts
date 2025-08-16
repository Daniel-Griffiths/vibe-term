import { useEffect, useRef, useCallback } from 'react';
import { TerminalService } from '../services/TerminalService';
import type { TerminalConfig } from '../services/TerminalService';
import type { Project } from '../types';

export interface TerminalManagerHook {
  containerRef: React.RefObject<HTMLDivElement>;
  showTerminal: (projectId: string) => void;
  focusTerminal: (projectId: string) => void;
  hideAllTerminals: () => void;
  clearTerminal: (projectId: string) => void;
  writeToTerminal: (projectId: string, data: string) => void;
  setupDataHandler: (projectId: string, onData: (data: string) => void) => void;
  resizeTerminals: () => void;
}

export function useTerminalManager(
  projects: Project[],
  config: TerminalConfig = {},
  onOutput?: (output: { projectId: string; data: string }) => void
): TerminalManagerHook {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef(TerminalService.createTerminalManager());
  const unsubscribersRef = useRef<Map<string, (() => void)[]>>(new Map());
  const pendingOutputRef = useRef<Map<string, string[]>>(new Map());

  // Lazy creation: only create terminals when they're actually shown
  const createTerminalIfNeeded = useCallback((projectId: string) => {
    if (!containerRef.current) return null;

    const manager = managerRef.current;
    const existing = manager.getTerminal(projectId);
    
    if (!existing) {
      console.log(`[Terminal Debug] Creating terminal for project ${projectId}`);
      const instance = manager.createTerminal(projectId, containerRef.current, config);
      
      // Set up data handler if provided
      if (config.interactive !== false) {
        const unsubscriber = TerminalService.setupDataHandler(
          instance.terminal,
          (data) => {
            // Call external handler if provided
            onOutput?.({ projectId, data });
          }
        );
        
        const projectUnsubscribers = unsubscribersRef.current.get(projectId) || [];
        projectUnsubscribers.push(unsubscriber);
        unsubscribersRef.current.set(projectId, projectUnsubscribers);
      }
      
      // Replay any pending output that arrived before terminal was created
      const pendingOutput = pendingOutputRef.current.get(projectId);
      if (pendingOutput && pendingOutput.length > 0) {
        console.log(`[Terminal Debug] Replaying ${pendingOutput.length} pending outputs for ${projectId}`);
        pendingOutput.forEach(data => {
          instance.terminal.write(data);
        });
        pendingOutputRef.current.delete(projectId);
      }
      
      return instance;
    }
    
    return existing;
  }, [config, onOutput]);

  // Set up window resize handler for all terminals
  useEffect(() => {
    const manager = managerRef.current;
    const resizeUnsubscriber = TerminalService.setupResizeHandler(manager.terminals);
    
    return () => {
      resizeUnsubscriber();
    };
  }, []);

  // Set up external output listeners (e.g., from Electron IPC)
  useEffect(() => {
    if (!window.electronAPI?.onTerminalOutput) return;

    const unsubscribe = window.electronAPI.onTerminalOutput((output: any) => {
      console.log(`[Terminal Debug] Received output for project ${output.projectId}:`, {
        dataLength: output.data?.length,
        dataPreview: output.data?.substring(0, 100),
        timestamp: new Date().toISOString()
      });
      
      const manager = managerRef.current;
      const instance = manager.getTerminal(output.projectId);
      if (instance) {
        console.log(`[Terminal Debug] Writing to terminal:`, {
          projectId: output.projectId,
          terminalExists: !!instance.terminal,
          elementVisible: instance.element.style.display !== 'none',
          bufferLength: instance.terminal.buffer.active.length
        });
        instance.terminal.write(output.data);
      } else {
        // Store output for when terminal is created
        console.log(`[Terminal Debug] Storing output for future terminal ${output.projectId}`);
        const pending = pendingOutputRef.current.get(output.projectId) || [];
        pending.push(output.data);
        pendingOutputRef.current.set(output.projectId, pending);
      }
    });

    return unsubscribe;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all data handlers
      unsubscribersRef.current.forEach((unsubscribers) => {
        unsubscribers.forEach((unsub) => unsub());
      });
      unsubscribersRef.current.clear();
      
      // Clean up terminal manager
      managerRef.current.cleanup();
    };
  }, []);

  const showTerminal = useCallback((projectId: string) => {
    // Create terminal if it doesn't exist
    const instance = createTerminalIfNeeded(projectId);
    if (!instance) {
      console.warn(`[Terminal Debug] Could not create terminal for project ${projectId}`);
      return;
    }
    
    const manager = managerRef.current;
    manager.hideAllTerminals();
    manager.showTerminal(projectId, 50);
  }, [createTerminalIfNeeded]);

  const focusTerminal = useCallback((projectId: string) => {
    managerRef.current.focusTerminal(projectId);
  }, []);

  const hideAllTerminals = useCallback(() => {
    managerRef.current.hideAllTerminals();
  }, []);

  const clearTerminal = useCallback((projectId: string) => {
    managerRef.current.clearTerminal(projectId);
  }, []);

  const writeToTerminal = useCallback((projectId: string, data: string) => {
    const manager = managerRef.current;
    const instance = manager.getTerminal(projectId);
    if (instance) {
      instance.terminal.write(data);
    }
  }, []);

  const setupDataHandler = useCallback((projectId: string, onData: (data: string) => void) => {
    const manager = managerRef.current;
    const instance = manager.getTerminal(projectId);
    if (instance) {
      const unsubscriber = TerminalService.setupDataHandler(instance.terminal, onData);
      
      const projectUnsubscribers = unsubscribersRef.current.get(projectId) || [];
      projectUnsubscribers.push(unsubscriber);
      unsubscribersRef.current.set(projectId, projectUnsubscribers);
    }
  }, []);

  const resizeTerminals = useCallback(() => {
    managerRef.current.resizeAll();
  }, []);

  return {
    containerRef,
    showTerminal,
    focusTerminal,
    hideAllTerminals,
    clearTerminal,
    writeToTerminal,
    setupDataHandler,
    resizeTerminals,
  };
}