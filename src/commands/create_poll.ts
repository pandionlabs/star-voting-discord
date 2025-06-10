import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
} from "discord.js";
import { Poll, Option, sequelize } from "../models/index";
import { emojiNumberMap } from "../utils";
import { StringSelectMenuInteraction } from "discord.js";
import { Vote } from "../models/index";

export const createPollCommand = new SlashCommandBuilder()
  .setName("create_poll")
  .setDescription("Create a STAR voting poll")
  .addStringOption((option) =>
    option
      .setName("question")
      .setDescription("The question for the poll")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("option1")
      .setDescription("First option for the poll")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("option2")
      .setDescription("Second option for the poll")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("option3")
      .setDescription("Third option for the poll")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("option4")
      .setDescription("Fourth option for the poll")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("option5")
      .setDescription("Fifth option for the poll")
      .setRequired(false),
  );

export async function createPollCallback(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const question = interaction.options.getString("question", true);
  const option1 = interaction.options.getString("option1", true);
  const option2 = interaction.options.getString("option2", true);
  const option3 = interaction.options.getString("option3");
  const option4 = interaction.options.getString("option4");
  const option5 = interaction.options.getString("option5");

  // Filter out empty options
  const optionTexts = [option1, option2, option3, option4, option5].filter(
    Boolean,
  );

  // Use a transaction to ensure data consistency
  const result = await sequelize.transaction(async (t) => {
    // Create poll
    const poll = await Poll.create(
      {
        question: question,
      },
      { transaction: t },
    );

    // Create options
    const options = await Promise.all(
      optionTexts.map((text, index) =>
        Option.create(
          {
            text: text as string,
            pollId: poll.id,
            index: index,
          },
          { transaction: t },
        ),
      ),
    );

    return { poll, options };
  });

  // Create select menus for each option
  const components = result.options.map((option, i) => {
    const emojiPrefix = emojiNumberMap[i];

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`option_${option.id}`)
        .setPlaceholder(
          `${emojiPrefix} select stars to vote on: ${option.text}`,
        )
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel(`${emojiPrefix} ⭐`)
            .setValue("1")
            .setDescription("1 star"),
          new StringSelectMenuOptionBuilder()
            .setLabel(`${emojiPrefix} ⭐⭐`)
            .setValue("2")
            .setDescription("2 stars"),
          new StringSelectMenuOptionBuilder()
            .setLabel(`${emojiPrefix} ⭐⭐⭐`)
            .setValue("3")
            .setDescription("3 stars"),
          new StringSelectMenuOptionBuilder()
            .setLabel(`${emojiPrefix} ⭐⭐⭐⭐`)
            .setValue("4")
            .setDescription("4 stars"),
          new StringSelectMenuOptionBuilder()
            .setLabel(`${emojiPrefix} ⭐⭐⭐⭐⭐`)
            .setValue("5")
            .setDescription("5 stars"),
          new StringSelectMenuOptionBuilder()
            .setLabel(`${emojiPrefix} ABSTAIN`)
            .setValue("0")
            .setDescription("Abstain"),
        ]),
    );
  });

  const embed = new EmbedBuilder()
    .setTitle(
      `Vote now: ${question.substring(0, 10)}${question.length > 10 ? "..." : ""}`,
    )
    .setDescription("Here is your STAR voting poll.")
    .addFields([
      { name: "Question", value: question },
      {
        name: "Options",
        value: result.options
          .map((option) => `- ${option.format()}`)
          .join("\n"),
      },
    ])
    .setColor(0x006633)
    .setFooter({
      text: `Poll ID: ${result.poll.id} (use \`/results ${result.poll.id}\` to view results)`,
    });

  await interaction.reply({
    content: `Poll created (id: ${result.poll.id}): ${question}`,
    embeds: [embed],
    components: components,
  });
}

/**
 * Handle star voting select menu interactions
 * This function is called when a user selects a star rating for an option
 */
export const votingSelectHandler = async (
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
