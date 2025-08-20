/**
 * Claude Code Hooks Setup Utility
 * Sets up hook configuration for status detection in vibe-term projects
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { WEB_PORT } from "../../shared/settings";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ClaudeHookConfig {
  hooks: {
    [hookName: string]: Array<{
      hooks: Array<{
        type: string;
        command: string;
      }>;
    }>;
  };
}

/**
 * Set up Claude hooks for a project to enable status detection
 */
export async function setupClaudeHooks(projectPath: string): Promise<boolean> {
  try {
    const claudeDir = path.join(projectPath, ".claude");
    const settingsFile = path.join(claudeDir, "settings.json");

    // Ensure .claude directory exists
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Extract project ID from directory name
    const projectId = path.basename(projectPath);
    const vibeTermPort = process.env.VIBE_TERM_PORT || WEB_PORT.toString();
    const ipcEndpoint = `http://localhost:${vibeTermPort}/api/ipc/claude-hook`;

    // Create hook configuration using direct curl commands
    const hookConfig: ClaudeHookConfig = {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST -H "Content-Type: application/json" -d '{"args":["Stop","${projectId}"]}' "${ipcEndpoint}" --max-time 1 --connect-timeout 1 || true`,
              },
            ],
          },
        ],
        SubagentStop: [
          {
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST -H "Content-Type: application/json" -d '{"args":["SubagentStop","${projectId}"]}' "${ipcEndpoint}" --max-time 1 --connect-timeout 1 || true`,
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST -H "Content-Type: application/json" -d '{"args":["UserPromptSubmit","${projectId}"]}' "${ipcEndpoint}" --max-time 1 --connect-timeout 1 || true`,
              },
            ],
          },
        ],
        Notification: [
          {
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST -H "Content-Type: application/json" -d '{"args":["Notification","${projectId}"]}' "${ipcEndpoint}" --max-time 1 --connect-timeout 1 || true`,
              },
            ],
          },
        ],
      },
    };

    // Read existing settings if they exist
    let existingSettings: any = {};
    if (fs.existsSync(settingsFile)) {
      try {
        const content = fs.readFileSync(settingsFile, "utf-8");
        existingSettings = JSON.parse(content);
      } catch (error) {
        console.warn(`Failed to parse existing Claude settings: ${error}`);
      }
    }

    // Merge hook configuration with existing settings
    const mergedSettings = {
      ...existingSettings,
      hooks: {
        ...existingSettings.hooks,
        ...hookConfig.hooks,
      },
    };

    // Write settings file
    fs.writeFileSync(settingsFile, JSON.stringify(mergedSettings, null, 2));

    return true;
  } catch (error) {
    console.error(`Failed to setup Claude hooks for ${projectPath}:`, error);
    return false;
  }
}

/**
 * Remove Claude hook configuration from a project
 */
export async function removeClaudeHooks(projectPath: string): Promise<boolean> {
  try {
    const settingsFile = path.join(projectPath, ".claude", "settings.json");

    if (!fs.existsSync(settingsFile)) {
      return true; // Nothing to remove
    }

    // Read existing settings
    const content = fs.readFileSync(settingsFile, "utf-8");
    const settings = JSON.parse(content);

    // Remove vibe-term hooks (keep other hooks if they exist)
    if (settings.hooks) {
      const hooksToRemove = [
        "Stop",
        "SubagentStop",
        "UserPromptSubmit",
        "Notification",
      ];

      hooksToRemove.forEach((hookName) => {
        if (settings.hooks[hookName]) {
          // Filter out vibe-term hooks (those containing claude-hook endpoint)
          settings.hooks[hookName] = settings.hooks[hookName].filter(
            (hook: any) => {
              return !hook.hooks?.some((h: any) =>
                h.command?.includes("/api/ipc/claude-hook")
              );
            }
          );

          // Remove empty hook arrays
          if (settings.hooks[hookName].length === 0) {
            delete settings.hooks[hookName];
          }
        }
      });

      // Remove hooks object if empty
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
    }

    // Write back the cleaned settings
    if (Object.keys(settings).length === 0) {
      // Remove the file if it's empty
      fs.unlinkSync(settingsFile);
    } else {
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    }

    return true;
  } catch (error) {
    console.error(`Failed to remove Claude hooks for ${projectPath}:`, error);
    return false;
  }
}

/**
 * Check if Claude hooks are configured for a project
 */
export function areClaudeHooksConfigured(projectPath: string): boolean {
  try {
    const settingsFile = path.join(projectPath, ".claude", "settings.json");

    if (!fs.existsSync(settingsFile)) {
      return false;
    }

    const content = fs.readFileSync(settingsFile, "utf-8");
    const settings = JSON.parse(content);

    // Check if our hooks are configured
    const requiredHooks = ["Stop", "UserPromptSubmit"];
    return requiredHooks.some((hookName) => {
      return settings.hooks?.[hookName]?.some((hook: any) => {
        return hook.hooks?.some((h: any) =>
          h.command?.includes("/api/ipc/claude-hook")
        );
      });
    });
  } catch (error) {
    return false;
  }
}
