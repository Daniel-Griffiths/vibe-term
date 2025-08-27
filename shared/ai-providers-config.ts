export interface AIProvider {
  id: string;
  name: string;
  command: string;
  dangerousFlag: string;
  versionFlag: string;
  color?: string;
  icon?: string;
}

export const AI_PROVIDERS_CONFIG: AIProvider[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    dangerousFlag: '--dangerously-skip-permissions',
    versionFlag: '--version',
    color: '#FF6B35',
    icon: 'robot'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    command: 'gemini',
    dangerousFlag: '--yolo',
    versionFlag: '--version',
    color: '#4285F4',
    icon: 'sparkles'
  },
  {
    id: 'qwen',
    name: 'Qwen',
    command: 'qwen',
    dangerousFlag: '--yolo',
    versionFlag: '--version',
    color: '#1890FF',
    icon: 'cpu'
  },
  {
    id: 'cursor-agent',
    name: 'Cursor Agent',
    command: 'cursor-agent',
    dangerousFlag: '--force',
    versionFlag: '--version',
    color: '#00D4FF',
    icon: 'cursor'
  },
  {
    id: 'codestral',
    name: 'Codestral',
    command: 'codestral',
    dangerousFlag: '--unsafe',
    versionFlag: '--version',
    color: '#FF4500',
    icon: 'code'
  }
];

export function getAIProvider(id: string): AIProvider | undefined {
  return AI_PROVIDERS_CONFIG.find(provider => provider.id === id);
}

export function getDefaultAIProvider(): AIProvider {
  return AI_PROVIDERS_CONFIG[0]; // Default to first provider (Claude)
}

export function getAIProviderIds(): string[] {
  return AI_PROVIDERS_CONFIG.map(provider => provider.id);
}

export function getAIProviderCommands(): Record<string, string[]> {
  const commands: Record<string, string[]> = {};
  AI_PROVIDERS_CONFIG.forEach(provider => {
    commands[provider.id] = [`${provider.command} ${provider.versionFlag}`];
  });
  return commands;
}

export function getAIProviderBaseCommands(): Record<string, string[]> {
  const commands: Record<string, string[]> = {};
  AI_PROVIDERS_CONFIG.forEach(provider => {
    commands[provider.id] = [`${provider.command} ${provider.versionFlag}`];
  });
  return commands;
}