import { rest } from "./discordBot.js";
import config from "./config.js";
console.log("CONFIG", config)
const commands = [
    {
        name: "ping",
        description: "Checks if bot is online - should respond pong",
    },
    {
        name: "feedback",
        description: "Provide feedback on the current problem",
        options: [
            {
                name: "feedback",
                description: "Your feedback for the problem",
                type: 3,
                required: true
            },
            {
                name: "answer",
                description: "Your answer if you solved the problem",
                type: 3,
            },
            {
                name: "correct",
                description: "Was your answer correct?",
                type: 5,
            },
            {
                name: "difficulty",
                description: "Difficulty Rating (/10)",
                type: 4,
                min_value: 1,
                max_value: 10,
            },
            {
                name: "quality",
                description: "Quality Rating (/10)",
                type: 4,
                min_value: 1,
                max_value: 10,
            },
            {
                name: "author",
                description: "Who gave the feedback (if not yourself)",
                type: 6,
            }
        ]
    }
];

export async function registerCommands(isDevelopment = false) {
    try {
        const resetGlobalCommands = async () => {
            const globalRoute = `/applications/${config.DISCORD_CLIENT_ID}/commands`;
            await rest.put(globalRoute, { body: [] });
            console.log("Successfully registered global commands");
        };

        await resetGlobalCommands();

        const route = `/applications/${config.DISCORD_CLIENT_ID}/guilds/${config.GUILD_ID}/commands`;
        await rest.put(route, { body: commands });
        console.log("Successfully registered guild commands.");
    } catch (error) {
        console.error("Error registering commands:", error);
    }
}