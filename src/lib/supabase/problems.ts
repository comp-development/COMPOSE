import { supabase } from "../supabaseClient";
import { getAuthorName } from "./users";
import {
	getUser,
	fetchSettings,
	uploadImage,
	defaultSettings,
} from "$lib/supabase";

let scheme = defaultSettings;

// Function to fetch settings
async function loadSettings() {
	scheme = await fetchSettings(); // Fetch settings from the database
}

export interface ProblemRequest {
	problem_latex: string;
	answer_latex: string;
	solution_latex: string;
	comment_latex?: string;
	author_id: string;
	difficulty?: number;
	nickname?: string;
	sub_topics?: string;
	image_name?: string;
}

export interface ProblemSelectRequest {
	customSelect?: string | null;
	customOrder?: string | null;
	normal?: boolean;
	archived?: boolean;
	after?: Date | null;
	before?: Date | null;
}

export interface ProblemEditRequest {
	problem_latex?: string;
	answer_latex?: string;
	solution_latex?: string;
	comment_latex?: string;
	author_id?: string;
	difficulty?: number;
	nickname?: string;
	sub_topics?: string;
	image_name?: string;
	discord_id?: string;
}

/**
 * Fetches problem based on id
 *
 * @param problem_id
 * @returns problem object
 */
export async function getProblem(problem_id: number) {
	let { data, error } = await supabase
		.from("full_problems")
		.select("*")
		.eq("id", problem_id)
		.single();
	if (error) throw error;
	return data;
}

/**
 * Fetches all test_problems with test_id
 *
 * @param test_id
 * @returns problem list
 */
export async function getTestProblemsByTestId(test_id: string) {
	let { data, error } = await supabase
		.from("test_problems")
		.select("*")
		.eq("test_id", test_id);
	if (error) throw error;
	return data;
}

/**
 * Get front id of problem from id
 *
 * @param problem_id
 * @returns front_id string
 */
async function getFrontID(problem_id: number) {
	let { data, error } = await supabase
		.from("front_ids")
		.select("front_id")
		.eq("problem_id", problem_id)
		.single();

	if (error) throw error;
	return data.front_id;
}

/**
 * Returns all problems from the database.
 * It includes non-archived problems if normal is true, and it includes archived problems if archived is true
 *
 * @param customSelect optional, string
 * @param normal optional, boolean
 * @param archived optional, boolean
 * @returns problem list
 */
export async function getProblems(options: ProblemSelectRequest = {}) {
	let {
		customSelect = "*",
		customOrder = null,
		customEq = { archived: false },
		normal = true,
		archived = false,
		after = null,
		before = null,
	} = options;

	console.log("OPTIONS", options);

	console.log(customSelect, customOrder, normal, archived, after, before);
	let selectQuery = supabase.from("full_problems").select(customSelect);
	if (customOrder) {
		selectQuery = selectQuery.order(customOrder);
	}
	for (const [key, value] of Object.entries(customEq)) {
		selectQuery = selectQuery.eq(key, value);
	}
	if (after) {
		selectQuery = selectQuery.gte("created_at", after.toISOString());
	}
	if (before) {
		selectQuery = selectQuery.lte("created_at", before.toISOString());
	}

	let { data, error } = await selectQuery;
	if (error) throw error;
	return data;
	if (normal && archived) {
		let { data, error } = await supabase
			.from("full_problems")
			.select(customSelect);
		if (error) throw error;
		return data;
	}
	if (normal && !archived) {
		let { data, error } = await supabase
			.from("full_problems")
			.select(customSelect)
			.eq("archived", false);
		if (error) throw error;
		return data;
	}
	if (!normal && archived) {
		let { data, error } = await supabase
			.from("full_problems")
			.select(customSelect)
			.eq("archived", true);
		if (error) throw error;
		return data;
	}
	if (!normal && !archived) {
		return [];
	}
}

/**
 * Makes new Discord thread for a problem upon creation
 *
 * @param problem ProblemRequest (ie a row in the problems table in supabase)
 * @returns Discord thread ID
 */
