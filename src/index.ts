import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  REST,
  Routes,
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { config } from "dotenv";
import { syncDatabase } from "./models/index";
import {
  createPollCommand,
  createPollCallback,
  votingSelectHandler,
} from "./commands/create_poll";
import { resultsCommand, resultsCallback } from "./commands/results";
import { nVotersCommand, nVotersCallback } from "./commands/n_voters";
// Load environment variables
config();

// Check for required environment variables
if (!process.env.DISCORD_TOKEN || !process.env.GUILD_ID) {
  console.error(
    "Missing required environment variables. Please check your .env file.",
  );
  process.exit(1);
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

interface Command {
  name: string;
  slashCommand: SlashCommandOptionsOnlyBuilder;
  callback: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Collection<string, Command>();
commands.set("create_poll", {
  name: "create_poll",
  slashCommand: createPollCommand,
  callback: createPollCallback,
});
commands.set("results", {
  name: "results",
  slashCommand: resultsCommand,
  callback: resultsCallback,
});
commands.set("n_voters", {
  name: "n_voters",
  slashCommand: nVotersCommand,
  callback: nVotersCallback,
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`,
      );
      return;
    }

    try {
      await command["callback"](interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an error executing this command!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error executing this command!",
          ephemeral: true,
        });
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    // Handle select menu interactions
    if (interaction.customId.startsWith("option_")) {
      try {
        await votingSelectHandler(interaction);
      } catch (error) {
        console.error("Error handling select menu interaction:", error);
        await interaction.reply({
          content: "There was an error processing your selection!",
          ephemeral: true,
        });
      }
    }
  }
});

// Register slash commands
const deployCommands = async (): Promise<void> => {
  const commandMessages = Array.from(commands.values()).map((command) =>
    command.slashCommand.toJSON(),
  );

  const rest = new REST().setToken(process.env.DISCORD_TOKEN || "");

  try {
    console.log(
      `Started refreshing ${commandMessages.length} application (/) commands.`,
    );

    // Deploy commands to the specified guild
    if (client.user) {
      const data = await rest.put(
        Routes.applicationGuildCommands(
          client.user.id,
          process.env.GUILD_ID || "",
        ),
        { body: commandMessages },
      );

      console.log(
        `Successfully reloaded ${Array.isArray(data) ? data.length : 0} application (/) commands.`,
      );
    }
  } catch (error) {
    console.error(error);
  }
};

// When the client is ready, sync the database and register commands
client.once(Events.ClientReady, async (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);

  // Sync database models
  await syncDatabase();

  // Deploy commands
  await deployCommands();
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);
