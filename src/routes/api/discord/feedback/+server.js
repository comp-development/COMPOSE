import dotenv from 'dotenv';
dotenv.config()

const discordToken = process.env.BOT_TOKEN;

export async function POST({ request }) {
	console.log(request);
	const body = await request.json();
	console.log("BODY CONTENT:", body.content);
	console.log("BODY", JSON.stringify(body));
	console.log("THREAD ID:", body.threadID);

	// Create new thread and post first message
	const response = await fetch(
		`https://discord.com/api/v10/channels/${body.threadID}/messages`, // Replace with body.threadID
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
	console.log("DATA", data);
	return new Response(JSON.stringify(data), { 
		status: 300,
	});
}
