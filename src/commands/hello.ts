import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('hello')
  .setDescription('Say hello to the bot');

export async function execute(interaction: CommandInteraction): Promise<void> {
  await interaction.reply("Hey! :one:");
}