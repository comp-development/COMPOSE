import { REST } from "@discordjs/rest";
import { Client, GatewayIntentBits, Events } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config()

const token = process.env.BOT_TOKEN;
export const rest = new REST({ version: "10" }).setToken(token);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on(Events.InteractionCreate, async interaction => {
    // Check if the interaction is a slash command
    if (!interaction.isChatInputCommand()) return;

    // Get the command name
    const { commandName } = interaction;

    // Handle different commands
    if (commandName === 'ping') {
        await interaction.reply('Pong!');
    }
    // Add more command handlers here
    // if (commandName === 'yourcommand') {
    //     // Handle your command
    // }
});

client.login(process.env.BOT_TOKEN);

export default client;