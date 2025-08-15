import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class StorageService {
  private static readonly DEFAULT_STORAGE_DIR = 'vibe-term-storage';
  
  /**
   * Get the storage directory path
   */
  static getStorageDir(): string {
    try {
      return app.getPath('userData');
    } catch {
      // Fallback for non-Electron environments or testing
      const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
      return path.join(homeDir, this.DEFAULT_STORAGE_DIR);
    }
  }

  /**
   * Get the full path for a storage file
   */
  static getStoragePath(filename: string): string {
    return path.join(this.getStorageDir(), filename);
  }

  /**
   * Ensure storage directory exists
   */
  static ensureStorageDir(): void {
    const storageDir = this.getStorageDir();
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  /**
   * Load data from a JSON file
   */
  static load<T>(filename: string, defaultValue: T): StorageResult<T> {
    try {
      const filePath = this.getStoragePath(filename);
      
      if (!fs.existsSync(filePath)) {
        return { success: true, data: defaultValue };
      }

      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      return { success: true, data: parsed };
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      return { 
        success: false, 
        data: defaultValue, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Save data to a JSON file
   */
  static save<T>(filename: string, data: T): StorageResult<void> {
    try {
      this.ensureStorageDir();
      const filePath = this.getStoragePath(filename);
      const jsonData = JSON.stringify(data, null, 2);
      
      fs.writeFileSync(filePath, jsonData, 'utf8');
      
      return { success: true };
    } catch (error) {
      console.error(`Error saving ${filename}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Load data asynchronously
   */
  static async loadAsync<T>(filename: string, defaultValue: T): Promise<StorageResult<T>> {
    try {
      const filePath = this.getStoragePath(filename);
      
      if (!fs.existsSync(filePath)) {
        return { success: true, data: defaultValue };
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      return { success: true, data: parsed };
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      return { 
        success: false, 
        data: defaultValue, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Save data asynchronously
   */
  static async saveAsync<T>(filename: string, data: T): Promise<StorageResult<void>> {
    try {
      this.ensureStorageDir();
      const filePath = this.getStoragePath(filename);
      const jsonData = JSON.stringify(data, null, 2);
      
      await fs.promises.writeFile(filePath, jsonData, 'utf8');
      
      return { success: true };
    } catch (error) {
      console.error(`Error saving ${filename}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check if a storage file exists
   */
  static exists(filename: string): boolean {
    const filePath = this.getStoragePath(filename);
    return fs.existsSync(filePath);
  }

  /**
   * Delete a storage file
   */
  static delete(filename: string): StorageResult<void> {
    try {
      const filePath = this.getStoragePath(filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error deleting ${filename}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * List all storage files
   */
  static listFiles(): string[] {
    try {
      const storageDir = this.getStorageDir();
      
      if (!fs.existsSync(storageDir)) {
        return [];
      }
      
      return fs.readdirSync(storageDir)
        .filter(file => path.extname(file) === '.json');
    } catch (error) {
      console.error('Error listing storage files:', error);
      return [];
    }
  }

  /**
   * Get file size in bytes
   */
  static getFileSize(filename: string): number {
    try {
      const filePath = this.getStoragePath(filename);
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Backup a storage file
   */
  static backup(filename: string): StorageResult<void> {
    try {
      const filePath = this.getStoragePath(filename);
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' };
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `${path.parse(filename).name}.backup.${timestamp}.json`;
      const backupPath = this.getStoragePath(backupFilename);
      
      fs.copyFileSync(filePath, backupPath);
      
      return { success: true };
    } catch (error) {
      console.error(`Error backing up ${filename}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Convenience methods for common data types
  
  /**
   * Load projects from storage
   */
  static loadProjects(): StorageResult<any[]> {
    return this.load('projects.json', []);
  }

  /**
   * Save projects to storage
   */
  static saveProjects(projects: any[]): StorageResult<void> {
    return this.save('projects.json', projects);
  }

  /**
   * Load panels from storage
   */
  static loadPanels(): StorageResult<any[]> {
    return this.load('panels.json', []);
  }

  /**
   * Save panels to storage
   */
  static savePanels(panels: any[]): StorageResult<void> {
    return this.save('panels.json', panels);
  }

  /**
   * Load settings from storage
   */
  static loadSettings(): StorageResult<any> {
    return this.load('settings.json', null);
  }

  /**
   * Save settings to storage
   */
  static saveSettings(settings: any): StorageResult<void> {
    return this.save('settings.json', settings);
  }

  /**
   * Load window state from storage
   */
  static loadWindowState(): StorageResult<any> {
    return this.load('window-state.json', {
      width: 1200,
      height: 800,
      x: undefined,
      y: undefined,
      isMaximized: false
    });
  }

  /**
   * Save window state to storage
   */
  static saveWindowState(state: any): StorageResult<void> {
    return this.save('window-state.json', state);
  }

  /**
   * Load unified app config from storage
   */
  static loadAppConfig(): StorageResult<any> {
    const defaultConfig = {
      projects: [],
      panels: [],
      settings: {
        editor: {
          theme: 'vibe-term'
        },
        desktop: {
          notifications: true
        },
        webServer: {
          enabled: true,
          port: 6969
        },
        discord: {
          enabled: false,
          username: 'Vibe Term',
          webhookUrl: ''
        }
      }
    };
    return this.load('app-config.json', defaultConfig);
  }

  /**
   * Save unified app config to storage
   */
  static saveAppConfig(config: any): StorageResult<void> {
    return this.save('app-config.json', config);
  }

}