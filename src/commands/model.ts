import { ChatInputCommandInteraction, SlashCommandBuilder, Client, MessageFlags } from 'discord.js';
import { setUserModel } from '../database';
import { AVAILABLE_MODELS, getModelDisplayName } from '../models';

export const command = new SlashCommandBuilder()
  .setName('model')
  .setDescription('Select the AI model to use for your conversations')
  .addStringOption(option =>
    option
      .setName('model')
      .setDescription('The model to use')
      .setRequired(true)
      .addChoices(
        ...AVAILABLE_MODELS.map(m => ({
          name: `${m.name} (${m.provider})`,
          value: m.id,
        }))
      )
  )
  .toJSON();

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  const modelId = interaction.options.getString('model', true);
  const userId = interaction.user.id;
  const username = interaction.user.username;

  console.log(`[COMMAND] /model - User: ${username} (${userId}), Model: ${modelId}`);

  try {
    setUserModel(userId, modelId);
    const displayName = getModelDisplayName(modelId);
    
    console.log(`[COMMAND] /model - Successfully set model to ${displayName} for user ${username}`);
    
    await interaction.reply({
      content: `✅ Your model has been set to **${displayName}**!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error('[COMMAND] /model - Error setting model:', error);
    await interaction.reply({
      content: '❌ Failed to set model. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
