import { create } from 'zustand';
import { communicationAPI } from "../utils/communication";
import type { UnifiedItem } from "../types";

export interface AppSettings {
  editor: {
    theme: string;
  };
  desktop: {
    notifications: boolean;
  };
  webServer: {
    enabled: boolean;
    port: number;
  };
  discord: {
    enabled: boolean;
    username: string;
    webhookUrl: string;
  };
}

interface AppState {
  // Data
  items: UnifiedItem[];
  selectedItem: string | null;
  settings: AppSettings;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  addItem: (item: UnifiedItem) => Promise<void>;
  updateItem: (id: string, updates: Partial<UnifiedItem>) => void;
  updateStoredItem: (id: string, updates: Partial<UnifiedItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  setItems: (items: UnifiedItem[]) => void;
  setSelectedItem: (itemId: string | null) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
}

// Create Zustand store with Electron backend sync
export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  items: [],
  selectedItem: null,
  settings: {
    editor: { theme: "vibe-term" },
    desktop: { notifications: true },
    webServer: { enabled: true, port: 6969 },
    discord: { enabled: false, username: "Vibe Term", webhookUrl: "" }
  },
  isLoading: true,
  isInitialized: false,

  // Initialize by loading from Electron storage
  initialize: async () => {
    const state = get();
    if (state.isInitialized) {
      console.log('[Zustand] Already initialized, skipping...');
      return;
    }

    try {
      console.log('[Zustand] Initializing from Electron storage...', { isElectron: typeof window !== 'undefined' && !!(window as any).electronAPI });
      
      // Load items from Electron
      const itemsResult = await communicationAPI.getStoredItems();
      console.log('[Zustand] Loaded items:', itemsResult);
      
      // Load settings from Electron
      const settingsResult = await communicationAPI.getAppSettings();
      console.log('[Zustand] Loaded settings:', settingsResult);
      
      // Update Zustand state with loaded data
      set({
        items: itemsResult.success ? itemsResult.data.map((item: any) => ({
          ...item,
          status: item.type === "project" ? "idle" : undefined,
          lastActivity: item.type === "project" ? new Date().toISOString() : undefined,
          output: item.type === "project" ? [] : undefined,
        })) : [],
        settings: settingsResult.success ? settingsResult.data : state.settings,
        isLoading: false,
        isInitialized: true
      });

      console.log('[Zustand] Initialization complete');
    } catch (error) {
      console.error('[Zustand] Failed to initialize:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  // Add item - sync with Electron
  addItem: async (item: UnifiedItem) => {
    try {
      // First save to Electron
      await communicationAPI.addStoredItem(item);
      
      // Then update Zustand state
      set((state) => ({
        items: [...state.items, item]
      }));
    } catch (error) {
      console.error('[Zustand] Failed to add item:', error);
    }
  },

  // Update item locally (for runtime state like output)
  updateItem: (id: string, updates: Partial<UnifiedItem>) => {
    set((state) => ({
      items: state.items.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  },

  // Update stored item - sync with Electron
  updateStoredItem: async (id: string, updates: Partial<UnifiedItem>) => {
    try {
      // First save to Electron
      await communicationAPI.updateStoredItem(id, updates);
      
      // Then update Zustand state
      set((state) => ({
        items: state.items.map(item => 
          item.id === id ? { ...item, ...updates } : item
        )
      }));
    } catch (error) {
      console.error('[Zustand] Failed to update stored item:', error);
    }
  },

  // Delete item - sync with Electron
  deleteItem: async (id: string) => {
    try {
      // First delete from Electron
      await communicationAPI.deleteStoredItem(id);
      
      // Then update Zustand state
      set((state) => ({
        items: state.items.filter(item => item.id !== id),
        selectedItem: state.selectedItem === id ? null : state.selectedItem
      }));
    } catch (error) {
      console.error('[Zustand] Failed to delete item:', error);
    }
  },

  // Set items (for bulk updates)
  setItems: (items: UnifiedItem[]) => {
    set({ items });
  },

  // Set selected item
  setSelectedItem: (itemId: string | null) => {
    set({ selectedItem: itemId });
  },

  // Update settings - sync with Electron
  updateSettings: async (newSettings: Partial<AppSettings>) => {
    try {
      const currentSettings = get().settings;
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      // First save to Electron
      await communicationAPI.updateAppSettings(updatedSettings);
      
      // Then update Zustand state
      set({ settings: updatedSettings });
    } catch (error) {
      console.error('[Zustand] Failed to update settings:', error);
    }
  }
}));

// Initialize the store when the module loads
// This will be called once when the app starts
let initPromise: Promise<void> | null = null;

export async function initializeStore() {
  if (!initPromise) {
    initPromise = useAppStore.getState().initialize();
  }
  return initPromise;
}

// Auto-initialize on module load for web
// This ensures data is loaded as soon as possible
if (typeof window !== 'undefined' && !(window as any).electronAPI) {
  console.log('[Zustand] Auto-initializing for web environment');
  initializeStore();
}