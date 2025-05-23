# STAR Voting Discord Bot

A Discord bot that implements [STAR Voting](https://www.starvoting.org/) (Score Then Automatic Runoff) for polls in Discord servers.

## Features

- Create polls with up to 5 options
- Users vote by giving 0-5 stars for each option
- Each user can only vote once per option
- Users can update their votes

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/star-voting-discord.git
   cd star-voting-discord
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   GUILD_ID=your_discord_server_id
   ```

4. Build the TypeScript code:
   ```
   npm run build
   ```

5. Start the bot:
   ```
   npm start
   ```

6. For development with hot-reload:
   ```
   npm run dev
   ```

## Commands

- `/hello` - Test command to check if the bot is running
- `/help <echo>` - Displays help information with the echoed message
- `/create_poll <question> <option1> <option2> [option3] [option4] [option5]` - Creates a new STAR voting poll

## STAR Voting Explained

STAR Voting works like this:
1. Each voter gives each candidate a score from 0-5 stars
2. The two highest-scoring candidates are finalists
3. Your vote goes to whichever finalist you scored higher (or neither if you gave both the same score)
4. The finalist with the most votes wins

This method allows voters to express their preferences more precisely than traditional voting methods.

## Technical Details

- Built with TypeScript, Node.js, and discord.js v14
- Uses SQLite database with Sequelize ORM
- Implements interactive UI components
- Type-safe codebase with proper TypeScript interfaces

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.