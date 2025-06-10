import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { Poll } from "../models/index";
import { PollResults } from "../star-voting";

export const nVotersCommand = new SlashCommandBuilder()
  .setName("n_voters")
  .setDescription("Get the number of voters for a specific poll")
  .addStringOption((option) =>
    option
      .setName("poll_id")
      .setDescription("The ID of the poll")
      .setRequired(true),
  );

export async function nVotersCallback(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const pollId = interaction.options.getString("poll_id", true);

  const poll = await Poll.findByPk(pollId);

  if (!poll) {
    await interaction.reply({
      content: `Poll with ID '${pollId}' not found.`,
      ephemeral: true,
    });
    return;
  }

  const pollResults = await new PollResults(poll).initialize();

  await interaction.reply({
    content: `The poll with ID '${pollId}' has ${pollResults.numVoters} voter(s).`,
  });
}
