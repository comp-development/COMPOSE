import { supabase } from "../supabaseClient";
import { getProblem } from "$lib/supabase/problems";
import { getUser, fetchSettings, defaultSettings } from "$lib/supabase";
import { formatDate } from "$lib/formatDate";

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000'; // Set your base URL here
let scheme = defaultSettings;

// Function to fetch settings
async function loadSettings() {
	scheme = await fetchSettings(); // Fetch settings from the database
}

export interface TestsolverRequest {
	test_id: number;
	solver_id: number;
}

export interface TestsolveAnswerRequest {
	testsolve_id: number;
	problem_id: number;
	answer: string;
	feedback?: string;
	correct: boolean;
}

export interface TestsolveFeedbackAnswerRequest {
	testsolve_id: number;
	feedback_question: number;
	answer: string;
}

export interface TestsolveRequest {
	test_id: number;
	solver_id: number;
	start_time?: string;
	completed: boolean;
	time_elapsed?: string;
	test_version: string;
}

/**
 * Get a user's testsolvers from the database
 *
 * @param solver_id number
 * @param customSelect optional, string
 * @returns testsolvers list
 */
export async function getSolverTestsolves(
	solver_id: number,
	customSelect: string = "*"
) {
	let { data, error } = await supabase
		.from("testsolvers")
		.select(customSelect)
		.eq("solver_id", solver_id);

	if (error) throw error;
	console.log("D", data);
	return data;
}

/**
 * Get a user's testsolves from the database, along with connected information. Also parses it into a nicely usable format.
 *
 * @param customSelect optional, string
 * @returns testsolves list
 */
export async function getSolverTestsolvesDetailed(solver_id: number) {
	const testsolveInfo = await getSolverTestsolves(
		solver_id,
		"testsolves(*,testsolvers(solver_id,users(full_name,initials)),tests(test_name))"
	);
	console.log("TSINFO", testsolveInfo);
	const testsolves = testsolveInfo.map((item) => {
		const e = item.testsolves;
		return {
			id: e.id,
			test_id: e.test_id,
			solvers: e.testsolvers.length
				? {
						ids: e.testsolvers.map((item) => item.solver_id),
						names: e.testsolvers.map((item) =>
							item.users ? item.users.full_name : null
						),
						initials: e.testsolvers.map((item) =>
							item.users ? item.users.initials : null
						),
				  }
				: null,
			test_name: e.tests.test_name,
			start_time: e.start_time ? formatDate(new Date(e.start_time)) : null,
			elapsed: e.time_elapsed,
			test_version: e.test_version,
			status: e.status,
		};
	});
	return testsolves;
}

/**
 * Get a test's testsolvers from the database
 *
 * @param test_id number
 * @param customSelect optional, string
 * @returns testsolvers list
 */
export async function getTestTestsolves(
	test_id: number,
	customSelect: string = "*"
) {
	let { data, error } = await supabase
		.from("testsolves")
		.select(customSelect)
		.eq("test_id", test_id);
	if (error) throw error;
	return data;
}

/**
 * Get all testsolves from the database, along with connected information. Also parses it into a nicely usable format.
 *
 * @param customSelect optional, string
 * @returns testsolves list
 */
export async function getTestTestsolvesDetailed(test_id: number) {
	const testsolveInfo = await getTestTestsolves(
		test_id,
		"*,testsolvers(solver_id,users(full_name,initials)),tests(test_name)"
	);
	console.log(testsolveInfo);
	const testsolves = testsolveInfo.map((e) => ({
		id: e.id,
		test_id: e.test_id,
		solvers: e.testsolvers.length
			? {
					ids: e.testsolvers.map((item) => item.solver_id),
					names: e.testsolvers.map((item) =>
						item.users ? item.users.full_name : null
					),
					initials: e.testsolvers.map((item) =>
						item.users ? item.users.initials : null
					),
			  }
			: null,
		test_name: e.tests.test_name,
		start_time: e.start_time ? formatDate(new Date(e.start_time)) : null,
		elapsed: e.time_elapsed,
		test_version: e.test_version,
		status: e.status,
	}));
	return testsolves;
}

/**
 * Get all testsolves from the database
 *
 * @param customSelect optional, string
 * @returns testsolves list
 */
