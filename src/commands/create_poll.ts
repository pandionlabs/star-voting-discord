import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { Poll, Option, sequelize } from "../models/index";

const emojiNumberMap: Record<number, string> = {
  0: "1️⃣",
  1: "2️⃣",
  2: "3️⃣",
  3: "4️⃣",
  4: "5️⃣",
};

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

  try {
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

    await interaction.reply({
      content: `Poll created (id: ${result.poll.id}): ${question}`,
      components: components,
    });
  } catch (error) {
    console.error("Error creating poll:", error);
    await interaction.reply({
      content: "There was an error creating your poll. Please try again later.",
      ephemeral: true,
    });
  }
}
