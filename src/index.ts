import fs from 'fs';
import path from 'path';
import { Client, GatewayIntentBits, Collection, Events, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { syncDatabase } from './models/index';

// Extend Client interface to include commands
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, any>;
  }
}

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env.DISCORD_TOKEN || !process.env.GUILD_ID) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

// Create a new client instance
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

// Collection for commands
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Register command interaction handler
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    // Handle select menu interactions
    if (interaction.customId.startsWith('option_')) {
      try {
        const votingSelectHandler = (await import('./components/votingSelectHandler')).default;
        await votingSelectHandler(interaction);
      } catch (error) {
        console.error('Error handling select menu interaction:', error);
        await interaction.reply({ 
          content: 'There was an error processing your selection!', 
          ephemeral: true 
        });
      }
    }
  }
});

// Register slash commands
const deployCommands = async (): Promise<void> => {
  const commands = [];
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN || '');

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Deploy commands to the specified guild
    if (client.user) {
      const data = await rest.put(
        Routes.applicationGuildCommands(
          client.user.id, 
          process.env.GUILD_ID || ''
        ),
        { body: commands },
      );

      console.log(`Successfully reloaded ${Array.isArray(data) ? data.length : 0} application (/) commands.`);
    }
  } catch (error) {
    console.error(error);
  }
};

// When the client is ready, sync the database and register commands
client.once(Events.ClientReady, async c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  
  // Sync database models
  await syncDatabase();
  
  // Deploy commands
  await deployCommands();
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);