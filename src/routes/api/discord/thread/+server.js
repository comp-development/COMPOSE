import {fetchSettings} from "$lib/supabase";
import dotenv from 'dotenv';
dotenv.config()

const discordToken = process.env.BOT_TOKEN;

let scheme = {};

// Function to fetch settings
async function loadSettings() {
    scheme = await fetchSettings(); // Fetch settings from the database
}

export async function POST({ request }) {
	await loadSettings();
	console.log(request);
	const body = await request.json();
	console.log("BODY", JSON.stringify(body));

	// Create new thread and post first message
	const response = await fetch(
		`https://discord.com/api/v10/channels/${scheme.discord.notifs_forum}/threads`,
		{
			method: "POST",
			headers: {
				Authorization: `Bot ${discordToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		}
	);
	const data = await response.json();
	console.log("THREAD DATA", data);
	return new Response(JSON.stringify(data), { status: 300 });
}
