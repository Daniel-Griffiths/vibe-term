import { exec } from "child_process";
import { promisify } from "util";
import { getCurrentOS, OperatingSystem } from "./os";

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
    "set-option status off",
    "set -g mouse on",
    "set -g history-limit 10000",
  ];
  /**
   * Get the preferred shell for the current platform
   */
  static getPreferredShell(): string {
    return process.env.SHELL || "/bin/zsh";
  }

  /**
   * Get shell-specific command to run a command in login mode
   */
  static getLoginShellCommand(command: string): string {
    const shell = this.getPreferredShell();

    if (shell.includes("zsh")) {
      return `zsh -l -c "${command.replace(/"/g, '\\"')}"`;
    } else if (shell.includes("bash")) {
      return `bash -l -c "${command.replace(/"/g, '\\"')}"`;
    } else if (shell.includes("fish")) {
      return `fish -l -c "${command.replace(/"/g, '\\"')}"`;
    } else {
      return `${shell} -l -c "${command.replace(/"/g, '\\"')}"`;
    }
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
      shell = true,
    } = options;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env,
        timeout,
        shell: shell,
      });

      return {
        success: !stderr || stderr.trim() === "",
        output: stdout,
        error: stderr || undefined,
        code: 0,
      };
    } catch (error: unknown) {
      const err = error as Error & {
        stdout?: string;
        stderr?: string;
        code?: number;
      };
      return {
        success: false,
        output: err.stdout || undefined,
        error: err.stderr || err.message,
        code: err.code || 1,
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
      claude: ["claude --version", "claude -v"],
      tmux: ["tmux -V", "tmux --version"],
      git: ["git --version"],
      node: ["node --version", "node -v"],
      npm: ["npm --version", "npm -v"],
      pnpm: ["pnpm --version", "pnpm -v"],
    };

    const commands = baseCommands[name as keyof typeof baseCommands] || [
      `${name} --version`,
      `${name} -v`,
    ];

    const currentOS = getCurrentOS();
    const fallbackCommands: string[] = [];

    for (const cmd of commands) {
      fallbackCommands.push(this.getLoginShellCommand(cmd));
    }

    if (name === "claude") {
      const homePath = process.env.HOME || "";

      switch (currentOS) {
        case OperatingSystem.MACOS:
          fallbackCommands.push(
            `${homePath}/.claude/local/claude --version`,
            `${homePath}/.local/bin/claude --version`,
            "/usr/local/bin/claude --version",
            "/opt/homebrew/bin/claude --version"
          );
          break;

        case OperatingSystem.LINUX:
          fallbackCommands.push(
            `${homePath}/.claude/local/claude --version`,
            `${homePath}/.local/bin/claude --version`,
            "/usr/local/bin/claude --version",
            "/usr/bin/claude --version"
          );
          break;
      }
    }

    return [...commands, ...fallbackCommands];
  }

  /**
   * Generate a tmux session name from project name
   */
  static generateTmuxSessionName(projectName: string): string {
    return projectName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  }

  /**
   * Generate tmux command string for direct terminal execution
   */
  static tmuxCommand(options: {
    action: "new-attach" | "attach";
    sessionName: string;
    projectPath?: string;
    startCommand?: string;
    tmuxOptions?: string[];
  }): string {
    const { action, sessionName, projectPath, startCommand, tmuxOptions } =
      options;

    const allOptions = tmuxOptions
      ? [...this.DEFAULT_TMUX_OPTIONS, ...tmuxOptions]
      : this.DEFAULT_TMUX_OPTIONS;

    if (action === "new-attach") {
      let command = `tmux new-session -s "${sessionName}"`;
      if (projectPath) command += ` -c "${projectPath}"`;
      if (startCommand) {
        command += ` "zsh -i -c '${startCommand}; exec zsh'"`;
      }
      command += ` \\; ${allOptions.join(" \\; ")}`;
      return command;
    }

    return `tmux attach-session -t "${sessionName}" \\; ${allOptions.join(
      " \\; "
    )}`;
  }

  /**
   * Check if a tmux session exists
   */
  static async checkTmuxSession(sessionName: string): Promise<boolean> {
    try {
      const result = await this.execute(`tmux has-session -t "${sessionName}"`);
      return result.success;
    } catch {
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
    command += ` \\; ${this.DEFAULT_TMUX_OPTIONS.join(" \\; ")}`;

    return await this.execute(command);
  }

  /**
   * Attach to an existing tmux session
   */
  static async attachTmuxSession(
    sessionName: string,
    tmuxOptions?: string[]
  ): Promise<CommandResult> {
    const allOptions = tmuxOptions
      ? [...this.DEFAULT_TMUX_OPTIONS, ...tmuxOptions]
      : this.DEFAULT_TMUX_OPTIONS;

    let command = `tmux attach-session -t "${sessionName}"`;
    command += ` \\; ${allOptions.join(" \\; ")}`;

    return await this.execute(command);
  }

  /**
   * Kill a tmux session
   */
  static async killTmuxSession(sessionName: string): Promise<CommandResult> {
    try {
      return await this.execute(`tmux kill-session -t "${sessionName}"`);
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        error: err.message || `Failed to kill tmux session ${sessionName}`,
      };
    }
  }
}
