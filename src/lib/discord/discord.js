import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

import { upsertUserData } from "$lib/supabase";

import * as storage from "./storage.js";
import config from "./config.js";
/**
 * Code specific to communicating with the Discord API.
 */

/**
 * The following methods all facilitate OAuth2 communication with Discord.
 * See https://discord.com/developers/docs/topics/oauth2 for more details.
 */

/**
 * Generate the url which the user will be directed to in order to approve the
 * bot, and see the list of requested scopes.
 */
export function getOAuthUrl(userId) {
	console.log("config", config);
	const state = uuidv4();
	console.log("STATE", state);
	const url = new URL("https://discord.com/api/oauth2/authorize");
	url.searchParams.set("client_id", config.DISCORD_CLIENT_ID);
	url.searchParams.set("redirect_uri", config.DISCORD_REDIRECT_URI);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("state", state);
	url.searchParams.set("userId", userId);
	url.searchParams.set("scope", "email role_connections.write identify");
	url.searchParams.set("prompt", "consent");
	return { state, authUrl: url.toString() };
}

/**
 * Given an OAuth2 code from the scope approval page, make a request to Discord's
 * OAuth2 service to retreive an access token, refresh token, and expiration.
 */
export async function getOAuthTokens(code) {
	console.log("client_id", config.DISCORD_CLIENT_ID);
	console.log("client_secret", config.DISCORD_CLIENT_SECRET);
	console.log("code", code);
	console.log("redirect_uri", config.DISCORD_REDIRECT_URI);
	const url = "https://discord.com/api/v10/oauth2/token";
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: config.DISCORD_REDIRECT_URI,
	});

	const response = await fetch(url, {
		body,
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Authorization": `Basic ${Buffer.from(`${config.DISCORD_CLIENT_ID}:${config.DISCORD_CLIENT_SECRET}`).toString('base64')}`,
		},
	});
	console.log("response", response);
	if (response.ok) {
		const data = await response.json();
		return data;
	} else {
		throw new Error(
			`Error fetching OAuth tokens: [${response.status}] ${response.statusText}`
		);
	}
}

/**
 * The initial token request comes with both an access token and a refresh
 * token.  Check if the access token has expired, and if it has, use the
 * refresh token to acquire a new, fresh access token.
 */
export async function getAccessToken(userId, tokens) {
	if (Date.now() > tokens.expires_at) {
		const url = "https://discord.com/api/v10/oauth2/token";
		const body = new URLSearchParams({
			client_id: config.DISCORD_CLIENT_ID,
			client_secret: config.DISCORD_CLIENT_SECRET,
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
		});
		const response = await fetch(url, {
			body,
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		});
		if (response.ok) {
			const tokens = await response.json();
			tokens.access_token = tokens.access_token;
			tokens.expires_at = Date.now() + tokens.expires_in * 1000;
			const updates = {
				discord_id: userId,
				discord_tokens: tokens,
			};
			await upsertUserData(updates, "discord_id");
			//await storage.storeDiscordTokens(userId, tokens);
			return tokens.access_token;
		} else {
			throw new Error(
				`Error refreshing access token: [${response.status}] ${response.statusText}`
			);
		}
	}
	return tokens.access_token;
}

/**
 * Given a user based access token, fetch profile information for the current user.
 */
export async function getUserData(tokens) {
	const url = "https://discord.com/api/v10/oauth2/@me";
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${tokens.access_token}`,
		},
	});
	if (response.ok) {
		const data = await response.json();
		return data;
	} else {
		throw new Error(
			`Error fetching user data: [${response.status}] ${response.statusText}`
		);
	}
}

/**
 * Given metadata that matches the schema, push that data to Discord on behalf
 * of the current user.
 */
export async function pushMetadata(userId, tokens, metadata) {
	// GET/PUT /users/@me/applications/:id/role-connection
	const url = `https://discord.com/api/v10/users/@me/applications/${config.DISCORD_CLIENT_ID}/role-connection`;
	const accessToken = await getAccessToken(userId, tokens);
	const body = {
		platform_name: "COMPOSE",
		metadata,
	};
	const response = await fetch(url, {
		method: "PUT",
		body: JSON.stringify(body),
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});
	if (!response.ok) {
		throw new Error(
			`Error pushing discord metadata: [${response.status}] ${response.statusText}`
		);
	}
}

/**
 * Fetch the metadata currently pushed to Discord for the currently logged
 * in user, for this specific bot.
 */
export async function getMetadata(userId, tokens) {
	// GET/PUT /users/@me/applications/:id/role-connection
	const url = `https://discord.com/api/v10/users/@me/applications/${config.DISCORD_CLIENT_ID}/role-connection`;
	const accessToken = await getAccessToken(userId, tokens);
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});
	if (response.ok) {
		const data = await response.json();
		return data;
	} else {
		throw new Error(
			`Error getting discord metadata: [${response.status}] ${response.statusText}`
		);
	}
}
