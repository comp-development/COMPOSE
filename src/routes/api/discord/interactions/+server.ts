import nacl from "tweetnacl"
import {fetchSettings, addProblemFeedback} from "$lib/supabase";
import { supabase } from "$lib/supabaseAPIClient";
import {
	InteractionResponseType,
	InteractionType,
	MessageComponentTypes,
} from "discord-interactions";
import dotenv from 'dotenv';
dotenv.config()


const discordToken = process.env.BOT_TOKEN;

const PUBLIC_KEY = process.env.VITE_BOT_PUBLIC_KEY;
let scheme = {};

// Function to fetch settings
async function loadSettings() {
    scheme = await fetchSettings(); // Fetch settings from the database
}
//Change
async function verifyRequest(req, body) {
	const signature = req.headers.get("x-signature-ed25519");
	const timestamp = req.headers.get("x-signature-timestamp");
	console.log(signature, timestamp)
	const isVerified = nacl.sign.detached.verify(
		Buffer.from(timestamp + body),
		Buffer.from(signature, "hex"),
		Buffer.from(PUBLIC_KEY, "hex")
	);
	console.log(isVerified);
	return isVerified;
}

class JsonResponse extends Response {
	constructor(body, init) {
		const jsonBody = JSON.stringify(body);
		init = init || {
			headers: {
				"content-type": "application/json;charset=UTF-8",
			},
		};
		super(jsonBody, init);
	}
}

export async function GET({ request }) {
    try {
        return new Response("Here!", {
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        await loadSettings();
		console.log("DISCORD INTERACTIONS")
		const body = await request.text()
        const isValidRequest = await verifyRequest(request, body);
		
        let text = JSON.parse(body);

        if (!isValidRequest) {
            return new Response("Invalid request signature", { 
                status: 401, 
                statusText: "Unauthorized",
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        }

        // Handle different interaction types
        switch (text.type) {
            case InteractionType.PING:
				console.log("PING!")
                return new JsonResponse({
                    type: InteractionResponseType.PONG
                });
                
            case InteractionType.APPLICATION_COMMAND:
                return handleCommand(text);
                
            case InteractionType.MESSAGE_COMPONENT:
                return handleComponent(text);
                
            case InteractionType.MODAL_SUBMIT:
                return handleModalSubmit(text);
            
            default:
                return new JsonResponse({
                    type: InteractionResponseType.PONG
                });
        }
    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(error.message, { 
            status: 500,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }
}

async function handleCommand(interaction) {
	const { data: { name, options } } = interaction;

	switch (name) {
		case "ping":
			return new JsonResponse({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					flags: 64
					content: "Pong!",
					flags: 64,
					components: [{
						type: MessageComponentTypes.ACTION_ROW,
						components: [{
							type: MessageComponentTypes.BUTTON,
							style: 1,
							custom_id: "ping_button",
							label: "Click me!"
						}]
					}]
				}
			});

		case "feedback":
			if (interaction.type === InteractionType.APPLICATION_COMMAND) {
				// First, defer the response
				const deferResponse = new JsonResponse({
					type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: 64 // Ephemeral
					}
				});

				// Send the defer response
				await fetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, {
					method: 'POST',
					body: JSON.stringify({
						type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
						data: {
							flags: 64 // Ephemeral
						}
					}),
					headers: {
						'Content-Type': 'application/json',
					}
				});

				// Process the feedback
				const result = await handleFeedback(interaction);

				// Send the follow-up message
				await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
					method: 'PATCH',
					body: JSON.stringify(result),
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bot ${discordToken}`
					}
				});

				return deferResponse;
			}
			break;
	}
}

async function handleFeedback(interaction) {
	const channelId = interaction.channel_id;
	const options = interaction.data.options;
	// 1. Get the problem from the channel ID
	console.log("channelId", channelId)
	await supabase.auth.setSession({
        access_token: 'custom_discord_bot_token',
        refresh_token: '',
        user: {
            id: 'discord_bot',
            role: 'discord_bot'
        }
    });
	await supabase.rpc('set_config', {
        parameter: 'app.discord_channel_id',
        value: channelId
    });
	const { data: problem } = await supabase
		.from('problems')
		.select('*')
		.eq("discord_id", channelId)
		.single();
	console.log("PROBLEM", problem)
	if (!problem) {
		return {
			content: 'No problem detected - make sure to use the command in the problem specific thread!',
			flags: 64
		};
	}

	// 2. Determine feedback author
	const authorOption = options.find(opt => opt.name === 'author');
	console.log("AUTHOR", authorOption)
	const feedbackGiverId = authorOption ? authorOption.value : interaction.member.user.id;

	// 3. Verify user exists in database
	const { data: user } = await supabase
		.from('users')
		.select('*')
		.eq('discord_id', feedbackGiverId)
		.single();

	if (!user) {
		return {
			content: 'The author does not have permissions. Make sure they have a COMPOSE account, and have connected their discord!',
			flags: 64
		};
	}

	// 4. Prepare feedback data
	const feedbackData = {
		problem_id: problem.id,
		solver_id: user.id,
		feedback: options.find(opt => opt.name === 'feedback')?.value,
		answer: options.find(opt => opt.name === 'answer')?.value ?? null,
		correct: options.find(opt => opt.name === 'correct')?.value ?? null,
		difficulty: options.find(opt => opt.name === 'difficulty')?.value ?? null,
		quality: options.find(opt => opt.name === 'quality')?.value ?? null
	};

	console.log("FEEDBACKDATA", feedbackData)

	// 5. Add feedback to database
	await addProblemFeedback([feedbackData], supabase);

	return {
		content: 'Feedback submitted successfully!',
		flags: 64
	};
}

async function handleComponent(interaction) {
	const { data: { custom_id } } = interaction;

	if (custom_id === "ping_button") {
		return new JsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: "Button clicked!",
				flags: 64 // Ephemeral - only visible to the user who clicked
			}
		});
	}
}

async function handleModalSubmit(interaction) {
	const { data: { custom_id, components } } = interaction;

	if (custom_id === "problem_modal") {
		const problemTitle = components[0].components[0].value;
		return new JsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: `Created problem: ${problemTitle}`,
				flags: 64
			}
		});
	}
}
