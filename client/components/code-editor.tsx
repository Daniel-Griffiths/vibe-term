import React, { useEffect, useState } from "react";
import { Editor, DiffEditor } from "@monaco-editor/react";
import { api } from "@/utils/api";

interface ICodeEditorProps {
  value: string;
  onChange?: (value: string | undefined) => void;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
  options?: any;
}

interface ISharedDiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
  options?: any;
}

const defaultEditorOptions = {
  automaticLayout: true,
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
  lineNumbers: "on" as const,
  bracketPairColorization: { enabled: true },
  tabSize: 2,
  insertSpaces: true,
};

const defaultDiffOptions = {
  readOnly: true,
  automaticLayout: true,
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderSideBySide: true,
  wordWrap: "off",
};

export function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    sh: "shell",
    bash: "shell",
  };
  return languageMap[ext || ""] || "plaintext";
}

// Define custom themes for Monaco Editor
function defineCustomThemes(monacoInstance?: typeof monaco) {
  const monacoToUse = monacoInstance || monaco;
  if (!monacoToUse?.editor) {
    return;
  }

  try {
    // Vibe Term Custom Theme (matches app design)
    monacoToUse.editor.defineTheme("vibe-term", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "7C7C7C", fontStyle: "italic" },
        { token: "keyword", foreground: "22C55E" }, // Green accent
        { token: "operator", foreground: "E5E5E5" },
        { token: "string", foreground: "60A5FA" }, // Blue
        { token: "number", foreground: "F59E0B" }, // Amber
        { token: "function", foreground: "8B5CF6" }, // Purple
        { token: "variable", foreground: "E5E5E5" }, // Main text color
        { token: "type", foreground: "06B6D4" }, // Cyan
        { token: "class", foreground: "06B6D4" },
        { token: "identifier", foreground: "E5E5E5" },
        { token: "delimiter", foreground: "A3A3A3" },
      ],
      colors: {
        "editor.background": "#0A0A19", // Main background matching app
        "editor.foreground": "#E5E5E5", // Main text color
        "editor.lineHighlightBackground": "#1E1E28", // Subtle highlight
        "editor.selectionBackground": "#22C55E33", // Green selection with transparency
        "editorCursor.foreground": "#22C55E", // Green cursor
        "editorIndentGuide.background": "#2A2A3A",
        "editorLineNumber.foreground": "#7C7C7C",
        "editorLineNumber.activeForeground": "#22C55E",
        "editor.selectionHighlightBackground": "#22C55E22",
        "editor.wordHighlightBackground": "#22C55E22",
        "editor.wordHighlightStrongBackground": "#22C55E33",
        "editorBracketMatch.background": "#22C55E44",
        "editorBracketMatch.border": "#22C55E",
      },
    });

    // One Dark Pro (VS Code default dark theme)
    monacoToUse.editor.defineTheme("one-dark-pro", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5C6370", fontStyle: "italic" },
        { token: "keyword", foreground: "C678DD" },
        { token: "operator", foreground: "56B6C2" },
        { token: "string", foreground: "98C379" },
        { token: "number", foreground: "D19A66" },
        { token: "function", foreground: "61AFEF" },
        { token: "variable", foreground: "ABB2BF" },
        { token: "type", foreground: "E5C07B" },
      ],
      colors: {
        "editor.background": "#282C34",
        "editor.foreground": "#ABB2BF",
        "editor.lineHighlightBackground": "#2C313C",
        "editor.selectionBackground": "#3E4451",
        "editorCursor.foreground": "#528BFF",
      },
    });

    // Monokai Pro
    monacoToUse.editor.defineTheme("monokai-pro", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "727072", fontStyle: "italic" },
        { token: "keyword", foreground: "FF6188" },
        { token: "string", foreground: "FFD866" },
        { token: "number", foreground: "AB9DF2" },
        { token: "function", foreground: "A9DC76" },
        { token: "variable", foreground: "FCFCFA" },
      ],
      colors: {
        "editor.background": "#2D2A2E",
        "editor.foreground": "#FCFCFA",
        "editor.lineHighlightBackground": "#363337",
        "editor.selectionBackground": "#403E41",
        "editorCursor.foreground": "#FCFCFA",
      },
    });

    // VS Code Default Dark (Dark+)
    monacoToUse.editor.defineTheme("vscode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "569CD6" },
        { token: "operator", foreground: "D4D4D4" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "function", foreground: "DCDCAA" },
        { token: "variable", foreground: "9CDCFE" },
        { token: "type", foreground: "4EC9B0" },
        { token: "class", foreground: "4EC9B0" },
      ],
      colors: {
        "editor.background": "#1E1E1E",
        "editor.foreground": "#D4D4D4",
        "editor.lineHighlightBackground": "#2A2D2E",
        "editor.selectionBackground": "#264F78",
        "editorCursor.foreground": "#AEAFAD",
        "editorIndentGuide.background": "#404040",
        "editorLineNumber.foreground": "#858585",
      },
    });

    // GitHub Dark
    monacoToUse.editor.defineTheme("github-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8B949E", fontStyle: "italic" },
        { token: "keyword", foreground: "FF7B72" },
        { token: "operator", foreground: "F85149" },
        { token: "string", foreground: "A5D6FF" },
        { token: "number", foreground: "79C0FF" },
        { token: "function", foreground: "D2A8FF" },
        { token: "variable", foreground: "FFA657" },
        { token: "type", foreground: "7EE787" },
      ],
      colors: {
        "editor.background": "#0D1117",
        "editor.foreground": "#C9D1D9",
        "editor.lineHighlightBackground": "#161B22",
        "editor.selectionBackground": "#264F78",
        "editorCursor.foreground": "#C9D1D9",
      },
    });

    // Dracula
    monacoToUse.editor.defineTheme("dracula", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6272A4", fontStyle: "italic" },
        { token: "keyword", foreground: "FF79C6" },
        { token: "operator", foreground: "FF79C6" },
        { token: "string", foreground: "F1FA8C" },
        { token: "number", foreground: "BD93F9" },
        { token: "function", foreground: "50FA7B" },
        { token: "variable", foreground: "F8F8F2" },
        { token: "type", foreground: "8BE9FD" },
      ],
      colors: {
        "editor.background": "#282A36",
        "editor.foreground": "#F8F8F2",
        "editor.lineHighlightBackground": "#44475A",
        "editor.selectionBackground": "#44475A",
        "editorCursor.foreground": "#F8F8F2",
      },
    });

    // Solarized Dark
    monacoToUse.editor.defineTheme("solarized-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "586E75", fontStyle: "italic" },
        { token: "keyword", foreground: "859900" },
        { token: "operator", foreground: "93A1A1" },
        { token: "string", foreground: "2AA198" },
        { token: "number", foreground: "D33682" },
        { token: "function", foreground: "268BD2" },
        { token: "variable", foreground: "93A1A1" },
        { token: "type", foreground: "B58900" },
      ],
      colors: {
        "editor.background": "#002B36",
        "editor.foreground": "#839496",
        "editor.lineHighlightBackground": "#073642",
        "editor.selectionBackground": "#073642",
        "editorCursor.foreground": "#839496",
      },
    });

    // Ayu Dark
    monacoToUse.editor.defineTheme("ayu-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5C6773", fontStyle: "italic" },
        { token: "keyword", foreground: "FF8F40" },
        { token: "operator", foreground: "F29668" },
        { token: "string", foreground: "AAD94C" },
        { token: "number", foreground: "D2A6FF" },
        { token: "function", foreground: "FFB454" },
        { token: "variable", foreground: "BFBDB6" },
        { token: "type", foreground: "59C2FF" },
      ],
      colors: {
        "editor.background": "#0A0E14",
        "editor.foreground": "#B3B1AD",
        "editor.lineHighlightBackground": "#131721",
        "editor.selectionBackground": "#253340",
        "editorCursor.foreground": "#E6B450",
      },
    });
  } catch (error) {
    console.error("Failed to define custom themes:", error);
  }
}

