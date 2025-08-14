import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X, Settings as SettingsIcon, MessageCircle, Globe } from "lucide-react";

const DEFAULT_WEB_SERVER_PORT = 6969;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppSettings {
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

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen && window.electronAPI?.loadSettings) {
      window.electronAPI.loadSettings().then((savedSettings: AppSettings) => {
        if (savedSettings) {
          setSettings({ ...defaultSettings, ...savedSettings });
        }
      });
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

        <div className="space-y-6">
          {/* Discord Notifications Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
              <MessageCircle className="h-5 w-5 text-purple-400" />
              <h3 className="text-md font-medium text-gray-200">Discord Notifications</h3>
            </div>
            
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
                  className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {testingSending ? 'Sending...' : 'Send Test Notification'}
                </Button>
              </div>
            )}
          </div>

          {/* Web Server Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
              <Globe className="h-5 w-5 text-blue-400" />
              <h3 className="text-md font-medium text-gray-200">Web Interface</h3>
            </div>
            
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
              <p className="text-xs text-gray-500 mt-1">
                Access via http://your-tailscale-ip:{actualWebPort || settings.webServer.port}
                {actualWebPort && actualWebPort !== settings.webServer.port && (
                  <span className="text-yellow-400 ml-2">
                    (Using port {actualWebPort} - {settings.webServer.port} was busy)
                  </span>
                )}
              </p>
            </div>
            
            {settings.webServer.enabled && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-300">
                  <strong>Remote Access Setup:</strong>
                </p>
                <ol className="text-xs text-blue-200 mt-2 space-y-1 list-decimal list-inside">
                  <li>Connect to your network via Tailscale</li>
                  <li>Find your machine's Tailscale IP in the Tailscale admin panel</li>
                  <li>Visit http://your-tailscale-ip:{settings.webServer.port} on any device</li>
                  <li>Control your projects remotely from your phone or other devices</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Save/Cancel Buttons */}
        <div className="flex gap-3 pt-6 border-t border-gray-800 mt-6">
          <Button
            onClick={handleClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}