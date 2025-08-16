import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  code?: number;
}

export interface ExecuteOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  shell?: boolean;
}

export class ShellUtils {
  /**
   * Get the preferred shell for the current platform
   */
  static getPreferredShell(): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    
    // For macOS and Linux, prefer zsh if available, fallback to bash
    return process.env.SHELL || '/bin/zsh';
  }

  /**
   * Get shell-specific command to run a command in login mode
   */
  static getLoginShellCommand(command: string): string {
    const shell = this.getPreferredShell();
    
    if (shell.includes('zsh')) {
      return `zsh -l -c "${command.replace(/"/g, '\\"')}"`;
    } else if (shell.includes('bash')) {
      return `bash -l -c "${command.replace(/"/g, '\\"')}"`;
    } else if (shell.includes('fish')) {
      return `fish -l -c "${command.replace(/"/g, '\\"')}"`;
    } else if (shell.includes('cmd')) {
      return command; // Windows CMD doesn't need login flag
    } else {
      // Generic fallback
      return `${shell} -l -c "${command.replace(/"/g, '\\"')}"`;
    }
  }

  /**
   * Execute a command with multiple fallback strategies
   */
  static async executeWithFallbacks(
    primaryCommand: string,
    fallbackCommands: string[] = [],
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    const commands = [primaryCommand, ...fallbackCommands];
    
    for (const command of commands) {
      try {
        const result = await this.execute(command, options);
        if (result.success) {
          return result;
        }
      } catch (error) {
        // Continue to next fallback
        continue;
      }
    }
    
    return {
      success: false,
      error: 'All command fallbacks failed'
    };
  }

  /**
   * Execute a single command
   */
  static async execute(
    command: string,
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    const {
      cwd = process.cwd(),
      env = process.env,
      timeout = 30000,
      shell = true
    } = options;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env,
        timeout,
        shell
      });

      return {
        success: !stderr || stderr.trim() === '',
        output: stdout,
        error: stderr || undefined,
        code: 0
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || undefined,
        error: error.stderr || error.message,
        code: error.code || 1
      };
    }
  }

  /**
   * Check if a dependency is available with smart fallbacks
   */
  static async checkDependency(name: string): Promise<boolean> {
    const versionCommands = this.getDependencyCommands(name);
    
    for (const command of versionCommands) {
      const result = await this.execute(command, { timeout: 5000 });
      if (result.success) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get platform-specific commands to check for a dependency
   */
  private static getDependencyCommands(name: string): string[] {
    const baseCommands = {
      claude: [
        'claude --version',
        'claude -v'
      ],
      tmux: [
        'tmux -V',
        'tmux --version'
      ],
      git: [
        'git --version'
      ],
      node: [
        'node --version',
        'node -v'
      ],
      npm: [
        'npm --version',
        'npm -v'
      ],
      yarn: [
        'yarn --version',
        'yarn -v'
      ]
    };

    const commands = baseCommands[name] || [`${name} --version`, `${name} -v`];
    const fallbackCommands: string[] = [];
    
    // Add login shell variants for Unix-like systems
    if (os.platform() !== 'win32') {
      for (const cmd of commands) {
        fallbackCommands.push(this.getLoginShellCommand(cmd));
      }
    }

    // Add common installation paths for Claude
    if (name === 'claude') {
      const homePath = process.env.HOME || process.env.USERPROFILE || '';
      fallbackCommands.push(
        `${homePath}/.claude/local/claude --version`,
        `${homePath}/.local/bin/claude --version`,
        '/usr/local/bin/claude --version'
      );
    }

    return [...commands, ...fallbackCommands];
  }

  /**
   * Generate a tmux session name from project name
   */
  static generateTmuxSessionName(projectName: string): string {
    return projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  /**
   * Generate tmux command string
   */
  static tmuxCommand(options: {
    action: 'new-attach' | 'attach';
    sessionName: string;
    projectPath?: string;
    startCommand?: string;
    tmuxOptions?: string[];
  }): string {
    const { action, sessionName, projectPath, startCommand, tmuxOptions } = options;
    let command = '';
    
    switch (action) {
      case 'new-attach':
        command = `tmux new-session -s "${sessionName}"`;
        if (projectPath) command += ` -c "${projectPath}"`;
        if (startCommand) command += ` "${startCommand}"`;
        if (tmuxOptions && tmuxOptions.length > 0) {
          command += ` \\; ${tmuxOptions.join(' \\; ')}`;
        }
        break;

      case 'attach':
        command = `tmux attach-session -t "${sessionName}"`;
        if (tmuxOptions && tmuxOptions.length > 0) {
          command += ` \\; ${tmuxOptions.join(' \\; ')}`;
        }
        break;
    }
    
    return command;
  }

  /**
   * Unified tmux session management (async operations)
   */
  static async tmux(options: {
    action: 'create' | 'attach' | 'check' | 'kill' | 'new-attach';
    sessionName: string;
    projectPath?: string;
    startCommand?: string;
    tmuxOptions?: string[];
    detached?: boolean;
  }): Promise<CommandResult | boolean> {
    const { action, sessionName, projectPath, startCommand, tmuxOptions, detached = false } = options;

    try {
      let command = '';
      
      switch (action) {
        case 'create':
          command = detached 
            ? `tmux new-session -d -s "${sessionName}"`
            : `tmux new-session -s "${sessionName}"`;
          
          if (projectPath) command += ` -c "${projectPath}"`;
          if (startCommand) command += ` "${startCommand}"`;
          if (tmuxOptions && tmuxOptions.length > 0) {
            command += ` \\; ${tmuxOptions.join(' \\; ')}`;
          }
          break;

        case 'attach':
          command = `tmux attach-session -t "${sessionName}"`;
          if (tmuxOptions && tmuxOptions.length > 0) {
            command += ` \\; ${tmuxOptions.join(' \\; ')}`;
          }
          break;

        case 'new-attach':
          command = `tmux new-session -s "${sessionName}"`;
          if (projectPath) command += ` -c "${projectPath}"`;
          if (startCommand) command += ` "${startCommand}"`;
          if (tmuxOptions && tmuxOptions.length > 0) {
            command += ` \\; ${tmuxOptions.join(' \\; ')}`;
          }
          break;

        case 'check':
          const result = await this.execute(`tmux has-session -t "${sessionName}"`);
          return result.success;

        case 'kill':
          await this.execute(`tmux kill-session -t "${sessionName}"`);
          return { success: true };
      }

      return await this.execute(command);
    } catch (error: any) {
      console.error(`Failed to ${action} tmux session "${sessionName}":`, error.message || error);
      
      if (action === 'check') return false;
      if (action === 'kill') return { success: false, error: error.message };
      
      return { success: false, error: error.message || `Failed to ${action} tmux session` };
    }
  }

  // Convenience methods that use the unified tmux method
  static async createTmuxSession(sessionName: string, projectPath: string, startCommand?: string): Promise<CommandResult> {
    return this.tmux({ action: 'create', sessionName, projectPath, startCommand, detached: true }) as Promise<CommandResult>;
  }

  static async attachTmuxSession(sessionName: string, tmuxOptions?: string[]): Promise<CommandResult> {
    return this.tmux({ action: 'attach', sessionName, tmuxOptions }) as Promise<CommandResult>;
  }

  static async checkTmuxSession(sessionName: string): Promise<boolean> {
    return this.tmux({ action: 'check', sessionName }) as Promise<boolean>;
  }

  static async killTmuxSession(sessionName: string): Promise<void> {
    await this.tmux({ action: 'kill', sessionName });
  }

  static newAndAttachTmuxSessionCommand(sessionName: string, projectPath: string, tmuxOptions?: string[]): string {
    return this.tmux({ action: 'command', sessionName, projectPath, tmuxOptions }) as string;
  }
  
  // Deprecated command methods - use the direct execution methods above instead
  static createTmuxSessionCommand(sessionName: string, projectPath: string, startCommand?: string): string {
    return startCommand 
      ? `tmux new-session -d -s "${sessionName}" -c "${projectPath}" "${startCommand}"`
      : `tmux new-session -d -s "${sessionName}" -c "${projectPath}"`;
  }

  static attachTmuxSessionCommand(sessionName: string, options?: string[]): string {
    let command = `tmux attach-session -t "${sessionName}"`;
    if (options && options.length > 0) {
      command += ` \\; ${options.join(' \\; ')}`;
    }
    return command;
  }

  static checkTmuxSessionCommand(sessionName: string): string {
    return `tmux has-session -t "${sessionName}"`;
  }

  static killTmuxSessionCommand(sessionName: string): string {
    return `tmux kill-session -t "${sessionName}"`;
  }
}