function useEditorTheme() {
  const [theme, setTheme] = useState("vibe-term");

  useEffect(() => {
    // Load theme from settings
    api
      .getAppSettings()
      .then((result) => {
        if (result.success) {
          // Validate theme exists, fallback to vibe-term if not
          const validThemes = [
            "vs-dark",
            "vs",
            "hc-black",
            "hc-light",
            "vibe-term",
            "vscode-dark",
            "one-dark-pro",
            "monokai-pro",
            "github-dark",
            "dracula",
            "solarized-dark",
            "ayu-dark",
          ];

          const themeToUse = validThemes.includes(result.data.editor.theme)
            ? result.data.editor.theme
            : "vibe-term";

          setTheme(themeToUse);
        }
      })
      .catch((error) => {
        console.error("Failed to load editor theme:", error);
      });
  }, []);

  return theme;
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = "100%",
  options = {},
}: ICodeEditorProps) {
  const theme = useEditorTheme();
  const [monacoInstance, setMonacoInstance] = React.useState<any>(null);
  const [editorInstance, setEditorInstance] = React.useState<any>(null);

  const mergedOptions = {
    ...defaultEditorOptions,
    readOnly,
    ...options,
  };

  // Watch for theme changes and apply them
  React.useEffect(() => {
    if (monacoInstance && theme) {
      try {
        monacoInstance.editor.setTheme(theme);
      } catch (err) {
        console.error("Failed to apply new theme:", theme, err);
      }
    }
  }, [theme, monacoInstance]);

  const handleEditorBeforeMount = (monaco: any) => {
    defineCustomThemes(monaco);
    setMonacoInstance(monaco);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    setEditorInstance(editor);

    // Set the theme immediately after defining themes
    try {
      monaco.editor.setTheme(theme);
    } catch (err) {
      console.error("Failed to apply initial theme:", theme, err);
      // Fallback to vs-dark if theme fails
      monaco.editor.setTheme("vs-dark");
    }
  };

  return (
    <Editor
      value={value}
      onChange={onChange}
      language={language}
      theme={theme}
      height={height}
      options={mergedOptions}
      beforeMount={handleEditorBeforeMount}
      onMount={handleEditorDidMount}
    />
  );
}

