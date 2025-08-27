// Re-export everything from the centralized config
export type {
  AIProvider
} from '../../shared/ai-providers-config';

export {
  AI_PROVIDERS_CONFIG as AI_PROVIDERS,
  getAIProvider,
  getDefaultAIProvider,
  getAIProviderIds,
  getAIProviderCommands
} from '../../shared/ai-providers-config';