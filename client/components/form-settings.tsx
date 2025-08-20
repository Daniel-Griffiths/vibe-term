import { useState, useEffect } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { api } from "../utils/api";
import type { AppSettings } from "../utils/api";
import { Icon } from "./icon";
import { WEB_PORT } from "../../shared/settings";

interface IFormSettingsProps {
  onClose: () => void;
}

const defaultSettings: AppSettings = {
  editor: { theme: "vibe-term" },
  desktop: { notifications: true },
  webServer: { enabled: true },
};

export function FormSettings({ onClose }: IFormSettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [localIp, setLocalIp] = useState<string>("localhost");
  const [hasTailscale, setHasTailscale] = useState(false);

  // Load settings from backend when component mounts
  useEffect(() => {
    api
      .getAppSettings()
      .then((result) => {
        if (result.success) {
          setSettings(result.data);
          setLocalSettings(result.data);
        }
      })
      .catch((error) => {
        console.error("Failed to load settings:", error);
      });

    api
      .getLocalIp()
      .then((result) => {
        if (result?.success && result?.data) {
          setLocalIp(result.data.localIp);
          setHasTailscale(result.data.hasTailscale);
        }
      })
      .catch((error) => {
        console.error("Failed to get local IP:", error);
      });
  }, []);

  const handleSettingChange = (path: string, value: any) => {
    setLocalSettings((prev) => {
      const keys = path.split(".");
      const newSettings = { ...prev };
      let current: any = newSettings;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save settings via IPC to backend
      await api.updateAppSettings(localSettings);
      setSettings(localSettings);
      setHasChanges(false);
    } catch (error) {
      alert(`Error saving settings: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const webUrl = `http://${localIp}:${WEB_PORT}`;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-900/50 border border-gray-800">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Icon name="bell" className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="web-interface"
            className="flex items-center gap-2"
          >
            <Icon name="globe" className="h-4 w-4" />
            Web Interface
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-6">
          {/* Desktop Notifications Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Enable desktop notifications
                </p>
                <p className="text-xs text-gray-500">
                  Show desktop notifications when Claude Code processes complete
                  or fail while Vibe Term is not focused
                </p>
              </div>
              <button
                onClick={() =>
                  handleSettingChange(
                    "desktop.notifications",
                    !localSettings.desktop.notifications
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localSettings.desktop.notifications
                    ? "bg-blue-600"
                    : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localSettings.desktop.notifications
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Editor Theme Section */}
          <div className="space-y-4 pt-4 border-t border-gray-800">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Editor Theme
              </label>
              <select
                value={localSettings.editor.theme}
                onChange={(e) =>
                  handleSettingChange("editor.theme", e.target.value)
                }
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-gray-600"
              >
                <option value="vibe-term">Vibe Term (App Theme)</option>
                <option value="vs-dark">Dark (Monaco Default)</option>
                <option value="vscode-dark">VS Code Dark+</option>
                <option value="one-dark-pro">One Dark Pro</option>
                <option value="monokai-pro">Monokai Pro</option>
                <option value="github-dark">GitHub Dark</option>
                <option value="dracula">Dracula</option>
                <option value="solarized-dark">Solarized Dark</option>
                <option value="ayu-dark">Ayu Dark</option>
                <option value="vs">Light (Monaco Default)</option>
                <option value="hc-black">High Contrast Black</option>
                <option value="hc-light">High Contrast Light</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose your preferred code editor theme
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="web-interface" className="space-y-4 mt-6">
          {/* Web Server Section */}
          <div className="space-y-4">
            {/* Enable Web Server */}
            <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Enable web interface for remote access
                </p>
                <p className="text-xs text-gray-500">
                  Allow remote access to your projects via web browser
                </p>
              </div>
              <button
                onClick={() =>
                  handleSettingChange(
                    "webServer.enabled",
                    !localSettings.webServer.enabled
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localSettings.webServer.enabled
                    ? "bg-blue-600"
                    : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localSettings.webServer.enabled
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Local Network Access */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Local Network Access
                </label>
                <Input
                  value={`http://${localIp}:${WEB_PORT}`}
                  hasCopy
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">
                  Access from devices on the same WiFi network
                </p>
              </div>

              {!hasTailscale && (
                <div className="bg-orange-900/20 border border-orange-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Icon
                      name="alerttriangle"
                      className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-sm text-orange-300 font-medium">
                        Remote Access Not Available
                      </p>
                      <p className="text-xs text-orange-200 mt-1">
                        Install and enable Tailscale to access your web
                        interface from anywhere.
                        <a
                          href="https://tailscale.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-300 hover:text-orange-200 underline ml-1"
                        >
                          Learn more
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {localSettings.webServer.enabled && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-300">
                  <strong>Remote Access Setup:</strong>
                </p>
                <ol className="text-xs text-blue-200 mt-2 space-y-1 list-decimal list-inside">
                  <li>
                    Ensure your device is on the same network or connected via
                    VPN/Tailscale
                  </li>
                  <li>
                    Visit{" "}
                    <span className="font-mono">
                      http://{localIp}:{WEB_PORT}
                    </span>{" "}
                    on any device
                  </li>
                  <li>
                    Control your projects remotely from your phone or other
                    devices
                  </li>
                </ol>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Form Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isSaving}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="flex items-center gap-2 flex-1"
        >
          {isSaving ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>
    </div>
  );
}
