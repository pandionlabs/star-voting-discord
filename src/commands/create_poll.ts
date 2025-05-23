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

export const data = new SlashCommandBuilder()
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

export async function execute(
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
