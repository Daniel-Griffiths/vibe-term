import { useAppStore } from "../stores/settings";

export function useEditorTheme() {
  const { settings } = useAppStore();

  // Validate theme exists, fallback to vibe-term if not
  const validThemes = [
    'vs-dark', 'vs', 'hc-black', 'hc-light',
    'vibe-term', 'vscode-dark', 'one-dark-pro', 'monokai-pro',
    'github-dark', 'dracula', 'solarized-dark', 'ayu-dark'
  ];
  
  const themeToUse = validThemes.includes(settings.editor.theme) 
    ? settings.editor.theme 
    : 'vibe-term';

  return themeToUse;
}