export async function getAllTestsolves(customSelect: string = "*") {
	let { data: testsolveInfo, error } = await supabase
		.from("testsolves")
		.select(customSelect);
	if (error) throw error;
	return testsolveInfo;
}

/**
 * Get all testsolves from the database, along with connected information. Also parses it into a nicely usable format.
 *
 * @param customSelect optional, string
 * @returns testsolves list
 */
export async function getAllTestsolvesDetailed() {
	const testsolveInfo = await getAllTestsolves(
		"*,testsolvers(solver_id,users(full_name,initials)),tests(test_name)"
	);
	console.log(testsolveInfo);
	const testsolves = testsolveInfo.map((e) => ({
		id: e.id,
		test_id: e.test_id,
		solvers: e.testsolvers.length
			? {
					ids: e.testsolvers.map((item) => item.solver_id),
					names: e.testsolvers.map((item) =>
						item.users ? item.users.full_name : null
					),
					initials: e.testsolvers.map((item) =>
						item.users ? item.users.initials : null
					),
			  }
			: null,
		test_name: e.tests.test_name,
		start_time: e.start_time ? formatDate(new Date(e.start_time)) : null,
		elapsed: e.time_elapsed,
		test_version: e.test_version,
		status: e.status,
	}));
	return testsolves;
}

/**
 * Creates a new testsolver in database, allowing them to testsolve
 *
 * @param testsolver object
 * @returns object in database, including id
 */
export async function addTestsolver(testsolver: TestsolverRequest) {
	const { data, error } = await supabase
		.from("testsolves")
		.insert([testsolver])
		.select();
	if (error) throw error;
	return data;
}

/**
 * Creates a new testsolve in the database and adds testsolvers to said testsolve.
 *
 * @param testsolver object
 * @returns object in database, including id
 */
export async function insertTestsolvers(test_id, solvers) {
	const { data: testsolveData, error: testsolveError } = await supabase
		.from("testsolves")
		.insert([{ test_id: test_id }])
		.select();
	if (testsolveError) throw testsolveError;
	console.log("DATA", testsolveData);
	const solverInsert = solvers.map((item) => ({
		testsolve_id: testsolveData[0].id,
		solver_id: item.id,
	}));
	const { data: solverData, error: solverError } = await supabase
		.from("testsolvers")
		.insert(solverInsert)
		.select();
	if (solverError) throw solverError;
	return testsolveData[0];
}

/**
 * Handles the other functions of adding a testsolver (e.g. Discord)
 *
 * @param testsolver object
 * @returns object in database, including id
 */
export async function addTestsolvers(test, solvers) {
	await loadSettings();
	const testsolve = await insertTestsolvers(test.id, solvers);
	console.log("TESTSOLVE", testsolve);

	for (const solver of solvers) {
		const embed = {
			title: "Assigned Testsolve: " + test.test_name,
			//description: "This is the description of the embed.",
			type: "rich",
			color: parseInt(scheme.embed_color, 16), // You can set the color using hex values
			author: {
				name: solver.full_name,
				//icon_url: "https://example.com/author.png", // URL to the author's icon
			},
			footer: {
				text: "COMPOSE",
				icon_url: scheme.logo, // URL to the footer icon
			},
		};

		const linkButton2 = {
			type: 2, // LINK button component
			style: 5, // LINK style (5) for external links
			label: "Start Testsolve",
			url: scheme.url + "/testsolve/" + testsolve.id, // The external URL you want to link to
		};

		const linkButton1 = {
			type: 2, // LINK button component
			style: 5, // LINK style (5) for external links
			label: "View Testsolve",
			url: scheme.url + "/testsolve", // The external URL you want to link to
		};

		await fetch("/api/discord/dm", {
			method: "POST",
			body: JSON.stringify({
				userId: solver.id,
				message: {
					message: "",
					embeds: [embed],
					components: [
						{
							type: 1,
							components: [linkButton1, linkButton2],
						},
					],
				},
			}),
		});
	}
}

/**
 * Deletes a testsolver in database given their testsolver id (not user id). Returns nothing.
 *
 * @param testsolver_id number
 */
export async function removeTestsolver(testsolver_id: number) {
	const { error } = await supabase
		.from("testsolvers")
		.delete()
		.eq("solver_id", testsolver_id);
	if (error) throw error;
}

