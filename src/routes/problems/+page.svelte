<script lang="js">
	import { useChat } from "ai/svelte";
	import { supabase } from "$lib/supabaseClient";
	import { get, writable } from "svelte/store";
	import { problemList } from "$lib/sessionStore.js";
	import ProblemList from "$lib/components/ProblemList.svelte";
	import ProgressBar from "$lib/components/ProgressBar.svelte";
	import Button from "$lib/components/Button.svelte";
	import { Checkbox, TextArea } from "carbon-components-svelte";
	import { onMount } from "svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import { fetchSettings } from "$lib/supabase/settings";
	import { Chart, registerables } from 'chart.js';
	import annotationPlugin from 'chartjs-plugin-annotation';
	import { LightenDarkenColor } from "$lib/utils/Colors.svelte";
	import { useProblemFilters } from "$lib/utils/useProblemFilters.js";

	import {
		getImages,
		getProblemCounts,
		getThisUser,
		getProblems,
		getProblemFeedback,
	} from "$lib/supabase";
	import { List, Schematics } from "carbon-icons-svelte";
	Chart.register(...registerables);
	Chart.register(annotationPlugin);
	
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
			topics (string | null): Comma-separated list of the overall topics that appear in the problem – all topics are chosen from Algebra, Calculus, Combinatorics, Number Theory, Geometry; 
			topics_short (string | null): The same as the topics field but the names are shortened to Alg, Calc, Combo, NT, Geo for Algebra, Calculus, Combinatorics, Number Theory, Geometry respectively; 
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

	const { input, handleSubmit, messages, isLoading } = useChat({
		initialMessages: [
			{
				role: "system",
				content: promptParts.join(" "),
			},
		],
		onFinish: processLastMessage,
	});

	let problems;

	problemList.subscribe((value) => {
		problems = value;
	});


	let all_problems = [];
	let time_filtered_problems = [];
	let problemCounts = [];
	let width = 0;
	let loaded = false;
	let userId;

	let openModal = false;
	let values = ["Problems", "Answers", "Solutions", "Comments"];
	let group = values.slice(0, 1);

	let scheme = {};

	let problemsStore = writable([]);
	
	const {
		selectedTopics,
		selectedStages,
		selectedEndorsed,
		filteredProblems,
		filteredCount,
		availableTopics,
		availableStages,
		availableEndorsed,
		clearAllFilters
	} = useProblemFilters(problemsStore);

	$: if (problems) {
		problemsStore.set(problems);
	}

	onMount(async () => {
		// Fetch settings from the database
		scheme = await fetchSettings();
	});

	(async () => {
		try {
			all_problems = await getProblems({ customSelect: "*" });
			console.log("PROBLEMS", problems);
			console.log(scheme.progress.after);
			resetProblems();
			loaded = true;
			time_filtered_problems = await getProblems();
			time_filtered_problems = sortByDate(time_filtered_problems, 'created_at');
			
			// console.log(time_filtered_problems)

			const x_times = [];
			const y_times = {};
			var j = 0;

			// Calculate the number of days between the after date and now
			const daysDiff = Math.floor((Date.now() - Date.parse(scheme.progress.after)) / (1000 * 60 * 60 * 24));

			for (let i = 0; i <= daysDiff; i++) {
				const time = new Date(Date.parse(scheme.progress.after) + i * 24 * 60 * 60 * 1000); // Increment by day
				x_times.push(time.toLocaleString("en-US").split(",")[0]);
				while (j < time_filtered_problems.length && new Date(Date.parse(time_filtered_problems[j].created_at)) - time <= 0) {
					if (y_times[time_filtered_problems[j].status] == null) {
						y_times[time_filtered_problems[j].status] = [0];
					}
					const cur = y_times[time_filtered_problems[j].status][y_times[time_filtered_problems[j].status].length - 1];

					while (y_times[time_filtered_problems[j].status].length < i + 1) {
						y_times[time_filtered_problems[j].status].push(cur);
					}
					y_times[time_filtered_problems[j].status][y_times[time_filtered_problems[j].status].length - 1] += 1;
					j++;
				}
			}

			for (const key of Object.keys(y_times)){
				while (y_times[key].length < x_times.length){
					y_times[key].push(y_times[key][y_times[key].length-1])
				}
			}



			if (!problems.length) {
				problemList.set([...all_problems]);
				console.log("PROBLEMLIST", get(problemList));
			}
			const topicsCount = all_problems.reduce((count, { topics }) => {
				let individualTopics;
				if (topics) {
					individualTopics = topics.split(", ").map((topic) => topic.trim());
				} else {
					individualTopics = ["Uncategorized"];
				}

				individualTopics.forEach((topic) => {
					count[topic] = (count[topic] || 0) + 1;
				});

				return count;
			}, {});
			console.log(topicsCount);
			const problemCountsData = await getProblemCounts();
			console.log(problemCountsData);
			const sortedKeys = Object.keys(topicsCount)
				.filter((key) => key !== "Uncategorized")
				.sort();
			if ("Uncategorized" in topicsCount) {
				sortedKeys.push("Uncategorized");
			}
			problemCounts = sortedKeys.reduce((sortedObj, key) => {
				sortedObj[key] = topicsCount[key];
				return sortedObj;
			}, {});
			userId = (await getThisUser()).id;
			const ctx = document.getElementById('testChart').getContext('2d');

			const labels = x_times;
			let primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-tint').trim();
			let ideaColor = LightenDarkenColor(getComputedStyle(document.documentElement).getPropertyValue('--primary-light').trim(), 60); // Lighten by 20%
			let endorseColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-light').trim();
			let onTestColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
			let publishedColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim();
			const pointRadius = 1;
			const data = {
				labels: labels,
				datasets: [
					{
						label: 'Ideas',
						data: y_times["Idea"],
						fill: false,
						borderColor: ideaColor,
						tension: 0.1,
						pointRadius
					},
					{
						label: 'Endorsed',
						data: y_times['Endorsed'],
						fill: false,
						borderColor: endorseColor,
						tension: 0.1,
						pointRadius
					},
					{
						label: 'On Test',
						data: y_times['On Test'],
						fill: false,
						borderColor: onTestColor,
						tension: 0.1,
						pointRadius
					},
					{
						label: 'Published',
						data: y_times['Published'],
						fill: false,
						borderColor: publishedColor,
						tension: 0.1,
						pointRadius
					},
				]
			};

			function formatDate(dateString) {
				const date = new Date(dateString); // Set time to midnight
				const options = { year: 'numeric', month: 'short', day: '2-digit' };
				return date.toLocaleDateString('en-US', options);
			}
			const ideaGoal = scheme.progress.ideaGoal
			const endorseGoal = scheme.progress.endorseGoal
			const testGoal = scheme.progress.testGoal
			const ideaDate = formatDate(scheme.progress.ideaDate) //scheme.progress.ideaDate
			const endorseDate = formatDate(scheme.progress.endorseDate) //scheme.progress.endorseDate
			const testDate = formatDate(scheme.progress.testDate) //scheme.progress.testDate
			const options = {
				scales: {
					x: {
						ticks: {
							autoSkip: true, // Automatically skips some labels
							maxTicksLimit: Math.ceil(daysDiff / 7), // Limit the number of ticks displayed to every 2 weeks
						}
					}
				},
				plugins: {
					annotation: {
						annotations: {
							line1: {
								type: 'line',
								yMin: ideaGoal,
								yMax: ideaGoal,
								borderColor: ideaColor,
								borderWidth: 2,
								borderDash: [6,6],
								label: {
									content: `Idea Target by ${ideaDate}`,
									enabled: true,
									position: 'end',
									backgroundColor: 'rgba(255, 255, 255, 0.8)',
									color: ideaColor,
								}
							},
							line2: {
								type: 'line',
								yMin: endorseGoal,
								yMax: endorseGoal,
								borderColor: endorseColor,
								borderWidth: 2,
								borderDash: [6,6],
								label: {
									content: `Endorsed Target by ${endorseDate}`,
									enabled: true,
									position: 'end',
									backgroundColor: 'rgba(255, 255, 255, 0.8)',
									color: endorseColor,
								}
							},
							line3: {
								type: 'line',
								yMin: testGoal,
								yMax: testGoal,
								borderColor: testGoal,
								borderWidth: 2,
								borderDash: [6,6],
								label: {
									content: `On Test Target by ${testDate}`,
									enabled: true,
									position: 'end',
									backgroundColor: 'rgba(255, 255, 255, 0.8)',
									color: onTestColor,
								}
							}
						}
					}
				}
			};
			let lineChart;

			lineChart = new Chart(ctx, {type: 'line', data: data, options});
				//getProblemLink();
			
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	})();

	function sortByDate(array, key){
		return array.sort(function(a, b) {
		var x = new Date(Date.parse(a[key]));
		var y = new Date(Date.parse(b[key]));
		return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		});
	}
	function resetProblems() {
		problemList.set([...all_problems]);
		clearAllFilters();
	}


	function submitWrapper(e) {
		loaded = false;
		handleSubmit(e);
	}

	function processLastMessage() {
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
			console.log(match);
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
						problemList.set(result);
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

		loaded = true;
	}

	async function getBucketPaths(path) {
		try {
			const data = await getImages(path);
			let ans = [];
			for (let i = 0; i < data.length; i++) {
				if (data[i].id != null) {
					if (path === "") {
						ans.push(data[i].name);
					} else {
						ans.push(path + "/" + data[i].name);
					}
				} else {
					let x;
					if (path === "") {
						x = await getBucketPaths(data[i].name);
					} else {
						x = await getBucketPaths(path + "/" + data[i].name);
					}
					for (let j = 0; j < x.length; j++) {
						ans.push(x[j]);
					}
				}
			}
			return ans;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function openProblemsPDF() {
		try {
			let l =
				"\\title{All Problems}\\date{Mustang Math}\\begin{document}\\maketitle";

			for (const problem of problems) {
				l += "\\section*{Problem " + problem.front_id + "}";
				if (group.includes("Problems")) {
					l +=
						"\\textbf{Problem:} " +
						problem.problem_latex +
						"\\newline\\newline";
				}

				if (group.includes("Answers") && problem.answer_latex != "") {
					l +=
						"\\textbf{Answer:} " + problem.answer_latex + "\\newline\\newline";
				}

				if (group.includes("Solutions") && problem.solution_latex != "") {
					l +=
						"\\textbf{Solution:} " +
						problem.solution_latex.replace("\\ans{", "\\boxed{") +
						"\\newline\\newline";
				}

				if (group.includes("Comments") && problem.comment_latex != "") {
					l +=
						"\\textbf{Comment:} " +
						problem.comment_latex.replace("\\ans{", "\\boxed{") +
						"\\newline\\newline";
				}
			}
			l += "\\end{document}";

			let images = await getBucketPaths("");

			const resp = await fetch(
				// make env variable before pushing
				process.env.PDF_GENERATOR_URL,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						mode: "no-cors",
					},
					body: JSON.stringify({
						latex: l,
						images,
					}),
				}
			);
			const blob = await resp.blob();
			const newBlob = new Blob([blob]);
			const blobUrl = window.URL.createObjectURL(newBlob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.setAttribute("download", "problems.pdf");
			document.body.appendChild(link);
			link.click();
			link.parentNode.removeChild(link);

			// clean up Url
			window.URL.revokeObjectURL(blobUrl);
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}
	
</script>


<svelte:window bind:outerWidth={width} />



<br />
<h1>Problem Inventory</h1>
{#if !loaded}
	<p>Loading problems...</p>
{/if}

<div style="margin-top: 10px;">
	<Button title="Create a new problem" href="/problems/new" />
</div>
<br />
<div class="flex">
	<div class="stats">
		<h4><u>Stats</u></h4>
		{#if loaded}
		<!-- <Line data={time_filtered_problems.length} width={100}, height={50}, options={{maintainAspectRatio: false}} /> -->
		
		
			<ProgressBar
				value={time_filtered_problems.length}
				max={scheme.progress.goal}
				helperText={time_filtered_problems.length +
					"/" +
					scheme.progress.goal +
					" problems written"}
				labelText={"Tournament Progress"}
			/>
		{/if}
		<p>
			<strong>Number of Problems: {all_problems.length}</strong>
		</p>
		{#each Object.entries(problemCounts) as [cat, count]}
			<p>
				<!-- prettier-ignore -->
				<strong>{cat} Problems:</strong>
				{count}
			</p>
		{/each}
		<canvas id="testChart"></canvas>
	</div>
	
</div>
<!--
<Button
	action={() => {
		openModal = !openModal;
	}}
	title="Download All Problems"
/>
<br /><br />
-->
<!--
<Button
	action={() => {
		problemList.set(
			problems.filter((problem) => {
				return problem.author_id == userId;
			})
		);
	}}
	title="My Problems"
/>
<br /><br />-->
<!--
<ul visibility: hidden>
	{#each $messages as message}
		<li>{message.role}: {message.content}</li>
	{/each}
</ul>
<div style="width:80%; margin: auto;margin-bottom: 20px;">
	<form on:submit={submitWrapper}>
		<TextArea
			class="textArea"
			labelText="Use CASSIE to filter (Beta)!"
			placeholder="Type some sort of command to filter (e.g. Show me all problems with difficulty harder than 4 and sort it hardest to easiest.). You can build queries off of the previous one."
			bind:value={$input}
			required={true}
		/>
		<br />
		<Button type="submit" title="Apply Filter" />
	</form>
</div>
<Button action={resetProblems} title="Clear Filter" />
-->
<br /><br />

<div style="width:80%; margin: auto;margin-bottom: 20px;">
	<ProblemList 
		problems={$filteredProblems} 
		showList={JSON.parse(localStorage.getItem("problem-list.show-list"))}
		selectedTopics={$selectedTopics}
		availableTopics={$availableTopics}
		onTopicFilterChange={(topics) => { selectedTopics.set(topics); }}
		selectedStages={$selectedStages}
		{availableStages}
		onStageFilterChange={(stages) => { selectedStages.set(stages); }}
		selectedEndorsed={$selectedEndorsed}
		{availableEndorsed}
		onEndorsedFilterChange={(endorsed) => { selectedEndorsed.set(endorsed); }}
		filteredCount={$filteredCount}
	/>
</div>

{#if openModal}
	<div
		class="flex"
		style="background-color: rgba(0,0,0,0.5); position: absolute; top: 0; bottom: 0;right:0;left: 0;z-index: 100;"
	>
		<div
			style="width: 300px; height: max-content; z-index: 101;background-color: white;padding: 10px;position: relative;"
		>
			<div style="position: absolute; top: 5px; right: 8px;">
				<button
					on:click={() => {
						openModal = !openModal;
					}}
					style="font-size: 12px;cursor:pointer;outline: none;border: none;background: none;"
					><i class="fa-solid fa-x" /></button
				>
			</div>

			<p><strong>PDF Options</strong></p>

			{#each values as value}
				<Checkbox bind:group labelText={value} {value} />
			{/each}

			<br />
			<button on:click={openProblemsPDF}>Download Problems</button>
			<br /><br />
		</div>
	</div>
{/if}

<style>
	.stats {
		background-color: white;
		border: 1px solid var(--primary);
		width: 80%;
		margin: 10px;
		text-align: left;
		padding: 10px;
	}

</style>
