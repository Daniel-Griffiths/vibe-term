import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export interface TerminalTheme {
  background?: string;
  foreground?: string;
  cursor?: string;
  selectionBackground?: string;
}

export interface TerminalConfig {
  theme?: TerminalTheme;
  interactive?: boolean;
  scrollback?: number;
  fontSize?: number;
  fontFamily?: string;
  cursorBlink?: boolean;
}

export interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  element: HTMLDivElement;
}

export class TerminalService {
  /**
   * Default terminal themes
   */
  static readonly THEMES = {
    claude: {
      background: "#000000",
      foreground: "#22c55e",
      cursor: "#22c55e",
      selectionBackground: "rgba(255, 255, 255, 0.3)",
    },
    output: {
      background: "#0a0a0a",
      foreground: "#e0e0e0",
      cursor: "#e0e0e0",
      selectionBackground: "rgba(255, 255, 255, 0.2)",
    },
    default: {
      background: "#000000",
      foreground: "#ffffff",
      cursor: "#ffffff",
      selectionBackground: "rgba(255, 255, 255, 0.3)",
    }
  };

  /**
   * Default font configuration
   */
  static readonly DEFAULT_FONT = {
    family: '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace',
    size: 14
  };

  /**
   * Create a new terminal instance with standardized configuration
   */
  static createTerminal(config: TerminalConfig = {}): Terminal {
    const {
      theme = this.THEMES.default,
      interactive = true,
      scrollback = 1000,
      fontSize = this.DEFAULT_FONT.size,
      fontFamily = this.DEFAULT_FONT.family,
      cursorBlink = true
    } = config;

    return new Terminal({
      theme,
      fontFamily,
      fontSize,
      cursorBlink,
      convertEol: true,
      scrollback,
      disableStdin: !interactive,
    });
  }

  /**
   * Create a terminal instance with DOM element and fit addon
   */
  static createTerminalInstance(
    container: HTMLElement,
    config: TerminalConfig = {}
  ): TerminalInstance {
    const element = document.createElement("div");
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.display = "none";
    container.appendChild(element);

    const terminal = this.createTerminal(config);
    const fitAddon = new FitAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.open(element);

    return { terminal, fitAddon, element };
  }

  /**
   * Show a terminal and fit it to container
   */
  static showTerminal(instance: TerminalInstance, delay: number = 10): void {
    instance.element.style.display = "block";
    setTimeout(() => {
      instance.fitAddon.fit();
    }, delay);
  }

  /**
   * Hide a terminal
   */
  static hideTerminal(instance: TerminalInstance): void {
    instance.element.style.display = "none";
  }

  /**
   * Resize all terminals in a collection
   */
  static resizeTerminals(terminals: Map<string, TerminalInstance>): void {
    terminals.forEach((instance) => {
      if (instance.element.style.display === "block") {
        instance.fitAddon.fit();
      }
    });
  }

  /**
   * Clean up a terminal instance
   */
  static cleanupTerminal(instance: TerminalInstance): void {
    instance.terminal.dispose();
    if (instance.element.parentNode) {
      instance.element.parentNode.removeChild(instance.element);
    }
  }

  /**
   * Clear terminal content
   */
  static clearTerminal(instance: TerminalInstance, delay: number = 500): void {
    setTimeout(() => {
      instance.terminal.clear();
    }, delay);
  }

  /**
   * Get Claude-specific terminal configuration
   */
  static getClaudeConfig(): TerminalConfig {
    return {
      theme: this.THEMES.claude,
      interactive: true,
      scrollback: 1000,
      cursorBlink: true
    };
  }

  /**
   * Get output-only terminal configuration
   */
  static getOutputConfig(): TerminalConfig {
    return {
      theme: this.THEMES.output,
      interactive: false,
      scrollback: 5000,
      cursorBlink: false
    };
  }

  /**
   * Set up terminal data handling for interactive terminals
   */
  static setupDataHandler(
    terminal: Terminal,
    onData: (data: string) => void
  ): () => void {
    const disposable = terminal.onData(onData);
    return () => disposable.dispose();
  }

  /**
   * Set up window resize handler for a collection of terminals
   */
  static setupResizeHandler(terminals: Map<string, TerminalInstance>): () => void {
    const handleResize = () => this.resizeTerminals(terminals);
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }

  /**
   * Create terminal manager for managing multiple project terminals
   */
  static createTerminalManager() {
    const terminals = new Map<string, TerminalInstance>();
    
    return {
      terminals,
      
      createTerminal: (
        projectId: string, 
        container: HTMLElement, 
        config: TerminalConfig = {}
      ): TerminalInstance => {
        if (terminals.has(projectId)) {
          return terminals.get(projectId)!;
        }
        
        const instance = this.createTerminalInstance(container, config);
        terminals.set(projectId, instance);
        return instance;
      },
      
      getTerminal: (projectId: string): TerminalInstance | undefined => {
        return terminals.get(projectId);
      },
      
      showTerminal: (projectId: string, delay?: number): void => {
        const instance = terminals.get(projectId);
        if (instance) {
          this.showTerminal(instance, delay);
        }
      },
      
      hideTerminal: (projectId: string): void => {
        const instance = terminals.get(projectId);
        if (instance) {
          this.hideTerminal(instance);
        }
      },
      
      hideAllTerminals: (): void => {
        terminals.forEach((instance) => {
          this.hideTerminal(instance);
        });
      },
      
      resizeAll: (): void => {
        this.resizeTerminals(terminals);
      },
      
      clearTerminal: (projectId: string, delay?: number): void => {
        const instance = terminals.get(projectId);
        if (instance) {
          this.clearTerminal(instance, delay);
        }
      },
      
      cleanup: (): void => {
        terminals.forEach((instance) => {
          this.cleanupTerminal(instance);
        });
        terminals.clear();
      }
    };
  }
}