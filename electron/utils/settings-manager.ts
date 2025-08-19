/**
 * Simplified settings management for Vibe Term
 * Basic get/update/save functionality only
 */

import fs from "fs";
import path from "path";
import { app } from "electron";
import type { AppSettings } from "../ipc-handler-types";
import type { UnifiedItem } from "../../client/types";
import { ErrorHandler } from "./error-handler";

export interface AppState {
  settings: AppSettings;
  storedItems: UnifiedItem[];
}

export class SettingsManager {
  private static instance: SettingsManager;
  private appState: AppState;
  private dataPath: string;

  private constructor() {
    const userDataPath =
      app?.getPath("userData") || path.join(process.cwd(), ".vibe-term");
    this.dataPath = path.join(userDataPath, "app-data.json");

    // Initialize with defaults
    this.appState = this.getDefaultState();

    // Load existing data
    this.load();
  }

  static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  /**
   * Get default application state
   */
  private getDefaultState(): AppState {
    return {
      settings: {
        editor: {
          theme: "vibe-term",
        },
        desktop: {
          notifications: true,
        },
        webServer: {
          enabled: true,
          port: 6969,
        },
        discord: {
          enabled: false,
          username: "Vibe Term",
          webhookUrl: "",
        },
      },
      storedItems: [],
    };
  }

  /**
   * Load application state from disk
   */
  private load(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, "utf-8");

        // Validate JSON before parsing
        if (!data.trim()) {
          ErrorHandler.logError(new Error("Data file is empty"), {
            operation: "load",
            additionalData: { dataPath: this.dataPath },
          });
          this.save(); // Save defaults
          return;
        }

        const loadedState = JSON.parse(data);

        // Merge with defaults to ensure all properties exist
        const defaultState = this.getDefaultState();
        this.appState = {
          ...defaultState,
          ...loadedState,
          settings: {
            ...defaultState.settings,
            ...loadedState.settings,
            editor: {
              ...defaultState.settings.editor,
              ...loadedState.settings?.editor,
            },
            desktop: {
              ...defaultState.settings.desktop,
              ...loadedState.settings?.desktop,
            },
            webServer: {
              ...defaultState.settings.webServer,
              ...loadedState.settings?.webServer,
            },
            discord: {
              ...defaultState.settings.discord,
              ...loadedState.settings?.discord,
            },
          },
        };
      }
    } catch (error) {
      ErrorHandler.logError(error, {
        operation: "load",
        additionalData: { dataPath: this.dataPath },
      });
      // Keep defaults on error and save them
      this.save();
    }
  }

  /**
   * Save application state to disk
   */
  private save(): void {
    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });

      fs.writeFileSync(
        this.dataPath,
        JSON.stringify(this.appState, null, 2),
        "utf-8"
      );
    } catch (error) {
      ErrorHandler.logError(error, {
        operation: "save",
        additionalData: { dataPath: this.dataPath },
      });
    }
  }

  // Public API - simplified to just 3 core methods

  /**
   * Get the complete application state
   */
  getAppState(): AppState {
    return { ...this.appState };
  }

  /**
   * Update the application state
   */
  updateAppState(newState: Partial<AppState>): void {
    this.appState = {
      ...this.appState,
      ...newState,
      settings: { ...this.appState.settings, ...newState.settings },
    };
    this.save();
  }

  /**
   * Get settings only
   */
  getSettings(): AppSettings {
    return { ...this.appState.settings };
  }

  /**
   * Update settings only
   */
  updateSettings(newSettings: Partial<AppSettings>): void {
    this.appState.settings = { ...this.appState.settings, ...newSettings };
    this.save();
  }

  /**
   * Get stored items only
   */
  getStoredItems(): UnifiedItem[] {
    return [...this.appState.storedItems];
  }

  /**
   * Add a stored item
   */
  addStoredItem(item: UnifiedItem): void {
    this.appState.storedItems.push(item);
    this.save();
  }

  /**
   * Update a stored item
   */
  updateStoredItem(id: string, updates: Partial<UnifiedItem>): void {
    const index = this.appState.storedItems.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.appState.storedItems[index] = {
        ...this.appState.storedItems[index],
        ...updates,
      };
      this.save();
    }
  }

  /**
   * Delete a stored item
   */
  deleteStoredItem(id: string): void {
    this.appState.storedItems = this.appState.storedItems.filter(
      (item) => item.id !== id
    );
    this.save();
  }

  /**
   * Find a stored item by ID
   */
  findStoredItem(id: string): UnifiedItem | undefined {
    return this.appState.storedItems.find((item) => item.id === id);
  }
}
