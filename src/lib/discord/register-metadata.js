import fetch from "node-fetch";
import config from "./config.js";

export async function registerMetadata() {
    const url = `https://discord.com/api/v10/applications/${config.DISCORD_CLIENT_ID}/role-connections/metadata`;
    
    const body = [
        {
            key: "verified",
            name: "Verified",
            description: "Is Verified on COMPOSE",
            type: 7,
        },
        {
            key: "problemswritten",
            name: "Problems Written",
            description: "Number of Problems Written",
            type: 2,
        },
        {
            key: "unresolvedfeedback",
            name: "Unresolved Feedback",
            description: "Total Unresolved Feedback",
            type: 2,
        }
    ];

    try {
        const response = await fetch(url, {
            method: "PUT",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bot ${config.DISCORD_TOKEN}`,
            },
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("Successfully registered metadata:", data);
        } else {
            const error = await response.text();
            console.error("Failed to register metadata:", error);
        }
    } catch (error) {
        console.error("Error registering metadata:", error);
    }
}