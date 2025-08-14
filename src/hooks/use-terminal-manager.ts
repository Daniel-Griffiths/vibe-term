import { useEffect, useRef, useCallback } from 'react';
import { TerminalService } from '../services/TerminalService';
import type { TerminalConfig } from '../services/TerminalService';
import type { Project } from '../types';

export interface TerminalManagerHook {
  containerRef: React.RefObject<HTMLDivElement>;
  showTerminal: (projectId: string) => void;
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

  // Create terminals for all projects
  useEffect(() => {
    if (!containerRef.current) return;

    const manager = managerRef.current;
    const container = containerRef.current;

    projects.forEach((project) => {
      const existing = manager.getTerminal(project.id);
      if (!existing) {
        const instance = manager.createTerminal(project.id, container, config);
        
        // Set up data handler if provided
        if (config.interactive !== false) {
          const unsubscriber = TerminalService.setupDataHandler(
            instance.terminal,
            (data) => {
              // Call external handler if provided
              onOutput?.({ projectId: project.id, data });
            }
          );
          
          const projectUnsubscribers = unsubscribersRef.current.get(project.id) || [];
          projectUnsubscribers.push(unsubscriber);
          unsubscribersRef.current.set(project.id, projectUnsubscribers);
        }
      }
    });

    // Set up window resize handler
    const resizeUnsubscriber = TerminalService.setupResizeHandler(manager.terminals);
    
    return () => {
      resizeUnsubscriber();
    };
  }, [projects, config, onOutput]);

  // Set up external output listeners (e.g., from Electron IPC)
  useEffect(() => {
    if (!window.electronAPI?.onTerminalOutput) return;

    const unsubscribe = window.electronAPI.onTerminalOutput((output: any) => {
      const manager = managerRef.current;
      const instance = manager.getTerminal(output.projectId);
      if (instance) {
        instance.terminal.write(output.data);
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
    const manager = managerRef.current;
    manager.hideAllTerminals();
    manager.showTerminal(projectId, 50);
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
    hideAllTerminals,
    clearTerminal,
    writeToTerminal,
    setupDataHandler,
    resizeTerminals,
  };
}