import { ChatInputCommandInteraction, SlashCommandBuilder, Client, MessageFlags } from 'discord.js';
import { isApprovedAdmin, banUser } from '../database';

export const command = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user from using AI features (Admin only)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to ban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the ban (optional)')
      .setRequired(false)
      .setMaxLength(500)
  )
  .toJSON();

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  
  console.log(`[COMMAND] /ban - User: ${username} (${userId})`);
  
  // Check if user is an approved admin
  if (!isApprovedAdmin(userId)) {
    console.log(`[COMMAND] /ban - Access denied for ${username} (${userId})`);
    await interaction.reply({
      content: '❌ You do not have permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  
  const targetUser = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason');
  
  if (targetUser.id === userId) {
    await interaction.reply({
      content: '❌ You cannot ban yourself.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  
  if (targetUser.id === client.user!.id) {
    await interaction.reply({
      content: '❌ You cannot ban the bot.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  
  try {
    banUser(targetUser.id, userId, reason || undefined);
    console.log(`[COMMAND] /ban - ${username} banned ${targetUser.username} (${targetUser.id})${reason ? ` - Reason: ${reason}` : ''}`);
    
    await interaction.reply({
      content: `✅ <@${targetUser.id}> has been banned from using AI features.${reason ? `\nReason: ${reason}` : ''}`,
    });
  } catch (error) {
    console.error('[COMMAND] /ban - Error banning user:', error);
    await interaction.reply({
      content: '❌ Failed to ban user. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
