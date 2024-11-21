import { getUser } from "$lib/supabase";
import dotenv from 'dotenv';
dotenv.config()

const discordToken = process.env.BOT_TOKEN;

export async function POST({ request }) {
	const body = await request.json();
	console.log("BODY", body);
	//get user's discord ID
	const channel_id = body.channel_id;

	//Send the message
	const response = await fetch(
		`https://discord.com/api/v10/channels/${channel_id}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `Bot ${discordToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body.message),
		}
	);
	const data = await response.json();
	return new Response(data, { status: 300 });
}