/**
 * Select specific testsolve from the database
 *
 * @param solver_id number
 * @param customSelect optional, string
 * @returns testsolves list
 */
export async function getSelectTestsolves(
	solver_id: number,
	customSelect: string = "*"
) {
	let { data, error } = await supabase
		.from("testsolves")
		.select(customSelect)
		.eq("solver_id", solver_id);
	if (error) throw error;
	return data;
}

/**
 * Select testsolve id from the database
 *
 * @param id number
 * @param customSelect optional, string
 * @returns testsolves list
 */
export async function getOneTestsolve(id: number, customSelect: string = "*") {
	let { data, error } = await supabase
		.from("testsolves")
		.select(customSelect)
		.eq("id", id);
	if (error) throw error;
	return data[0];
}

/**
 * Update specific testsolve from the database
 *
 * @param testsolve_id number
 * @param testsolve_data any
 * @returns testsolve data
 */
export async function updateTestsolve(
	testsolve_id: number,
	testsolve_data: any
) {
	let { data, error } = await supabase
		.from("testsolves")
		.update(testsolve_data)
		.eq("id", testsolve_id);
	if (error) throw error;
	return data;
}

/**
 * Insert a testsolve into the database
 *
 * @param testsolve_data TestsolveRequest
 * @returns testsolve data
 */
export async function insertTestsolve(testsolve_data: TestsolveRequest) {
	let { data, error } = await supabase
		.from("testsolves")
		.insert([testsolve_data])
		.select();
	if (error) throw error;
	return data[0];
}

/**
 * Delete a testsolve from the database. Returns nothing.
 *
 * @param testsolveId
 */
export async function deleteTestsolve(testsolveId: number) {
	const { data, error } = await supabase
		.from("testsolves")
		.delete()
		.eq("id", testsolveId);
	if (error) throw error;
}

/**
 * Get a problem's feedback by problem_id
 *
 * @param problemId number
 * @param customSelect optional, string
 * @returns list of testsolve answers
 */
export async function getProblemFeedback(
	problemId: number,
	customSelect: string = "*"
) {
	let { data, error } = await supabase
		.from("problem_feedback")
		.select(customSelect)
		.eq("problem_id", problemId);
	if (error) throw error;
	return data;
}

/**
 * Gets the feedback for the problems in a particular testsolve
 *
 * @param testsolve_id number
 * @param customSelect optional, string
 * @returns list of testsolve answers
 */
export async function getTestsolveProblemFeedback(
	testsolve_id: number,
	customSelect: string = "*"
) {
	console.log(testsolve_id);
	console.log(customSelect);
	let { data, error } = await supabase
		.from("problem_feedback")
		.select(customSelect)
		.eq("testsolve_id", testsolve_id);
	if (error) throw error;
	return data;
}

/**
 * Gets the feedback for the problems in a particular testsolve
 *
 * @param testsolve_id number
 * @param customSelect optional, string
 * @returns list of testsolve answers
 */
export async function getTestsolveTestFeedback(
	testsolve_id: number,
	customSelect: string = "*"
) {
	console.log(testsolve_id);
	console.log(customSelect);
	let { data, error } = await supabase
		.from("testsolve_feedback_answers")
		.select(customSelect)
		.eq("testsolve_id", testsolve_id);
	if (error) throw error;
	return data;
}

/**
 * Get all testsolve answers with an order
 *
 * @param customOrder string
 * @param customSelect optional, string
 * @returns list of testsolve answers
 */
export async function getAllTestsolveAnswersOrder(
	customOrder: string,
	customSelect: string = "*"
) {
	let { data, error } = await supabase
		.from("problem_feedback")
		.select(customSelect)
		.order(customOrder);
	if (error) throw error;
	return data;
}

export async function upsertTestsolveFeedbackAnswers(problem_feedback: any[]) {
	console.log("adding", problem_feedback);
	const { error: error } = await supabase
		.from("testsolve_feedback_answers")
		.upsert(problem_feedback, {
			onConflict: "testsolve_id, feedback_question",
		});
	if (error) throw error;
}

export async function upsertProblemFeedback(problem_feedback: any[]) {
	console.log("adding", problem_feedback);
	const { error: error } = await supabase
		.from("problem_feedback")
		.upsert(problem_feedback, { onConflict: "testsolve_id, problem_id" });
		console.log("added", problem_feedback);
	if (error) throw error;
}

