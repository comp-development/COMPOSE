import * as discord from "../../../lib/discord/discord.js";
import * as storage from "../../../lib/discord/storage.js";
import * as server from "../../../lib/discord/server.js";
import { redirect } from "@sveltejs/kit";
import { upsertUserData } from "$lib/supabase";

export async function GET({ request, url, cookies }) {
	try {
		console.log("COOKIES", cookies);
		const clientState = cookies.get("clientState");
		const userId = cookies.get("userId");
		//cookies.delete("clientState");
		//cookies.delete("userId");
		console.log(clientState, userId);
		// 1. Uses the code and state to acquire Discord OAuth2 tokens
		console.log("request", request);
		console.log(url);
		const code = url.searchParams.get("code");
		const discordState = url.searchParams.get("state");

		/**
		console.log("USERID", userId);
		console.log(request.headers);
		let symbols = Object.getOwnPropertySymbols(request.headers);
		console.log(symbols);
		let listSymbol = symbols.find(
			(sym) => String(sym) === "Symbol(headers list)"
		);
		symbols = Object.getOwnPropertySymbols(request.headers[listSymbol]);
		console.log(symbols);
		let mapSymbol = symbols.find(
			(sym) => String(sym) === "Symbol(headers map)"
		);
		const cookiesMap = request.headers[listSymbol][mapSymbol];
		console.log("COOKIESMAP", cookiesMap);
		const cookieDict = cookiesMap.get("cookie");
		const cookie = cookieDict["value"];
		console.log(cookie.get("clientState"));
		var match = cookie.match(/clientState=([^&]+)/);
		let clientState;
		if (match) {
			clientState = match[1];
		}
		console.log(clientState);
		*/
		// make sure the state parameter exists
		if (clientState !== discordState) {
			console.error("State verification failed.");
			return new Response("", {
				status: 403,
			});
		}
		console.log("STATE VERIFICATION COMPLETED")
		const tokens = await discord.getOAuthTokens(code);

		// 2. Uses the Discord Access Token to fetch the user profile
		const meData = await discord.getUserData(tokens);
		console.log(meData);
		const userDiscordId = meData.user.id;

		const tokenStruct = {
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expires_at: Date.now() + tokens.expires_in * 1000,
		};
		const updates = {
			id: userId,
			discord_id: userDiscordId,
			discord: meData.user.username,
			discord_tokens: tokenStruct,
		};
		await upsertUserData(updates);
		//await storage.storeDiscordTokens(userDiscordId, tokenStruct);

		// 3. Update the users metadata, assuming future updates will be posted to the `/update-metadata` endpoint
		await server.updateMetadata(userDiscordId);
	} catch (e) {
		console.log("ERROR", e);
		return new Response(e, {
			status: 500,
		});
	}
	throw redirect(308, "/");
}
