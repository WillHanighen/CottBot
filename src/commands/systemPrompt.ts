import { ChatInputCommandInteraction, SlashCommandBuilder, Client, MessageFlags } from 'discord.js';
import { setUserSystemPrompt } from '../systemPrompt';

export const command = new SlashCommandBuilder()
  .setName('system-prompt')
  .setDescription('Select your preferred AI system prompt - changes the personality of the AI')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('The system prompt type to use')
      .setRequired(true)
      .addChoices(
        { name: 'Femboy', value: 'femboy' },
        { name: 'Cat Girl', value: 'cat-girl' },
        { name: 'Furry', value: 'furry' }
      )
  )
  .toJSON();

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  const promptType = interaction.options.getString('type', true) as 'femboy' | 'cat-girl' | 'furry';
  const userId = interaction.user.id;
  const username = interaction.user.username;

  console.log(`[COMMAND] /system-prompt - User: ${username} (${userId}), Prompt Type: ${promptType}`);

  try {
    await setUserSystemPrompt(userId, promptType);
    
    const displayName = promptType === 'cat-girl' ? 'Cat Girl' : 
                        promptType === 'femboy' ? 'Femboy' : 
                        'Furry';
    
    console.log(`[COMMAND] /system-prompt - Successfully set prompt to ${displayName} for user ${username}`);
    
    await interaction.reply({
      content: `✅ Your system prompt has been set to **${displayName}**!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error('[COMMAND] /system-prompt - Error setting system prompt:', error);
    await interaction.reply({
      content: '❌ Failed to set system prompt. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
