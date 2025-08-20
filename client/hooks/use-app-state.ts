import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import type { UnifiedItem } from "../types";
import type { AppSettings } from "../utils/api";
import { ItemType } from "../types";
import { WEB_PORT } from "../../shared/settings";

interface AppState {
  items: UnifiedItem[];
  selectedItem: string | null;
  settings: AppSettings;
  isLoading: boolean;
  isInitialized: boolean;
}

const defaultSettings: AppSettings = {
  editor: { theme: "vibe-term" },
  desktop: { notifications: true },
  webServer: { enabled: true, port: WEB_PORT },
  discord: { enabled: false, username: "Vibe Term", webhookUrl: "" },
};

export function useAppState() {
  const [state, setState] = useState<AppState>({
    items: [],
    selectedItem: null,
    settings: defaultSettings,
    isLoading: true,
    isInitialized: false,
  });

  // Initialize by loading from backend
  const initialize = useCallback(async () => {
    if (state.isInitialized) return;

    try {
      // Load items from backend
      const itemsResult = await api.getStoredItems();

      // Load settings from backend
      const settingsResult = await api.getAppSettings();

      setState((prev) => ({
        ...prev,
        items: itemsResult.success
          ? itemsResult.data.map((item: any) => ({
              ...item,
              status: item.type === ItemType.PROJECT ? "idle" : undefined,
              lastActivity:
                item.type === ItemType.PROJECT
                  ? new Date().toISOString()
                  : undefined,
              output: item.type === ItemType.PROJECT ? [] : undefined,
            }))
          : [],
        settings: settingsResult.success
          ? settingsResult.data
          : defaultSettings,
        isLoading: false,
        isInitialized: true,
      }));
    } catch (error) {
      console.error("Failed to initialize app state:", error);
      setState((prev) => ({ ...prev, isLoading: false, isInitialized: true }));
    }
  }, [state.isInitialized]);

  // Actions
  const addItem = useCallback(async (item: UnifiedItem) => {
    try {
      await api.addStoredItem(item);
      setState((prev) => ({
        ...prev,
        items: [...prev.items, item],
      }));
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  }, []);

  const updateItem = useCallback(
    (id: string, updates: Partial<UnifiedItem>) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }));
    },
    []
  );

  const updateStoredItem = useCallback(
    async (id: string, updates: Partial<UnifiedItem>) => {
      try {
        await api.updateStoredItem(id, updates);
        setState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      } catch (error) {
        console.error("Failed to update stored item:", error);
      }
    },
    []
  );

  const deleteItem = useCallback(async (id: string) => {
    try {
      await api.deleteStoredItem(id);
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
        selectedItem: prev.selectedItem === id ? null : prev.selectedItem,
      }));
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  }, []);

  const setItems = useCallback((items: UnifiedItem[]) => {
    setState((prev) => ({ ...prev, items }));
  }, []);

  const setSelectedItem = useCallback((itemId: string | null) => {
    setState((prev) => ({ ...prev, selectedItem: itemId }));
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      try {
        const updatedSettings = { ...state.settings, ...newSettings };
        await api.updateAppSettings(updatedSettings);
        setState((prev) => ({ ...prev, settings: updatedSettings }));
      } catch (error) {
        console.error("Failed to update settings:", error);
      }
    },
    [state.settings]
  );

  // Initialize on first mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    ...state,
    initialize,
    addItem,
    updateItem,
    updateStoredItem,
    deleteItem,
    setItems,
    setSelectedItem,
    updateSettings,
  };
}