export function SharedDiffEditor({
  original,
  modified,
  language,
  readOnly = true,
  height = "100%",
  options = {},
}: ISharedDiffEditorProps) {
  const theme = useEditorTheme();
  const [monacoInstance, setMonacoInstance] = React.useState<any>(null);
  const [editorInstance, setEditorInstance] = React.useState<any>(null);

  // Mobile-responsive options
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const mergedOptions = {
    ...defaultDiffOptions,
    readOnly,
    // Mobile-specific overrides
    renderSideBySide: !isMobile, // Inline view on mobile
    fontSize: isMobile ? 12 : 14,
    wordWrap: isMobile ? "on" : "off",
    ...options,
  };

  // Watch for theme changes and apply them
  React.useEffect(() => {
    if (monacoInstance && theme) {
      try {
        monacoInstance.editor.setTheme(theme);
      } catch (err) {
        console.error("Failed to apply new diff theme:", theme, err);
      }
    }
  }, [theme, monacoInstance]);

  const handleDiffEditorBeforeMount = (monaco: any) => {
    defineCustomThemes(monaco);
    setMonacoInstance(monaco);
  };

  const handleDiffEditorDidMount = (editor: any, monaco: any) => {
    setEditorInstance(editor);

    // Set the theme immediately after defining themes
    try {
      monaco.editor.setTheme(theme);
    } catch (err) {
      console.error("Failed to apply initial diff theme:", theme, err);
      // Fallback to vs-dark if theme fails
      monaco.editor.setTheme("vs-dark");
    }
  };

  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme={theme}
      height={height}
      options={mergedOptions}
      beforeMount={handleDiffEditorBeforeMount}
      onMount={handleDiffEditorDidMount}
    />
  );
}