export async function sendFeedbackMessage(problem_feedback: any[]) {
	await loadSettings();
	problem_feedback.forEach(async (feedback) => {
		console.log("feedback", feedback);
		const problem = await getProblem(feedback.problem_id);
		const solver = await getUser(feedback.solver_id);
		console.log("problem", problem);
		console.log("SOLVER", solver);
		// TODO: Set const `thread` that gets the discord threadID from problem_feedback
		const discord_id = solver.discord_id;
		const solver_name = solver.full_name;
		// The following is an attempt to fetch the user to display their icon in the embed. I kept getting a 401 Unauthorized Error and gave up
		/** 
		const response = await fetch(`https://discord.com/api/v10/users/@me`, {
			mode: "no-cors",
			method: "GET",
			headers: {
				Authorization: `Bot ${discordToken}`,
				"Content-Type": "application/json",
			},
		});
		console.log(response);
		const data = await response.json();
		console.log(data);
		*/
		const user = await getUser(problem.author_id);
		const embed = {
			title: "Feedback received on problem " + user.initials + problem.id,
			//description: "This is the description of the embed.",
			type: "rich",
			color: parseInt(scheme.discord.embed_color, 16), // You can set the color using hex values
			author: {
				name: solver_name,
				//icon_url: "https://example.com/author.png", // URL to the author's icon
			},
			fields: [
				{
					name: "Problem",
					value: "" + problem.problem_latex,
					inline: false, // You can set whether the field is inline
				},
			],
			footer: {
				text: solver.discord_id,
				icon_url: scheme.logo, // URL to the footer icon
			},
		};
		// Function to add a field if the value is not null
		function addFieldIfNotNull(name, value, inline = false) {
			if (value !== null) {
				embed.fields.push({
					name: name,
					value: "" + value,
					inline: inline,
				});
			}
		}
		addFieldIfNotNull("Answer", feedback.answer, true);
		addFieldIfNotNull("Quality", feedback.quality, true);
		addFieldIfNotNull("Difficulty", feedback.difficulty, true);
		addFieldIfNotNull("Feedback", feedback.feedback, false);
		console.log("EMBED", embed);
		const linkButton = {
			type: 2, // LINK button component
			style: 5, // LINK style (5) for external links
			label: "View Problem",
			url: scheme.url + "/problems/" + problem.id, // The external URL you want to link to
		};
		if (problem.discord_id) {
			console.log("MAKING FETCH")
			const response = await fetch(`${scheme.url}/api/discord/feedback`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json", // Ensure the content type is set
					"Accept": "application/json", // Accept JSON response
				},
				body: JSON.stringify({
					userId: problem.author_id,
					threadID: problem.discord_id,
					message: {
						content: "New feedback!",
						embeds: [embed],
						components: [
							{
								type: 1,
								components: [linkButton],
							},
						],
					},
				}),
			});
			const responseData = await response.json();
			console.log("RESPONSE DATA", responseData);
			console.log(responseData.channel_id);
			const messageUrl =
				"https://discord.com/channels/" +
				scheme.discord.guild_id +
				"/" +
				responseData.channel_id;
			console.log("Message URL", messageUrl);
			const threadButton = {
				type: 2,
				style: 5,
				url: messageUrl,
				label: "View Thread",
			};
			await fetch(`${scheme.url}/api/discord/dm`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json", // Ensure the content type is set
					"Accept": "application/json", // Accept JSON response
				},
				body: JSON.stringify({
					userId: problem.author_id,
					message: {
						content: "",
						embeds: [embed],
						components: [
							{
								type: 1,
								components: [linkButton, threadButton],
							},
						],
					},
				}),
			});
		} else {
			await fetch(`${scheme.url}/api/discord/dm`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json", // Ensure the content type is set
					"Accept": "application/json", // Accept JSON response
				},
				body: JSON.stringify({
					userId: problem.author_id,
					message: {
						content: "",
						embeds: [embed],
						components: [
							{
								type: 1,
								components: [linkButton],
							},
						],
					},
				}),
			});
		}
	});
}

/**
 * Gets a random problem
 */
