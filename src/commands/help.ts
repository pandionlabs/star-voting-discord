import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help with the bot')
  .addStringOption(option => 
    option.setName('echo')
      .setDescription('Echo a message')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const echo = interaction.options.getString('echo');
  
  const embed = new EmbedBuilder()
    .setTitle('Help')
    .setDescription(echo || 'No message provided')
    .setColor('#3498db');
  
  await interaction.reply({ embeds: [embed] });
}