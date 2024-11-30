<script>
	import { useChat } from "ai/svelte";
	import { get, writable } from "svelte/store";
	import { supabase } from "$lib/supabaseClient";
	import ProblemList from "$lib/components/ProblemList.svelte";
	import { getThisUser } from "$lib/supabase";
	import { sleep } from "openai/core";
	//import { supabase } from "$lib/src/supabaseClient";
	//https://sdk.vercel.ai/docs/guides/frameworks/sveltekit

	let problem = ""; let solution = ""; //Delete both of these variables

	let obj;
	//function provideFeedback(problem, solution){
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
		"I'm about to give you a math problem and solution intended for advanced 10th graders who are good at competition math. For this problem and solution, I would like you to break down the individual mathematical subtopics required for each solving step of the problem and solution. ",
		
		"Assess the difficulty of this problem based on how commonly known or understood these subtopics are. A difficulty 1 problem would utilize strategies and formulas that everyone at a tenth grade level should know, while a difficulty 10 problem would utilize formulas or topics that very few students would have learned. ",

		"Break down this difficulty into 3 different topics and evaluate each on its own 10 point scale, the first scale should measure the difficulty of the specific topic that is being analyzed, use the subtopics that you have found earlier in order to decide a rating here. Now the second scale should measure the insight that the person must make to solve the problem, specifically look for what the person must know in order to make the hardest insight of this problem, what the person must realize they can do. Now the third scale, which should be the easiest, simply evaluate this scale based off of the amount of steps required, is there a lot of plugging in?",

		"When evaluating a math problem, especially for advanced 10th-grade students, it's crucial to consider the interest level it presents. An engaging problem should challenge students' typical problem-solving skills and pique their curiosity. It should offer a unique twist or require an unexpected application of concepts. A problem that is too straightforward may not hold students' interest, while one that cleverly integrates multiple topics or real-world applications can be captivating. For instance, a problem that combines algebra with geometry in a novel way can be more interesting than a simple arithmetic problem. The interest level can be rated from 1 to 10 based on how engaging and unique the problem is, with higher ratings indicating greater intrigue.",

		"The solution cleanliness of a problem reflects how straightforward and concise the solution process is. A clean solution is one that requires minimal steps, avoids unnecessary complexity, and ideally has an elegant approach. This can involve a direct method of solving, without needing to traverse through numerous sub-steps or backtrack. For example, a problem that can be solved with a simple formula application rather than a multi-step derivation would be considered to have a cleaner solution. Evaluating solution cleanliness includes considering whether the problem could be solved more efficiently and rating it from 1 to 10, where a higher score signifies a more straightforward and elegant solution.",

		"Accessibility pertains to how easily students can understand the problem statement and the concepts required to solve it. A well-designed problem should be approachable, with clear instructions and a well-defined goal. The language and notation used should be familiar to the target audience, avoiding overly technical terms or advanced concepts that are not within the curriculum. This aspect also considers whether the problem can be grasped quickly by students, without needing extensive background knowledge or additional explanations. Accessibility can be rated on a scale of 1 to 10, with higher ratings indicating that the problem is more easily understood and approachable for most students.",

		"The question formatting involves the clarity and structure of how the problem is presented. A well-formatted problem is organized, with a clear layout that guides the student through the task without confusion. This includes proper use of mathematical notation, clear and concise wording, and a logical flow of information. The formatting should help students focus on solving the problem rather than deciphering the question itself. A problem with clear, unambiguous presentation is rated higher, while one with confusing elements or poor structure would score lower. The rating for question formatting also ranges from 1 to 10, with higher scores reflecting better organization and presentation.",

		"In assessing these aspects, each category contributes to the overall quality of the problem. A math problem that scores high in interest level, solution cleanliness, accessibility, and question formatting is likely to be both challenging and enjoyable for students, providing a meaningful learning experience. Conversely, issues in any of these areas can detract from the problem's effectiveness, making it less engaging, harder to solve, or more difficult to understand. By carefully considering these factors, educators can craft problems that not only test students' skills but also inspire a deeper appreciation for mathematics.",

		"Now having carefully evaluated these 7 factors, at the end of each response, provide the following carefully formatted string, which allows the javascript to break apart and evaluate your response. At the bottom of your response, please include the following: subtopics, and 7 integers with the number that you evaluated each scale out of 10, for example: 7 8 5 1 3 4 5. Now, here is an example of how this last line of output should look like: algebra:::combinatorics:::arithmetic 9 7 8 6 5 7 4. Now each subtopic should be split by the following three colon :::. And make sure not to include any spaces between individual subtopics. So the final example of how something on your last line could look like: algebra:::combinatorics:::geometry 7 9 8 3 2 4 5",
	];
		const { input=writable(''), handleSubmit, messages } = useChat({
			initialMessages: [
				{
					role: "system",
					content: promptParts[0],
				},
				{
					role: "system",
					content: promptParts[1],
				},
				{
					role: "system",
					content: promptParts[2],
				},
				{
					role: "system",
					content: promptParts[3],
				},
				{
					role: "system",
					content: promptParts[4],
				},
				{
					role: "system",
					content: promptParts[5],
				},
				{
					role: "system",
					content: promptParts[6],
				},
				{
					role: "system",
					content: promptParts[7],
				},
				{
					role: "system",
					content: promptParts[8],
				},
			],
			onFinish: submitWrapper,
		});
	input.set(problem+" which has the following solution: "+solution);

	let problems = [];
		function submitWrapper() {
		console.log(messages);
		const allMessages = get(messages);
		console.log(messages);
		const curMessage = allMessages[allMessages.length - 1];
		console.log(curMessage);
		if (curMessage.role == "assistant") {
			let response = curMessage.content;
			let breakdown = response.split(" ");
			let ratings = [breakdown[breakdown.length - 8],breakdown[breakdown.length - 7],breakdown[breakdown.length - 6],breakdown[breakdown.length - 5],breakdown[breakdown.length - 4],breakdown[breakdown.length - 3],breakdown[breakdown.length - 2],breakdown[breakdown.length - 1]]
			obj = {
				topics: parseInt(ratings[1]),
				insight: parseInt(ratings[2]),
				bashiness: parseInt(ratings[3]),
				interest: parseInt(ratings[4]),
				cleanliness: parseInt(ratings[5]),
				accessibility: parseInt(ratings[6]),
				formatting: parseInt(ratings[7]),
				subtopics: ratings[0].split(":::"),
				feedback: response,
			}
			alert(obj.topics);
			alert(obj.insight);
			alert(obj.feedback);
			alert(obj.subtopics);
		}
		
	}
//}
/*function evaluateFeedback(fobj){
	const topic = 0.3;
	const insight = 0.5;
	const bash = 0.2;

	const interest = 0.4;
	const clean = 0.2;
	const accessible = 0.2;
	const format = 0.2;

	let diff = fobj.topics*topic + fobj.insight*insight + fobj.bashiness*bash;
	let qual = fobj.interest*interest + fobj.cleanliness*clean + fobj.accessibility*accessible + fobj.formatting*format;
	
	let final = {
		difficulty: diff,
		quality: qual,
		subtopics: fobj.subtopics,
		feedback: fobj.feedback
	}
	return final;
}*/

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
			<li><c><strong>{message.role}</strong></c>: {message.content}</li>
		{/each}
	</ul>
	<form on:submit={handleSubmit}>
		<input bind:value={$input}/>
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

	c {
		color: #1326f9;
	}
</style>