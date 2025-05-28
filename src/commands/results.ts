import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Poll } from "../models/index";
import { emojiNumberMap } from "../utils";
import { PollResults } from "../star-voting";

export const resultsCommand = new SlashCommandBuilder()
  .setName("results")
  .setDescription("Get the results of a poll")
  .addStringOption((option) =>
    option
      .setName("poll_id")
      .setDescription("The ID of the poll")
      .setRequired(true),
  );

export async function resultsCallback(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const pollId = interaction.options.getString("poll_id", true);

  const poll = await Poll.findByPk(pollId);

  if (!poll) {
    await interaction.reply({
      content: "Poll not found",
      ephemeral: true,
    });
    return;
  }

  const pollResults = await new PollResults(poll).initialize();
  const optionResults = pollResults.optionResults.sort(
    (a, b) => b.option.index - a.option.index,
  );

  const [winner, preferedBy] = pollResults.winnerResult;
  const nVotes = await pollResults.getNVoters();

  const embed = new EmbedBuilder()
    .setTitle(`Poll Results: ${poll.question}`)
    .setDescription("Here are the results of your STAR voting poll.")
    .setColor("#FFD700") // Gold color for stars
    .addFields(
      {
        name: "🏆 Winner",
        value: `${winner.toString()}\n\n net preference of: ${preferedBy.toString()} over second best option`,
        inline: false,
      },
      {
        name: "**All Results**",
        value: optionResults
          .map((result) => `- ${result.toString()}`)
          .join("\n"),
        inline: false,
      },
      {
        name: "number votes",
        value: nVotes.toString(),
        inline: false,
      },
    )
    .setFooter({ text: `STAR Voting Results • Poll ID: ${poll.id}` });

  await interaction.reply({ embeds: [embed] });
}
