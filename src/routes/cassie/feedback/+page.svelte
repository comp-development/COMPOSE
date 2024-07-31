<script>
	import { useChat } from "ai/svelte";
	import { get, writable } from "svelte/store";
	import { supabase } from "$lib/supabaseClient";
	import ProblemList from "$lib/components/ProblemList.svelte";
	import { getThisUser } from "$lib/supabase";
	import { sleep } from "openai/core";
	//import { supabase } from "$lib/src/supabaseClient";
	//https://sdk.vercel.ai/docs/guides/frameworks/sveltekit
	let problem = "What is 1+1?"; let solution = "Trivially 2.";	
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
			/*"COMPOSE - the Collaborative Online Math Problem Organization and Sharing Environment - is a storage platform for contest math problems.",
			"Math contest organizers must query the COMPOSE database when creating math competitions.",
			"You are CASSIE - the COMPOSE AI Support System and Information Expert.",
			"Your job is to answer user's questions regarding the COMPOSE database to the best of your knowledge.",
			"Each entry in the database corresponds to one math problem.",
			datasetPrompt,
			"Database queries should fill in the [TODO] using the following supabase-js function template: ```javascript await supabase.from('full_problems').select('*').[TODO]```",
			//"This user's ID is " + user.id,
			"If your message includes a database query, do not include any additional text.",*/

			"Rate this problem on 7 scales of 1-10 for how hard it would be for a 10th grader.",

			"The first scale should rate based on how hard the topic is to understand, for example, a question like this would be given 5.00/10: You’re playing a game where you need to roll at least n to win. You can either roll two fair 6-sided dice and take the sum of the rolls, or one fair 12-sided die. For what value of n between 1 and 12, inclusive, is the probability you win equal regardless of which option you choose? And for example, this problem would be a 6.00/10: Compute the number of ordered triples of integers (x, y, z) that satisfy xyz = xz + xy + yz − x − y − z. A problem like such would be given a 1/10: What is 1+1? A problem like such would be given a 4.4/10: If x, y are positive integers not exceeding 100, compute the maximum possible value of lcm(gcd(x, y), lcm(x, y)). A problem like such would be given a 9/10: Let a1, a2, a3, and a4 be the answers to [♠1], [♠2], [♠3], and [♠4], respectively. The polynomial p(x) = a3x4 + x2 + x + a2 has complex roots r1…r4. Find the integer closest to the value of ∑n=1 4 (60a4 − a1rn). ",
			"For the second scale, you want to measure the insight required to find the solution, this specifically will describe how hard it is to think of the solution, specifically look at the hardest part of the solution provided and rate its difficulty on a scale of 1-10.",
			"Now for the third scale, you want to take a look at the amount of steps required to solve the problem, for example, if it takes only a couple of steps, rate it 1, but if it takes like 20-30 steps, rate it 10.",
			"Now for the fourth through seventh scales, which unlike the other three will be primarily based on the quality of the problem, ideally, you want this rating to be as low as possible, and this rating has to be on the following scales: The fourth scale of 1-10 will be points for how interesting the problem is, if the problem is enjoyable to solve and have a nice result and is also something very unique, you want to give it 10 points in this category, if the problem just involves expressions and there isn't actually anything unique about it and you commonly see the problem elsewhere (search online to look for this problem), give it 1 point, and if it is anywhere in between, give it 1-10 points, you want to ask yourself: How unique is the problem? Is it a very common math contest problem, or does it feel unlike anything you've seen before?.",
			"Now for the fifth scale, you want to award 1-10 points based off of how clean the solution is, ideally, the more steps that involve simply bashing values, the fewer points it should recieve in this category, the other thing is, the easier the problem is, the fewer points in this category. ", 
			"Now for the sixth scale, you want to rate based off of accessibility, think about this: Is the problem understandable to people who are unfamiliar with certain concepts? Does it use approachable vocabulary? Can weaker students work on it and make progress without knowing a very specific concept/solution? Award 1-10 points in this category.",
			"And now for the final seventh scale, simply look for how clean the solution and how well formatted the problem is, award 1-10 points. ",

			"Now return all 7 scales. Ideally, keep in mind that this is for competitive math students in 10th grade, so you will want to lower your original grades a bit, and make sure you keep the last four scales as low as possible, in fact, you shouldn't really cross 7 in most categories, since this allows for the most changes to be made, now, rate this problem on the 4 scales mentioned earlier and MAKE SURE TO PROVIDE EACH ONE AS A SEPARATE SCALE!",
			"Completely break down the entire problem by scale, however, at the end of the message, the only thing that should be there is a set of integers and subtopics and YOU MUST HAVE THEM THERE, YOU CANNOT BE LAZY AND NOT PUT THEM THERE!, when outputing, provide each scale as a singular integer spaced out, for example: (subtopics) 7 8 9 3 5 2 10, do not provide any bolded text or headers or info after these integers, these integers should be the LAST LINE ON THE OUTPUT! NO PERIODS OR ANY PUNCTUATION AFTER, THEY SHOULD LITERALLY BE THE LAST THING YOU RETURN! THE INTEGERS SHOULD BE IN THIS EXACT FORMAT: The integers and subtopics: (subtopics go here) 1 2 1 4 2 5 3, NOTHING ELSE! The subtopics have to be math subtopics and each individual subtopic has to be separated by the three colon ::: and no spaces between the colons and subtopics. And then on a lines before print out simple feedback for how to improve specifically the quality ratings, then also break down the difficulty ratings. Sample output: (feedback/breakdown goes here) The integers: 7 8 9 3 5 2 10.",
			"When outputing, provide each scale as a singular integer spaced out, for example: 7 8 9 3 5 2 10, do not provide any bolded text or headers before these integers, these integers should be the FIRST LINE ON THE OUTPUT! And then on a new line print out simple feedback for how to improve specifically the quality ratings, then break 2 lines and break down the difficulty ratings. Sample output: 7 8 9 3 5 2 10 (feedback goes here).",
			"Now the user will provide their answer and solution. MAKE SURE TO RETURN ALL 7 SCALES AND GIVE AS MUCH FEEDBACK AS POSSIBLE! The problem and solution will be separated by a triple colon as seen here :::",
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
				{
					role: "system",
					content: promptParts[9],
				},
			],
			onFinish: submitWrapper,
		});
	input.set(problem+" which has the following solution: "+solution);

	let problems = [];
	let awaiting = 0;
	let obj;
		function submitWrapper() {
		console.log(messages);
		const allMessages = get(messages);
		console.log(messages);
		const curMessage = allMessages[allMessages.length - 1];
		console.log(curMessage);
		if (curMessage.role == "assistant") {
			let response = curMessage.content;
			let breakdown = response.split(" ");
			let ratings = [breakdown[breakdown.length - 7],breakdown[breakdown.length - 6],breakdown[breakdown.length - 5],breakdown[breakdown.length - 4],breakdown[breakdown.length - 3],breakdown[breakdown.length - 2],breakdown[breakdown.length - 1]]
			obj = {

			}
		}
		while(awaiting == 0){
			sleep(20);
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