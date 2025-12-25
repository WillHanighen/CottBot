import * as pingCommand from './ping';
import * as systemPromptCommand from './systemPrompt';
import * as modelCommand from './model';
import * as banCommand from './ban';
import * as unbanCommand from './unban';
import { ChatInputCommandInteraction, Client } from 'discord.js';

export interface Command {
  command: any;
  execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
}

// Map of command names to their modules
const commandModules = {
  ping: pingCommand,
  'system-prompt': systemPromptCommand,
  model: modelCommand,
  ban: banCommand,
  unban: unbanCommand,
} as const;

// Get all command builders for registration
export function getCommandBuilders() {
  return Object.values(commandModules).map(cmd => cmd.command);
}

// Get command handler by name
export function getCommandHandler(commandName: string): ((interaction: ChatInputCommandInteraction, client: Client) => Promise<void>) | undefined {
  const module = commandModules[commandName as keyof typeof commandModules];
  return module?.execute;
}
