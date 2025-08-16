import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { UnifiedItem } from "../types";

// File writer for web server access
const writeStateToFile = (state: {
  settings: AppSettings;
  storedItems: StoredItem[];
}) => {
  if (typeof window !== "undefined" && window.electronAPI?.writeStateFile) {
    window.electronAPI.writeStateFile(state);
  }
};

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

// Stored versions without runtime state
// Single interface for stored items (same as UnifiedItem but without runtime fields)
export type StoredItem = Omit<
  UnifiedItem,
  "status" | "lastActivity" | "output"
>;

interface AppState {
  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;

  // Stored data (persisted)
  storedItems: StoredItem[];

  // Runtime state (not persisted)
  items: UnifiedItem[];
  selectedItem: string | null;

  // Actions
  setItems: (items: UnifiedItem[]) => void;
  setSelectedItem: (id: string | null) => void;

  addItem: (item: StoredItem) => void;
  updateStoredItem: (id: string, updates: Partial<StoredItem>) => void;
  updateItem: (id: string, updates: Partial<UnifiedItem>) => void;
  deleteItem: (id: string) => void;

  // Helper to sync stored to runtime
  syncToRuntime: () => void;
}

const defaultSettings: AppSettings = {
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
};

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Settings
        settings: defaultSettings,
        updateSettings: (updates) => {
          set((state) => ({
            settings: { ...state.settings, ...updates },
          }));
          // Write to file after state update
          const newState = get();
          writeStateToFile({
            settings: newState.settings,
            storedItems: newState.storedItems,
          });
        },
        resetSettings: () => set({ settings: defaultSettings }),

        // Stored data (persisted)
        storedItems: [],

        // Runtime state (not persisted)
        items: [],
        selectedItem: null,

        // Basic setters
        setItems: (items) => set({ items }),
        setSelectedItem: (id) => set({ selectedItem: id }),

        // Unified operations
        addItem: (item) => {
          set((state) => ({
            storedItems: [...state.storedItems, item],
          }));
          get().syncToRuntime();
          // Write to file after state update
          const newState = get();
          writeStateToFile({
            settings: newState.settings,
            storedItems: newState.storedItems,
          });
        },
        updateStoredItem: (id, updates) => {
          set((state) => ({
            storedItems: state.storedItems.map((item) =>
              item.id === id ? { ...item, ...updates } : item
            ),
          }));
          get().syncToRuntime();
          // Write to file after state update
          const newState = get();
          writeStateToFile({
            settings: newState.settings,
            storedItems: newState.storedItems,
          });
        },
        updateItem: (id, updates) => {
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id ? { ...item, ...updates } : item
            ),
          }));
        },
        deleteItem: (id) => {
          set((state) => ({
            storedItems: state.storedItems.filter((item) => item.id !== id),
            selectedItem: state.selectedItem === id ? null : state.selectedItem,
          }));
          get().syncToRuntime();
          // Write to file after state update
          const newState = get();
          writeStateToFile({
            settings: newState.settings,
            storedItems: newState.storedItems,
          });
        },

        // Sync stored to runtime
        syncToRuntime: () => {
          const state = get();

          // Convert stored items to runtime items
          const runtimeItems: UnifiedItem[] = state.storedItems.map((item) => ({
            ...item,
            status: item.type === "project" ? ("idle" as const) : undefined,
            lastActivity:
              item.type === "project" ? new Date().toISOString() : undefined,
            output: item.type === "project" ? [] : undefined,
          }));

          set({ items: runtimeItems });
        },
      }),
      {
        name: "vibe-term-storage",
        partialize: (state) => ({
          settings: state.settings,
          storedItems: state.storedItems,
          // Runtime state is not persisted
        }),
        onRehydrateStorage: () => (state) => {
          // Sync stored data to runtime state after rehydration
          state?.syncToRuntime();
          // Write to file after rehydration
          if (state) {
            writeStateToFile({
              settings: state.settings,
              storedItems: state.storedItems,
            });
          }
        },
      }
    )
  )
);

// Initialize file writing subscription
export const initializeFileSync = () => {
  // Subscribe to any changes and write to file
  useAppStore.subscribe(
    (state) => state,
    (data) => {
      writeStateToFile(data);
    },
    { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
  );
};
