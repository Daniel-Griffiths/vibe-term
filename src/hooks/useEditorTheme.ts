import { useState, useEffect } from "react";

export function useEditorTheme() {
  const [editorTheme, setEditorTheme] = useState<string>("vibe-term");

  // Load editor theme from settings
  useEffect(() => {
    const loadEditorTheme = async () => {
      try {
        const config = await window.electronAPI?.loadAppConfig();
        if (config?.data?.settings?.editor?.theme) {
          // Validate theme exists, fallback to vs-dark if not
          const validThemes = [
            'vs-dark', 'vs', 'hc-black', 'hc-light',
            'vibe-term', 'vscode-dark', 'one-dark-pro', 'monokai-pro',
            'github-dark', 'dracula', 'solarized-dark', 'ayu-dark'
          ];
          
          const themeToUse = validThemes.includes(config.data.settings.editor.theme) 
            ? config.data.settings.editor.theme 
            : 'vibe-term';
            
          console.log('Loading theme from settings:', config.data.settings.editor.theme, '-> using:', themeToUse);
          setEditorTheme(themeToUse);
        }
      } catch (err) {
        console.error('Failed to load editor theme:', err);
        setEditorTheme('vibe-term'); // Safe fallback
      }
    };

    loadEditorTheme();

    // Set up an interval to check for theme changes
    // This is a simple way to detect when settings change
    const interval = setInterval(loadEditorTheme, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return editorTheme;
}