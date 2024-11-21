import {fetchSettings} from "$lib/supabase";
import dotenv from 'dotenv';
dotenv.config()

const discordToken = process.env.BOT_TOKEN;

let scheme = {};

// Function to fetch settings
async function loadSettings() {
    scheme = await fetchSettings(); // Fetch settings from the database
}

async function getOrCreateTags(channelId, desiredTags) {
    // Get channel object
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
        headers: {
            Authorization: `Bot ${discordToken}`
        }
    });
    
    // Turn into JSON
    const channel = await response.json();

    let availableTags = channel.available_tags || [];

    // Add tags if they don't exist
    const existingTagNames = availableTags.map(tag => tag.name);
    const missingTags = desiredTags.filter(tag => !existingTagNames.includes(tag));

    // Create missing tags if any
    if (missingTags.length > 0) {
        const newTags = [...availableTags, ...missingTags.map(name => ({ name, moderated: false}))];

        const updateResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${discordToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ available_tags: newTags })
        });
        const updatedChannel = await updateResponse.json();
        availableTags = updatedChannel.available_tags;
    }

    return availableTags
        .filter(tag => desiredTags.includes(tag.name))
        .map(tag => tag.id)
        .slice(0, 5); // Discord limit of 5 tags
}

export async function POST({ request }) {
    const { channelId, tags } = await request.json();
    const tagIds = await getOrCreateTags(channelId, tags);
    return new Response(JSON.stringify({ tagIds }));
}