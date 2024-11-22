/**
 * Parse configuration data from either environment variables, command line
 * arguments, or a local file.  The local file containing the actual
 * configuration should not be checked into source control.
 */
import dotenv from 'dotenv';
dotenv.config()

const config = {
	GUILD_ID: process.env.GUILD_ID,
	DISCORD_TOKEN: process.env.BOT_TOKEN,
	DISCORD_CLIENT_ID: process.env.VITE_CLIENT_ID,
	DISCORD_CLIENT_SECRET: process.env.CLIENT_SECRET,
	DISCORD_REDIRECT_URI: process.env.VITE_BASE_URL + "/api/discord-oauth-callback",
	COOKIE_SECRET: process.env.COOKIE_SECRET,
};

export default config;