export async function getRandomProblems(activeUserId, endorsing = false) {
	try{
		console.log("STARTING SEARCH")
		// Get problems that weren't written by the user and that the user hasn't given feedback for
		let query = supabase
			.from('full_problems')
			.select('*')
			.neq('author_id', activeUserId)
			.eq('archived', false)

		if (endorsing) {
			query = query.eq('feedback_status', 'Awaiting Endorsement');
		} else {
			let { data: feedback, error } = await supabase
				.from('problem_feedback')
				.select('problem_id')
				.eq('solver_id', activeUserId)
				.not('problem_id', 'is', null)
				.eq('resolved', false);
			if (error) throw error;
			feedback = feedback ? `(${feedback.map(f => f.problem_id).join(", ")})` : "()" // Format as (id1, id2, id3)
			console.log("FEEDBACK", feedback)
			query = query.not('id', 'in', feedback);
		}
		let { data: problems, error2 } = await query
		console.log("QUERY", query)

		console.log("PROBLEMS", problems)

		if (error2) throw error2;

		problems.sort(() => Math.random() - 0.5);
		const feedbackStatusOrder = ["Awaiting Feedback", "Awaiting Endorsement", "Awaiting Testsolve", "Needs Review", "Complete"];
		problems.sort((a, b) => {
			return feedbackStatusOrder.indexOf(a.feedback_status) - feedbackStatusOrder.indexOf(b.feedback_status);
		});
		return problems

		
	} catch (error) {
		console.error('Error fetching random problem:', error.message)
		return null
	}
}



/**
 * Insert testsolve answers to a problem
 *
 * @param problem_feedback any[]
 */
export async function addProblemFeedback(problem_feedback: any[], supabaseClient = supabase) {
	console.log("adding", problem_feedback);
	const { error: error } = await supabaseClient
		.from("problem_feedback")
		.insert(problem_feedback);
	if (error) throw error;
	await sendFeedbackMessage(problem_feedback);
}

/**
 * Update a problem's testsolve answers
 *
 * @param feedbackId number
 * @param newFeedback any
 */
export async function updateTestsolveAnswer(
	feedbackId: number,
	newFeedback: any
) {
	let { error } = await supabase
		.from("problem_feedback")
		.update(newFeedback)
		.eq("id", feedbackId);
	if (error) throw error;
}

/**
 * Delete a problem's testsolve answers
 *
 * @param testsolveId number
 */
export async function deleteTestsolveAnswer(testsolve_id: number) {
	let { error } = await supabase
		.from("problem_feedback")
		.delete()
		.eq("testsolve_id", testsolve_id);
	if (error) throw error;
}

/**
 * Get testsolve feedback answers
 *
 * @param orderedFeedbackQuestions
 * @returns testsolve feedback answers
 */
export async function getTestsolveAnswers(orderedFeedbackQuestions: []) {
	let { data: testsolve_feedback_answers, error } = await supabase
		.from("testsolve_feedback_answers")
		.select("*")
		.in(
			"feedback_question",
			orderedFeedbackQuestions.map((el) => el.id)
		);
	if (error) throw error;
	return testsolve_feedback_answers;
}

/**
 * Get specific testsolve feedback answers based on testsolve_id
 *
 * @param testsolve_id number
 * @returns testsolve feedback answers
 */
export async function getTestsolveFeedbackAnswers(testsolve_id: number) {
	let { data, error } = await supabase
		.from("testsolve_feedback_answers")
		.select("*")
		.eq("testsolve_id", testsolve_id);
	if (error) throw error;
	return data;
}

/**
 * Update testsolve feedback answer
 *
 * @param testsolve_id number
 * @param testsolve_data any
 */
export async function updateTestsolveFeedbackAnswers(
	testsolve_id: number,
	testsolve_data: any
) {
	let { error: error } = await supabase
		.from("testsolve_feedback_answers")
		.update(testsolve_data)
		.eq("id", testsolve_id);
	if (error) throw error;
}

/**
 * Insert testsolve feedback answers
 *
 * @param testsolve_data any[]
 */
export async function insertTestsolveFeedbackAnswers(testsolve_data: any[]) {
	let { error: error } = await supabase
		.from("testsolve_feedback_answers")
		.insert(testsolve_data);
	if (error) throw error;
}

