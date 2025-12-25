import { ChatInputCommandInteraction, SlashCommandBuilder, Client, MessageFlags } from 'discord.js';
import { isApprovedAdmin, unbanUser, isUserBanned } from '../database';

export const command = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from using AI features (Admin only)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to unban')
      .setRequired(true)
  )
  .toJSON();

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  
  console.log(`[COMMAND] /unban - User: ${username} (${userId})`);
  
  // Check if user is an approved admin
  if (!isApprovedAdmin(userId)) {
    console.log(`[COMMAND] /unban - Access denied for ${username} (${userId})`);
    await interaction.reply({
      content: '❌ You do not have permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  
  const targetUser = interaction.options.getUser('user', true);
  
  try {
    if (!isUserBanned(targetUser.id)) {
      await interaction.reply({
        content: `ℹ️ <@${targetUser.id}> is not currently banned.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    
    const success = unbanUser(targetUser.id);
    
    if (success) {
      console.log(`[COMMAND] /unban - ${username} unbanned ${targetUser.username} (${targetUser.id})`);
      await interaction.reply({
        content: `✅ <@${targetUser.id}> has been unbanned and can now use AI features again.`,
      });
    } else {
      await interaction.reply({
        content: '❌ Failed to unban user. They may not be banned.',
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error('[COMMAND] /unban - Error unbanning user:', error);
    await interaction.reply({
      content: '❌ Failed to unban user. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
