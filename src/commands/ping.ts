import { ChatInputCommandInteraction, SlashCommandBuilder, Client } from 'discord.js';

export const command = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!')
  .toJSON();

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  
  console.log(`[COMMAND] /ping - User: ${username} (${userId})`);
  
  const startTime = Date.now();
  await interaction.reply({ content: 'Pong!' });
  const roundtrip = Date.now() - startTime;
  const apiLatency = Math.round(client.ws.ping);
  
  console.log(`[COMMAND] /ping - Roundtrip: ${roundtrip}ms, API latency: ${apiLatency}ms`);
  
  await interaction.editReply(
    `Pong! Roundtrip latency: ${roundtrip}ms. API latency: ${apiLatency}ms`
  );
}
