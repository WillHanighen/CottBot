export interface Model {
  id: string;
  name: string;
  provider: string;
  supportsVision?: boolean;
}

export const AVAILABLE_MODELS: Model[] = [
  {
    id: 'moonshotai/kimi-k2',
    name: 'Kimi K2',
    provider: 'Moonshot AI',
    supportsVision: false,
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    supportsVision: true,
  },
  {
    id: 'z-ai/glm-4.7',
    name: 'GLM-4.7',
    provider: 'Z-AI',
    supportsVision: false,
  },
];

export const DEFAULT_MODEL = 'moonshotai/kimi-k2';

export function getModelById(id: string): Model | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id);
}

export function getModelDisplayName(id: string): string {
  const model = getModelById(id);
  return model ? model.name : id;
}

export function modelSupportsVision(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.supportsVision || false;
}
