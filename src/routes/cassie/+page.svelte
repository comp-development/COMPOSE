<script>
	import { useChat } from "ai/svelte";
	import { get } from "svelte/store";
	import { supabase } from "$lib/supabaseClient";
	import ProblemList from "$lib/components/ProblemList.svelte";
	import { getThisUser } from "$lib/supabase";
	//import { supabase } from "$lib/src/supabaseClient";
	//https://sdk.vercel.ai/docs/guides/frameworks/sveltekit

	// let user;
	// let promptParts;
	// (async () => {
	// 	user = await getThisUser();
	// 	console.log(user);
	// })();

	const datasetPrompt = `
		The database you have access to is a view called full_problems. English descriptions of the database columns with each column type in parenthesis are given below:
			answer_latex (string | null): The answer to the problem written in LaTeX;  
			archived (boolean | null): Whether the problem has been archived;
			author_id (string | null): Supabase ID of the user who wrote the problem; 
			comment_latex (string | null): Comments given by the author of the problem written in LaTeX; 
			created_at (string | null): Timestamp problem was created at; 
			difficulty (number | null): Difficulty rating of the problem; 
			edited_at (string | null): Timestamp the problem was last edited at; 
			front_id (string | null): An identifier for each problem given by the first 3 letters of the author's full name with the id number;
			full_name (string | null): Name of the author of the problem; 
			id (number | null): Unique ID number of the problem; 
			nickname (string | null): Nickname for each problem; 
			problem_latex (string | null): The problem written in LaTeX;
			problem_tests (string | null): Comma-separated list of all tests that the problem appears on written as a single string;
			solution_latex (string | null): The solution to the problem written in LaTeX;
			sub_topics (string | null): Comma-separated list of topics which appear in the problem – sub-topics are more granular than topics and tend to cover tactics or themes present in the problem and solution; 
			topics (string | null): Comma-separated list of the overall topics that appear in the problem – all topics are chosen from Algebra, Combinatorics, Number Theory, Geometry; 
			topics_short (string | null): The same as the topics field but the names are shortened to Alg, Combo, NT, Geo for Algebra, Combinatorics, Number Theory, Geometry respectively; 
			unresolved_count (number | null): The number of unresolved pieces of feedback the problem has;
	`;

	const promptParts = [
		"COMPOSE - the Collaborative Online Math Problem Organization and Sharing Environment - is a storage platform for contest math problems.",
		"Math contest organizers must query the COMPOSE database when creating math competitions.",
		"You are CASSIE - the COMPOSE AI Support System and Information Expert.",
		"Your job is to answer user's questions regarding the COMPOSE database to the best of your knowledge.",
		"Each entry in the database corresponds to one math problem.",
		datasetPrompt,
		"Database queries should fill in the [TODO] in the following supabase-js function template: ```javascript await supabase.from('full_problems').select('*').[TODO]```",
		//"This user's ID is " + user.id,
		"If your message includes a database query, do not include any additional text.",
	];

	const { input, handleSubmit, messages } = useChat({
		initialMessages: [
			{
				role: "system",
				content: promptParts.join(" "),
			},
		],
		onFinish: submitWrapper,
	});

	let problems = [];

	function submitWrapper() {
		console.log(messages);
		const allMessages = get(messages);
		console.log(messages);
		const curMessage = allMessages[allMessages.length - 1];
		console.log(curMessage);
		if (
			curMessage.role == "assistant" &&
			curMessage.content.includes("await supabase")
		) {
			console.log(curMessage.content);
			const regex = /```javascript(.*?)```/s;
			const match = curMessage.content.match(regex);
			console.log("MATCH", match);
			let codeBlock = curMessage.content;
			if (match) {
				codeBlock = match[1].trim();
			}
			const asyncFunction = new Function(
				"supabase",
				`
                    return (async () => {
                        const { data } = ${codeBlock}
                        return data;
                    })();
                    `
			);
			try {
				const result = asyncFunction(supabase)
					.then((result) => {
						console.log(result);
						problems = result;
						console.log("Async code execution completed.");
					})
					.catch((error) => {
						console.error("Async code execution error:", error);
					});
				console.log("Code executed successfully. Result:", result);
			} catch (error) {
				console.error("Error executing code:", error);
			}
		} else {
			console.log("Not a function");
		}
	}

	const query = "";
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	<h1>Talk to CASSIE!</h1>
	<ul>
		{#each $messages as message}
			<li>{message.role}: {message.content}</li>
		{/each}
	</ul>
	<form on:submit={handleSubmit}>
		<input bind:value={$input} />
		<button type="submit">Send</button>
	</form>

	<div style="width:80%; margin: auto;margin-bottom: 20px;">
		<ProblemList {problems} />
	</div>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	}

	h1 {
		width: 100%;
	}
</style>
