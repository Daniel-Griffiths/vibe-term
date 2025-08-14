import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { X, Settings as SettingsIcon, MessageCircle, Globe, Bell, Copy, Check } from "lucide-react";

const DEFAULT_WEB_SERVER_PORT = 6969;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppSettings {
  desktop: {
    notifications: boolean;
  };
  discord: {
    enabled: boolean;
    webhookUrl: string;
    username: string;
  };
  webServer: {
    enabled: boolean;
    port: number;
  };
}

const defaultSettings: AppSettings = {
  desktop: {
    notifications: true,
  },
  discord: {
    enabled: false,
    webhookUrl: "",
    username: "Vibe Term",
  },
  webServer: {
    enabled: true,
    port: DEFAULT_WEB_SERVER_PORT,
  },
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingSending, setTestingSending] = useState(false);
  const [actualWebPort] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [localIp, setLocalIp] = useState<string>("localhost");
  const [copied, setCopied] = useState(false);

  // Load settings and local IP when modal opens
  useEffect(() => {
    if (isOpen) {
      if (window.electronAPI?.loadSettings) {
        window.electronAPI.loadSettings().then((savedSettings: AppSettings) => {
          if (savedSettings) {
            setSettings({ ...defaultSettings, ...savedSettings });
          }
        });
      }
      
      if (window.electronAPI?.getLocalIp) {
        window.electronAPI.getLocalIp().then((ip: string) => {
          setLocalIp(ip);
        });
      }
    }
  }, [isOpen]);

  const handleSettingChange = (path: string, value: any) => {
    setSettings(prev => {
      const keys = path.split('.');
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
    if (!window.electronAPI?.saveSettings) return;
    
    setIsSaving(true);
    try {
      const result = await window.electronAPI.saveSettings(settings);
      if (result.success) {
        setHasChanges(false);
      } else {
        alert(`Failed to save settings: ${result.error}`);
      }
    } catch (error) {
      alert(`Error saving settings: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestDiscord = async () => {
    if (!settings.discord.webhookUrl.trim()) {
      alert('Please enter a Discord webhook URL first');
      return;
    }

    setTestingSending(true);
    try {
      const result = await window.electronAPI?.testDiscordNotification?.(settings.discord);
      if (result?.success) {
        alert('Test notification sent successfully!');
      } else {
        alert(`Test failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error sending test notification: ${error}`);
    } finally {
      setTestingSending(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleCopyUrl = () => {
    const url = `http://${localIp}:${actualWebPort || settings.webServer.port}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative glass-card rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-200">Settings</h2>
          </div>
          <Button
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0 bg-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900/50 border border-gray-800">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Discord
            </TabsTrigger>
            <TabsTrigger value="web-interface" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Web Interface
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-6">
            {/* Desktop Notifications Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.desktop.notifications}
                    onChange={(e) => handleSettingChange('desktop.notifications', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  Enable desktop notifications
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Show desktop notifications when Claude Code processes complete or fail while Vibe Term is not focused
              </p>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-6">
            {/* Discord Notifications Section */}
            <div className="space-y-4">
              
              {/* Enable Discord Notifications */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.discord.enabled}
                    onChange={(e) => handleSettingChange('discord.enabled', e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  Enable Discord notifications
                </label>
              </div>
              
              {/* Discord Webhook URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Discord Webhook URL
                </label>
                <input
                  type="url"
                  value={settings.discord.webhookUrl}
                  onChange={(e) => handleSettingChange('discord.webhookUrl', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!settings.discord.enabled}
                  className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Create a webhook in your Discord server settings → Integrations → Webhooks
                </p>
              </div>
              
              {/* Discord Bot Username */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Bot Username
                </label>
                <input
                  type="text"
                  value={settings.discord.username}
                  onChange={(e) => handleSettingChange('discord.username', e.target.value)}
                  placeholder="Vibe Term"
                  disabled={!settings.discord.enabled}
                  className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The name that will appear when sending notifications
                </p>
              </div>
              
              {/* Test Discord Notification */}
              {settings.discord.enabled && (
                <div>
                  <Button
                    onClick={handleTestDiscord}
                    disabled={!settings.discord.webhookUrl.trim() || testingSending}
                    variant="primary"
                  >
                    {testingSending ? 'Sending...' : 'Send Test Notification'}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="web-interface" className="space-y-4 mt-6">
            {/* Web Server Section */}
            <div className="space-y-4">
              
              {/* Enable Web Server */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.webServer.enabled}
                    onChange={(e) => handleSettingChange('webServer.enabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  Enable web interface for remote access
                </label>
              </div>
              
              {/* Web Server Port */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Port Number
                </label>
                <input
                  type="number"
                  value={settings.webServer.port}
                  onChange={(e) => handleSettingChange('webServer.port', parseInt(e.target.value) || DEFAULT_WEB_SERVER_PORT)}
                  min="1024"
                  max="65535"
                  disabled={!settings.webServer.enabled}
                  className="w-32 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="mt-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Access URL
                  </label>
                  <div className="flex items-center gap-2 p-2 bg-gray-800 rounded border border-gray-700">
                    <span className="text-gray-400 font-mono flex-1">
                      http://{localIp}:{actualWebPort || settings.webServer.port}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyUrl}
                      className="h-6 w-6 p-0"
                      title="Copy URL"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  {actualWebPort && actualWebPort !== settings.webServer.port && (
                    <p className="text-xs text-yellow-400 mt-1">
                      Using port {actualWebPort} - {settings.webServer.port} was busy
                    </p>
                  )}
                </div>
              </div>
              
              {settings.webServer.enabled && (
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-300">
                    <strong>Remote Access Setup:</strong>
                  </p>
                  <ol className="text-xs text-blue-200 mt-2 space-y-1 list-decimal list-inside">
                    <li>Ensure your device is on the same network or connected via VPN/Tailscale</li>
                    <li>Visit <span className="font-mono">http://{localIp}:{settings.webServer.port}</span> on any device</li>
                    <li>Control your projects remotely from your phone or other devices</li>
                  </ol>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Save/Cancel Buttons */}
        <div className="flex gap-3 pt-6 border-t border-gray-800 mt-6">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            variant="primary"
            className="flex-1"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}