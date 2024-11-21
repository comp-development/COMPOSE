import { supabase } from "$lib/supabaseClient"; // Your Supabase client initialization

export const defaultSettings = {
	logo: "/logo.png",
	title: "",
};

let cachedSettings = null;
export async function fetchSettings() {
	if (cachedSettings) {
		return cachedSettings; // Return cached settings if already fetched
	}
	const { data, error } = await supabase
		.from("settings")
		.select("settings") // Assuming the 'settings' column contains your JSON file
		.single(); // Fetch a single row

	if (error) {
		console.error("Error fetching settings:", error);
		return {};
	}

	cachedSettings = data?.settings || defaultSettings; // Cache the settings
	return cachedSettings;
}