export async function makeProblemThread(problem: ProblemRequest) {
	await loadSettings();
	const user = await getUser(problem.author_id);

	// Get topics before creating thread
	const problem_topics = await getProblemTopics(
		problem.id,
		"topic_id,global_topics(topic)",
	);
	problem.topicArray = problem_topics.map(
		(x) => x.global_topics?.topic ?? "Unknown Topic",
	);

	// Create the embed
	const embed = {
		title: "Problem " + user.initials + problem.id,
		//description: "This is the description of the embed.",
		type: "rich",
		color: parseInt(scheme.discord.embed_color, 16), // You can set the color using hex values
		author: {
			name: user.full_name,
			//icon_url: "https://example.com/author.png", // URL to the author's icon
		},
		fields: [
			{
				name: "Problem",
				value:
					problem.problem_latex.length > 1023
						? problem.problem_latex.substring(0, 1020) + "..."
						: problem.problem_latex,
				inline: false, // You can set whether the field is inline
			},
			{
				name: "Answer",
				value:
					problem.answer_latex.length > 1019
						? "||" + problem.answer_latex.substring(0, 1016) + "...||"
						: "||" + problem.answer_latex + "||",
				inline: false, // You can set whether the field is inline
			},
			{
				name: "Solution",
				value:
					problem.solution_latex.length > 1019
						? "||" + problem.solution_latex.substring(0, 1016) + "...||"
						: "||" + problem.solution_latex + "||",
				inline: false, // You can set whether the field is inline
			},
			{
				name: "Comments",
				value:
					problem.comment_latex.length > 1019
						? "||" + problem.comment_latex.substring(0, 1016) + "...||"
						: "||" + problem.comment_latex + "||",
				inline: false, // You can set whether the field is inline
			},
		],
		footer: {
			text: "COMPOSE",
			icon_url: scheme.logo, // URL to the footer icon
		},
	};
	let url = scheme.url
	if (!scheme.url.startsWith("http")) {
		url = "http://" + scheme.url
	}
	const viewButton = {
		type: 2, // LINK button component
		style: 5, // LINK style (5) for external links
		label: "View Problem",
		url: url + "/problems/" + problem.id, // The external URL you want to link to
	};
	const solveButton = {
		type: 2, // LINK button component
		style: 5, // LINK style (5) for external links
		label: "Testsolve",
		url: url + "/problems/" + problem.id + "/solve", // The external URL you want to link to
	};
	const tagResponse = await fetch("/api/discord/forum", {
		method: "POST",
		body: JSON.stringify({
			channelId: scheme.discord.notifs_forum,
			tags: problem.topicArray,
		}),
	});
	const { tagIds } = await tagResponse.json();
	console.log("MAKING FETCH");
	const threadResponse = await fetch("/api/discord/thread", {
		method: "POST",
		body: JSON.stringify({
			// channel_id: scheme.discord.notifs_channel,
			message: {
				content: problem.problem_latex + (user.discord_id ? ` <@${user.discord_id}>` : ''),
				embeds: [embed],
				components: [
					{
						type: 1,
						components: [solveButton, viewButton],
					},
				],
			},
			name: embed.title,
			applied_tags: tagIds,
		}),
	});
	console.log("THREAD RESPONSE", threadResponse);
	const threadData = await threadResponse.json();
	console.log("THREAD DATA 2", threadData);
	let success = false;
	if (threadData.id) {
		await editProblem({ discord_id: threadData.id }, problem.id);
		problem.discord_id = threadData.id;
		success = true;
	}
	console.log("AUTHORID", problem.author_id);
	/**
	const response = await fetch("/api/update-metadata", {
		method: "POST",
		body: JSON.stringify({ userId: user.discord_id }),
	});
	*/
	return threadData.id;
}

/**
 * Updates a problem thread
 *
 * @param problem id of problem
 * @param author_name string
 * @returns Discord thread ID
 */
