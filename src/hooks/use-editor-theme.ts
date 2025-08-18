import { useState, useEffect } from 'react';
import { communicationAPI } from '../utils/communication';

export function useEditorTheme() {
  const [theme, setTheme] = useState('vibe-term');

  useEffect(() => {
    // Load theme from settings
    communicationAPI.getAppSettings()
      .then(result => {
        if (result.success) {
          // Validate theme exists, fallback to vibe-term if not
          const validThemes = [
            'vs-dark', 'vs', 'hc-black', 'hc-light',
            'vibe-term', 'vscode-dark', 'one-dark-pro', 'monokai-pro',
            'github-dark', 'dracula', 'solarized-dark', 'ayu-dark'
          ];
          
          const themeToUse = validThemes.includes(result.data.editor.theme) 
            ? result.data.editor.theme 
            : 'vibe-term';
            
          setTheme(themeToUse);
        }
      })
      .catch(error => {
        console.error('Failed to load editor theme:', error);
      });
  }, []);

  return theme;
}