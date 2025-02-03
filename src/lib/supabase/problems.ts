import { supabase } from "../supabaseClient";
import { getAuthorName } from "./users";
import {
	getUser,
	fetchSettings,
	uploadImage,
	defaultSettings,
} from "$lib/supabase";
import { get } from "svelte/store";
// import { VITE_OPENAI_API_KEY } from "$env/static/private";
import { openaiKey } from "$lib/openaiClient";

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
	embedding?: number[];
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
	embedding?: number[];
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


export function convertEditToProblemWithEmbedding(problem:ProblemEditRequest, problemWithEmbedding) {
	if(problem?.answer_latex) {
		problemWithEmbedding.answer_latex = problem.answer_latex;
	}
	if(problem?.comment_latex) {
		problemWithEmbedding.comment_latex = problem.comment_latex;
	}
	if(problem?.solution_latex) {
		problemWithEmbedding.solution_latex = problem.solution_latex;
	}

	if(problem?.author_id) {
		problemWithEmbedding.author_id = problem.author_id;
	}

	if(problem?.difficulty) {
		problemWithEmbedding.difficulty = problem.difficulty;
	}

	if(problem?.nickname) {
		problemWithEmbedding.nickname = problem.nickname;
	}
	if(problem?.sub_topics) {
		problemWithEmbedding.sub_topics = problem.sub_topics;
	}
	if(problem?.image_name) {
		problemWithEmbedding.image_name = problem.image_name;
	}
	if(problem?.discord_id) {
		problemWithEmbedding.discord_id = problem.discord_id;
	}

	return problemWithEmbedding;

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


	const problemWithEmbedding = await getProblem(problem_id);
	console.log(problemWithEmbedding?.embedding);
	const updatedProblem = convertEditToProblemWithEmbedding(problem, problemWithEmbedding);
	problem.embedding = await getProblemEmbedding(updatedProblem);


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

/**
 * Updates the embedding for a problem using OpenAI's embedding API
 */
export async function updateProblemEmbedding(problem: any) {

    const combined_text = [
        problem.problem_latex,
        problem.solution_latex,
        problem.answer_latex,
        problem.comment_latex,
        problem.difficulty,
        problem.sub_topics,
        problem.topics,
        problem.problem_tests
    ].filter(Boolean).join(' ');

	if(problem.id === 113) {
		console.log("TEXT",combined_text);
	}


    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer `,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: combined_text,
            model: 'text-embedding-ada-002'
        })
    });


    const { data } = await response.json();
    const embedding = data[0].embedding;

    const { error } = await supabase
        .from('problems')
        .update({ embedding })
        .eq('id', problem.id);

    if (error) throw error;
}


/* 
* Given a Problem, return its embedding
* TODO: Make a type called problemEmbeddingRequest
*/
export async function getProblemEmbedding(problem: any) {

    const combined_text = [
        problem.problem_latex,
        problem.solution_latex,
        problem.answer_latex,
        problem.comment_latex,
        problem.difficulty,
        problem.sub_topics,
        problem.topics,
        problem.problem_tests
    ].filter(Boolean).join(' ');
	console.log(combined_text);

	if(problem.id === 113) {
		console.log("TEXT",combined_text);
	}


    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: combined_text,
            model: 'text-embedding-ada-002'
        })
    });


    const { data } = await response.json();
    const embedding = data[0].embedding;
	console.log(embedding);
    return embedding;

    // if (error) throw error;
}

/**
 * Updates embeddings for all problems in the database
 * Used initially to populate all embeddings for the first time
 */
export async function updateAllProblemEmbeddings() {


    const { data: problems, error: fetchError } = await supabase.from('full_problems').select('*');


	console.log("something hapened")
	console.log(problems.length);

    // if (fetchError) throw fetchError;

    let updated = 0;
    let errors = 0;

    for (const problem of problems) {
		if(problem.id !== 113 && problem.id !== 114) {
			continue;
		}
        try {
            await updateProblemEmbedding(problem);
            updated++;
        } catch (error) {
            console.error(`Error updating problem ${problem.id}:`, error);
            errors++;
        }
        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { updated, errors };
}

/**
 * Semantic search for problems
 *
 * @param query string
 * @param limit number
 * @returns list of problems
 */
export async function semanticSearch(query: string, limit: number = 10) {
	console.log("Called");

	const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: query,
            model: 'text-embedding-ada-002'
        })
    });

	console.log(response);

	const { data: query_embedding } = await response.json();

	// console.log(embedding);

    const embedding = query_embedding[0].embedding;

	console.log(embedding);


	console.log("EMBEDDING", embedding);

    const { data: problems, error } = await supabase
        .rpc('search_problems', {
            query_embedding: embedding,
            match_count: limit
        });

	// const { data: problems, error } = await supabase.from('full_problems').select('*');

	console.log("PROBLEMS", problems.length);

    if (error) throw error;
	const problem_ids = problems.map((problem) => problem.id);
	console.log(problem_ids);
	console.log("PROBLEMS", problems);
    return problems;
}
