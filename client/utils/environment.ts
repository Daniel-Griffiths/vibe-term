/**
 * Environment detection utility
 * Centralized place to determine if we're running in Electron or web browser
 */

// Check if we're running in Electron environment
export const isElectron = typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;

// Check if we're running in web browser environment
export const isWeb = !isElectron;

// User agent (if needed)
export const userAgent = typeof window !== 'undefined'
  ? window.navigator?.userAgent || 'unknown'
  : 'server';