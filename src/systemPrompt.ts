import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { setUserSystemPrompt as dbSetUserSystemPrompt, getUserPreferences } from './database';

const PROMPTS_DIR = join(process.cwd(), 'prompts');

export type PromptType = 'femboy' | 'cat-girl' | 'furry';

// Load a prompt from markdown file
async function loadPromptFile(promptType: PromptType): Promise<string> {
  const fileName = `${promptType}.md`;
  const filePath = join(PROMPTS_DIR, fileName);
  
  try {
    if (!existsSync(filePath)) {
      throw new Error(`Prompt file not found: ${fileName}`);
    }
    const content = await readFile(filePath, 'utf-8');
    // Remove markdown headers and return just the content
    return content.replace(/^#.*$/gm, '').trim();
  } catch (error) {
    console.error(`Error loading prompt file ${fileName}:`, error);
    throw error;
  }
}

export async function getUserSystemPrompt(userId: string): Promise<string | null> {
  const prefs = getUserPreferences(userId);
  // Get prompt type (default to femboy if not set)
  const promptType = (prefs?.systemPromptType || 'femboy') as PromptType;
  
  // Always load the prompt from file (ensures latest version)
  try {
    return await loadPromptFile(promptType);
  } catch (error) {
    console.error(`Error loading prompt file ${promptType}:`, error);
    // Fallback to femboy if the selected type fails
    if (promptType !== 'femboy') {
      try {
        return await loadPromptFile('femboy');
      } catch (fallbackError) {
        console.error('Error loading fallback femboy prompt:', fallbackError);
        return null;
      }
    }
    return null;
  }
}

export async function setUserSystemPrompt(userId: string, promptType: PromptType): Promise<void> {
  // Validate prompt type
  if (!['femboy', 'cat-girl', 'furry'].includes(promptType)) {
    throw new Error(`Invalid prompt type: ${promptType}`);
  }
  
  // Verify the prompt file exists
  const fileName = `${promptType}.md`;
  const filePath = join(PROMPTS_DIR, fileName);
  if (!existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${fileName}`);
  }
  
  // Only store the prompt type, not the content (content is loaded from file each time)
  dbSetUserSystemPrompt(userId, '', promptType);
}

export async function getUserPromptType(userId: string): Promise<PromptType | null> {
  const prefs = getUserPreferences(userId);
  if (!prefs || !prefs.systemPromptType) {
    return null;
  }
  
  return prefs.systemPromptType as PromptType;
}

export function getAvailablePromptTypes(): PromptType[] {
  return ['femboy', 'cat-girl', 'furry'];
}