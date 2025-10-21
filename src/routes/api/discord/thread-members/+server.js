import {fetchSettings} from "$lib/supabase";
import dotenv from 'dotenv';
dotenv.config()

const discordToken = process.env.BOT_TOKEN;

let scheme = {};

// Function to fetch settings
async function loadSettings() {
    scheme = await fetchSettings(); // Fetch settings from the database
}

export async function PUT({ request }) {
	await loadSettings();
	console.log(request);
	const params = await request.json();
	console.log("BODY", JSON.stringify(params));

	// Add member to thread
	const response = await fetch(
		`https://discord.com/api/v10/channels/${params.id}/thread-members/${params.user_id}`,
		{
			method: "PUT",
			headers: {
				Authorization: `Bot ${discordToken}`,
				"Content-Type": "application/json",
			},
		}
	);
	const data = await response.json();
	console.log("THREAD DATA", data);
	return new Response(JSON.stringify(data), { status: 300 });
}
