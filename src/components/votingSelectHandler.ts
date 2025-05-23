import { StringSelectMenuInteraction } from "discord.js";
import { Vote } from "../models/index";

/**
 * Handle star voting select menu interactions
 * This function is called when a user selects a star rating for an option
 */
export default async (
  interaction: StringSelectMenuInteraction,
): Promise<void> => {
  // Get the option ID from the custom ID
  // Format: option_123 where 123 is the option ID
  const customId = interaction.customId;
  const optionId = parseInt(customId.split("_")[1]);
  // Get the selected star value
  const stars = parseInt(interaction.values[0]);
  const userId = interaction.user.id;

  // Check if the user already voted for this option
  const existingVote = await Vote.findOne({
    where: {
      userId: userId,
      optionId: optionId,
    },
  });
  if (existingVote) {
    // Update existing vote
    await existingVote.update({ stars: stars });
    await interaction.reply({
      content: `You changed your vote to ${stars} star${stars !== 1 ? "s" : ""} for: ${(await existingVote.getOption()).format()}`,
      ephemeral: true,
    });
  } else {
    // Create new vote
    await Vote.create({
      userId: userId,
      optionId: optionId,
      stars: stars,
    });

    await interaction.reply({
      content: `You voted with ${stars} star${stars !== 1 ? "s" : ""}!`,
      ephemeral: true,
    });
  }
};