export async function updateProblemThread(problem_id: number, author_name: string) {
	await loadSettings();
	const problem = await getProblem(problem_id);
	const user = await getUser(problem.author_id);
	console.log("PROBLEM", problem);
	console.log("AUTHOR", author_name);

	// Get topics before updating thread (with possibly new topics)
	const problem_topics = await getProblemTopics(
		problem.id,
		"topic_id,global_topics(topic)",
	);
	problem.topicArray = problem_topics.map(
		(x) => x.global_topics?.topic ?? "Unknown Topic",
	);

	// Create the embed
	const embed = {
		title: "Problem " + user.initials + problem.id,
		//description: "This is the description of the embed.",
		type: "rich",
		color: parseInt(scheme.discord.embed_color, 16), // You can set the color using hex values
		author: {
			name: user.full_name,
			//icon_url: "https://example.com/author.png", // URL to the author's icon
		},
		fields: [
			{
				name: "Problem",
				value:
					problem.problem_latex.length > 1023
						? problem.problem_latex.substring(0, 1020) + "..."
						: problem.problem_latex,
				inline: false, // You can set whether the field is inline
			},
			{
				name: "Answer",
				value:
					problem.answer_latex.length > 1019
						? "||" + problem.answer_latex.substring(0, 1016) + "...||"
						: "||" + problem.answer_latex + "||",
				inline: false, // You can set whether the field is inline
			},
			{
				name: "Solution",
				value:
					problem.solution_latex.length > 1019
						? "||" + problem.solution_latex.substring(0, 1016) + "...||"
						: "||" + problem.solution_latex + "||",
				inline: false, // You can set whether the field is inline
			},
			{
				name: "Comments",
				value:
					problem.comment_latex.length > 1019
						? "||" + problem.comment_latex.substring(0, 1016) + "...||"
						: "||" + problem.comment_latex + "||",
				inline: false, // You can set whether the field is inline
			},
		],
		footer: {
			text: "COMPOSE",
			icon_url: scheme.logo, // URL to the footer icon
		},
	};
	let url = scheme.url
	if (!scheme.url.startsWith("http")) {
		url = "http://" + scheme.url
	}
	const viewButton = {
		type: 2, // LINK button component
		style: 5, // LINK style (5) for external links
		label: "View Problem",
		url: url + "/problems/" + problem.id, // The external URL you want to link to
	};
	const solveButton = {
		type: 2, // LINK button component
		style: 5, // LINK style (5) for external links
		label: "Testsolve",
		url: url + "/problems/" + problem.id + "/solve", // The external URL you want to link to
	};
	const tagResponse = await fetch("/api/discord/forum", {
		method: "POST",
		body: JSON.stringify({
			channelId: scheme.discord.notifs_forum,
			tags: problem.topicArray,
		}),
	});
	const { tagIds } = await tagResponse.json();
	console.log("MAKING FETCH");
	console.log("PROBLEM", problem.problem_latex);

	const threadResponse = await fetch("/api/discord/update-thread", {
		method: "PATCH",
		body: JSON.stringify({
			message: {
				content: problem.problem_latex,
				embeds: [embed],
				components: [
					{
						type: 1,
						components: [solveButton, viewButton],
					},
				],
			},
			name: embed.title,
			applied_tags: tagIds,
			message_id: problem.discord_id,
		}),
	});
	console.log("THREAD RESPONSE", threadResponse);
	const threadData = await threadResponse.json();
	console.log("THREAD DATA 2", threadData);
}
/**
 * Creates a single problem. No topic support yet
 *
 * @param problem object
 * @returns problem data in database (including id)
 */
export async function createProblem(payload: ProblemRequest) {
	let { topics, problem_files, ...problem } = payload;
	console.log(problem);
	let { data, error } = await supabase
		.from("problems")
		.insert([problem])
		.select();
	if (error) {
		console.log("ERROR", error);
		throw error;
	}
	problem = data[0];
	const problemId = problem.id;
	// Insert topics first
	await insertProblemTopics(problemId, topics);

	for (const file of problem_files) {
		await uploadImage(`pb${problemId}/problem/${file.name}`, file);
	}

	console.log("PROBLEM", problem);
	console.log("DATA", data);
	console.log("STATUS", problem.status)

	if (problem.status != "Draft"){
		await makeProblemThread(problem);
	}

	return problem;
}

/**
 * Bulk creates many problems
 *
 * @param problems
 * @returns list of problem data in database (including id)
 */
export async function bulkProblems(problems: ProblemRequest[]) {
	const { data, error } = await supabase
		.from("problems")
		.insert(problems)
		.select();
	if (error) throw error;
	return data;
}

