/**
 * Claude Code Hooks Setup Utility
 * Sets up hook configuration for status detection in vibe-term projects
 */

import fs from 'fs';
import path from 'path';

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
    const claudeDir = path.join(projectPath, '.claude');
    const settingsFile = path.join(claudeDir, 'settings.json');
    const hookScriptPath = path.join(__dirname, '../../hooks/status-hook.sh');
    
    // Ensure .claude directory exists
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }
    
    // Check if hook script exists and is executable
    if (!fs.existsSync(hookScriptPath)) {
      console.warn(`Hook script not found at ${hookScriptPath}`);
      return false;
    }
    
    // Create hook configuration
    const hookConfig: ClaudeHookConfig = {
      hooks: {
        "Stop": [{
          hooks: [{
            type: "command",
            command: `${hookScriptPath} Stop "${projectPath}" "$CLAUDE_SESSION_ID"`
          }]
        }],
        "SubagentStop": [{
          hooks: [{
            type: "command", 
            command: `${hookScriptPath} SubagentStop "${projectPath}" "$CLAUDE_SESSION_ID"`
          }]
        }],
        "UserPromptSubmit": [{
          hooks: [{
            type: "command",
            command: `${hookScriptPath} UserPromptSubmit "${projectPath}" "$CLAUDE_SESSION_ID"`
          }]
        }],
        "Notification": [{
          hooks: [{
            type: "command",
            command: `${hookScriptPath} Notification "${projectPath}" "$CLAUDE_SESSION_ID"`
          }]
        }]
      }
    };
    
    // Read existing settings if they exist
    let existingSettings: any = {};
    if (fs.existsSync(settingsFile)) {
      try {
        const content = fs.readFileSync(settingsFile, 'utf-8');
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
        ...hookConfig.hooks
      }
    };
    
    // Write settings file
    fs.writeFileSync(settingsFile, JSON.stringify(mergedSettings, null, 2));
    
    console.log(`[Claude Hooks] Configured hooks for project: ${projectPath}`);
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
    const settingsFile = path.join(projectPath, '.claude', 'settings.json');
    
    if (!fs.existsSync(settingsFile)) {
      return true; // Nothing to remove
    }
    
    // Read existing settings
    const content = fs.readFileSync(settingsFile, 'utf-8');
    const settings = JSON.parse(content);
    
    // Remove vibe-term hooks (keep other hooks if they exist)
    if (settings.hooks) {
      const hooksToRemove = ['Stop', 'SubagentStop', 'UserPromptSubmit', 'Notification'];
      
      hooksToRemove.forEach(hookName => {
        if (settings.hooks[hookName]) {
          // Filter out vibe-term hooks (those containing status-hook.sh)
          settings.hooks[hookName] = settings.hooks[hookName].filter((hook: any) => {
            return !hook.hooks?.some((h: any) => h.command?.includes('status-hook.sh'));
          });
          
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
    
    console.log(`[Claude Hooks] Removed hooks for project: ${projectPath}`);
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
    const settingsFile = path.join(projectPath, '.claude', 'settings.json');
    
    if (!fs.existsSync(settingsFile)) {
      return false;
    }
    
    const content = fs.readFileSync(settingsFile, 'utf-8');
    const settings = JSON.parse(content);
    
    // Check if our hooks are configured
    const requiredHooks = ['Stop', 'UserPromptSubmit'];
    return requiredHooks.some(hookName => {
      return settings.hooks?.[hookName]?.some((hook: any) => {
        return hook.hooks?.some((h: any) => h.command?.includes('status-hook.sh'));
      });
    });
    
  } catch (error) {
    return false;
  }
}