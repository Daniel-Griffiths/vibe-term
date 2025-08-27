import type { AIProvider } from '../../shared/ai-providers-config';
import { AI_PROVIDERS_CONFIG as AI_PROVIDERS, getAIProvider, getDefaultAIProvider } from '../../shared/ai-providers-config';
import { ShellUtils } from './shell-utils';

export class AIProviderService {
  /**
   * Get all available AI providers
   */
  static getAllProviders(): AIProvider[] {
    return AI_PROVIDERS;
  }

  /**
   * Get AI provider by ID, fallback to default if not found
   */
  static getProvider(providerId?: string): AIProvider {
    if (!providerId) {
      return getDefaultAIProvider();
    }
    
    return getAIProvider(providerId) || getDefaultAIProvider();
  }

  /**
   * Check if an AI provider is available on the system
   */
  static async checkProviderAvailability(providerId: string): Promise<boolean> {
    const provider = getAIProvider(providerId);
    if (!provider) {
      return false;
    }

    return await ShellUtils.checkDependency(provider.command);
  }

  /**
   * Check availability of all AI providers
   */
  static async checkAllProvidersAvailability(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const provider of AI_PROVIDERS) {
      results[provider.id] = await this.checkProviderAvailability(provider.id);
    }
    
    return results;
  }

  /**
   * Generate the command for starting an AI session
   */
  static generateStartCommand(
    provider: AIProvider,
    projectPath: string,
    runCommand?: string,
    yoloMode?: boolean
  ): string {
    let command = provider.command;

    // Add dangerous/yolo flag if enabled
    if (yoloMode) {
      command += ` ${provider.dangerousFlag}`;
    }

    // Add run command if specified
    if (runCommand) {
      command += ` "${runCommand}"`;
    }

    return command;
  }

  /**
   * Get missing AI dependencies (providers that should be available but aren't)
   */
  static async getMissingDependencies(): Promise<string[]> {
    const availability = await this.checkAllProvidersAvailability();
    const missing: string[] = [];

    for (const provider of AI_PROVIDERS) {
      if (!availability[provider.id]) {
        missing.push(provider.command);
      }
    }

    return missing;
  }

  /**
   * Get the default AI provider from settings or fallback
   */
  static getDefaultProvider(settings?: { ai?: { defaultProvider?: string } }): AIProvider {
    const defaultId = settings?.ai?.defaultProvider;
    return this.getProvider(defaultId);
  }
}