export async function addEndorsement(endorser_id: number, problem_id: number) {
	const { data, error } = await supabase
		.from("endorsements")
		.insert({ endorser_id, problem_id })
		.select();
	if (error) throw error;
	return data;
}

/**
 * Edits a specific problem from the database
 *
 * @param problem object
 * @param problem_id number
 * @returns problem data from database
 */
export async function editProblem(
	problem: ProblemEditRequest,
	problem_id: number,
) {
	const { data, error } = await supabase
		.from("problems")
		.update(problem)
		.eq("id", problem_id)
		.select();
	if (error) throw error;
	console.log(data);
	const authorName = await getAuthorName(data[0].author_id);
	console.log(problem);
	/** ENDPOINT NEEDS TO BE FIXED
	await fetch("/api/discord-update", {
		method: "POST",
		body: JSON.stringify({
			id: problem_id,
			update: "edited",
			updater: authorName,
		}),
	});
	*/
	return data[0];
}

/**
 * Archives a problem. Returns nothing.
 *
 * @param problem_id number
 */
export async function archiveProblem(
	problem_id: number,
	isPublished: boolean = false,
) {
	if (isPublished) {
		const { error } = await supabase
			.from("problems")
			.update({ archived: true, status: "Published" })
			.eq("id", problem_id);
		if (error) throw error;
	} else {
		const { error } = await supabase
			.from("problems")
			.update({ archived: true })
			.eq("id", problem_id);
		if (error) throw error;
	}
}
/**
 * Archives a problem. Returns nothing.
 *
 * @param problem_id number
 */
export async function unarchiveProblem(problem_id: number) {
	const { error } = await supabase
		.from("problems")
		.update({ archived: false })
		.eq("id", problem_id);
	if (error) throw error;
}

/**
 * Restores a problem. Returns nothing.
 *
 * @param problem_id number
 */
export async function restoreProblem(problem_id: number) {
	const { error } = await supabase
		.from("problems")
		.update({ archived: false })
		.eq("id", problem_id);
	if (error) throw error;
}

/**
 * Get a problem's problem topics.
 *
 * @param problem_id number
 * @param customSelect optional, string
 * @return list of problem topics
 */
export async function getProblemTopics(
	problem_id: number,
	customSelect: string = "*",
) {
	let { data: problem_topics, error } = await supabase
		.from("problem_topics")
		.select(customSelect)
		.eq("problem_id", problem_id);
	if (error) throw error;
	return problem_topics;
}

/**
 * Delete a problem's problem topics.
 *
 * @param problem_id number
 * @return none
 */
export async function deleteProblemTopics(problem_id: number) {
	let { error } = await supabase
		.from("problem_topics")
		.delete()
		.eq("problem_id", problem_id);
	if (error) throw error;
}

/**
 * Insert a problem topic into a problem.
 *
 * @param problem_id number
 * @param topics string[]
 * @return none
 */
export async function insertProblemTopics(
	problem_id: number,
	topics: string[],
) {
	let { error } = await supabase.from("problem_topics").insert(
		topics.map((tp) => ({
			problem_id: problem_id,
			topic_id: tp,
		})),
	);
	if (error) throw error;
}

/**
 * Insert topic options to the topic list
 *
 * @param topics string[]
 * @return none
 */
export async function insertTopics(topics: string[]) {
	let { error } = await supabase.from("problem_topics").insert(topics);
	if (error) throw error;
}

/**
 * Return all the global topics
 *
 * @param customSelect optional, string
 * @return list of global topics
 */
export async function getGlobalTopics(customSelect: string = "*") {
	let { data: global_topics, error } = await supabase
		.from("global_topics")
		.select(customSelect)
		.order("id", { ascending: true });
	if (error) throw error;
	return global_topics;
}

/**
 * Get the problem counts
 *
 * @param customSelect optional, string
 * @return list of problem counts
 */
export async function getProblemCounts(customSelect: string = "*") {
	let { data: problemCountsData, error } = await supabase
		.from("problem_counts")
		.select(customSelect);
	if (error) throw error;
	return problemCountsData;
}

export async function getProblemLeaderboard() {
	let selectQuery = supabase.from("problem_writers_problem_counts").select("*");
	let { data, error } = await selectQuery;
	if (error) throw error;
	return data;
}
