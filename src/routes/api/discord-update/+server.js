import { WebhookClient } from "discord.js";
import {fetchSettings} from "$lib/supabase";

let scheme = {};

// Function to fetch settings
async function loadSettings() {
    scheme = await fetchSettings(); // Fetch settings from the database
}

export async function POST({ request }) {
	await loadSettings();
	let token = import.meta.env.VITE_CLIENT_TOKEN;
	let id = import.meta.env.VITE_CLIENT_ID;
	const body = await request.json();

	try {
		const webhookClient = new WebhookClient({ id: id, token: token });

		await webhookClient.send({
			username: "Problem Writing Platform",
			avatarURL: scheme.logo,
			content: body.updater + " " + body.update + " problem " + body.id,
		});

		return new Response("Works!", {
			status: 200,
			headers: { "content-type": "application/text" },
		});
	} catch (e) {
		const message = "Error in updating discord webhook: " + e.message;
		console.error(message)
		return new Response(message, {
			status: 400,
		});
	}
}
