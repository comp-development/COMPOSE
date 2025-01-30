import * as discord from "../../../lib/discord/discord.js";

import { redirect } from "@sveltejs/kit";

import { getThisUser } from "$lib/supabase";

export async function GET({ request, url, cookies }) {
	const userId = url.searchParams.get("userId");
	console.log(userId);
	const { state, authUrl } = discord.getOAuthUrl(userId);

	console.log("URL", authUrl);

	cookies.set("clientState", state, { maxAge: 1000 * 60 * 5, signed: true });
	cookies.set("userId", userId, { maxAge: 1000 * 60 * 5 });
	//cookies.set("userId", user.id, { maxAge: 1000 * 60 * 5 });
	throw redirect(308, authUrl);
}
