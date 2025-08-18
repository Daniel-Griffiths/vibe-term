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
  private static readonly DEFAULT_TMUX_OPTIONS = [
    'set-option status off', 
    'set -g mouse on', 
    'set -g history-limit 10000'
  ];
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
        console.error(`Command failed, trying next fallback: ${command}`, error);
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
      pnpm: [
        'pnpm --version',
        'pnpm -v'
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
   * Generate tmux command string for direct terminal execution
   */
  static tmuxCommand(options: {
    action: 'new-attach' | 'attach';
    sessionName: string;
    projectPath?: string;
    startCommand?: string;
    tmuxOptions?: string[];
  }): string {
    const { action, sessionName, projectPath, startCommand, tmuxOptions } = options;
    
    const allOptions = tmuxOptions ? [...this.DEFAULT_TMUX_OPTIONS, ...tmuxOptions] : this.DEFAULT_TMUX_OPTIONS;
    
    if (action === 'new-attach') {
      let command = `tmux new-session -s "${sessionName}"`;
      if (projectPath) command += ` -c "${projectPath}"`;
      if (startCommand) {
        // Use the format: tmux new-session -s sessionName "zsh -i -c 'command; exec zsh'"
        // This runs the command and then keeps an interactive shell open
        command += ` "zsh -i -c '${startCommand}; exec zsh'"`;
      }
      command += ` \\; ${allOptions.join(' \\; ')}`;
      return command;
    }
    
    // action === 'attach'
    return `tmux attach-session -t "${sessionName}" \\; ${allOptions.join(' \\; ')}`;
  }

  /**
   * Check if a tmux session exists
   */
  static async checkTmuxSession(sessionName: string): Promise<boolean> {
    try {
      const result = await this.execute(`tmux has-session -t "${sessionName}"`);
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new tmux session
   */
  static async createTmuxSession(
    sessionName: string, 
    projectPath: string, 
    startCommand?: string,
    detached: boolean = true
  ): Promise<CommandResult> {
    let command = detached 
      ? `tmux new-session -d -s "${sessionName}"`
      : `tmux new-session -s "${sessionName}"`;
    
    if (projectPath) command += ` -c "${projectPath}"`;
    if (startCommand) command += ` "${startCommand}"`;
    command += ` \\; ${this.DEFAULT_TMUX_OPTIONS.join(' \\; ')}`;

    return await this.execute(command);
  }

  /**
   * Attach to an existing tmux session
   */
  static async attachTmuxSession(
    sessionName: string, 
    tmuxOptions?: string[]
  ): Promise<CommandResult> {
    const allOptions = tmuxOptions ? [...this.DEFAULT_TMUX_OPTIONS, ...tmuxOptions] : this.DEFAULT_TMUX_OPTIONS;
    
    let command = `tmux attach-session -t "${sessionName}"`;
    command += ` \\; ${allOptions.join(' \\; ')}`;

    return await this.execute(command);
  }

  /**
   * Kill a tmux session
   */
  static async killTmuxSession(sessionName: string): Promise<CommandResult> {
    try {
      return await this.execute(`tmux kill-session -t "${sessionName}"`);
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || `Failed to kill tmux session ${sessionName}` 
      };
    }
  }

}