<script lang="ts">
	import { onMount } from "svelte";
	import { getTeams } from "$lib/supabase/guts.ts";
	import { clear } from "$lib/supabase/guts.ts";
	import { submit } from "$lib/supabase/guts.ts";
	import { getAnswerData, getGutsAnswers } from "$lib/supabase/guts.ts";
	import { num_rounds } from "$lib/supabase/guts.ts";
	import { questions_per_round } from "$lib/supabase/guts.ts";
	import toast from "svelte-french-toast";
	import { CenterCircle } from "carbon-icons-svelte";

	let test = "SMT 2024";
	let round = "Guts Round";
	let curr_team = "...";
	let answer_data = {};
	let correct_answers = [];
	let init_team_answer_data = {};
	let curr_team_answer_data = {};
	let teams = [];

	answer_data["..."] = {};
	for (let i = 1; i < num_rounds + 1; i++) {
		answer_data["..."][i] = {};
		for (let j = 1; j < questions_per_round + 1; j++) {
			answer_data["..."][i][j] = { value: "", correct: false, incorrect: false };
		}
		// answer_data["..."][i]["complete"] = false;
	}
	// answer_data["..."]["score"] = 0;
	init_team_answer_data = answer_data["..."];
	curr_team_answer_data = answer_data["..."];

	for (let i = 0; i < num_rounds; i++) {
		correct_answers[i] = [];
		for (let j = 0; j < questions_per_round; j++) {
			correct_answers[i][j] = { answer_display: "" };
		}
	}
	// curr_team_answer_data = JSON.parse(JSON.stringify(answer_data["..."]));

	onMount(async () => {
		teams = await getTeams();
		// await fillInTeams();
		correct_answers = await getGutsAnswers();
		console.log("Now mounted");
		console.log(correct_answers);

		answer_data = await getAnswerData();
	});

	async function selected(event) {
		let different = false;
		// let answer_data = await getAnswerData();
		if (curr_team != "...") {
			for (let i = 1; i < num_rounds+1; i++) {
				for (let j = 1; j < questions_per_round+1; j++) {
					if (init_team_answer_data[i][j]["value"] != curr_team_answer_data[i][j]["value"]) {
						different = true
					}
					if (init_team_answer_data[i][j]["correct"] != curr_team_answer_data[i][j]["correct"]) {
						different = true
					}
					if (init_team_answer_data[i][j]["incorrect"] != curr_team_answer_data[i][j]["incorrect"]) {
						different = true
					}
				}
			}
		}
		if (different) {
			if (!confirm(`Your have unsaved changes! Are you sure you want to switch to a different team?`)) {
				// event.target.value = curr_team.replace(/ /g, '-');
				event.target.value = curr_team
        		return; // Exit if user cancels
			}
    	}
		try {
			answer_data = await getAnswerData();
			correct_answers = await getGutsAnswers();
			curr_team = event.target.value;	
			
			// curr_team = curr_team.replace(/-/g, ' ');	
			// curr_team_answer_data = JSON.parse(JSON.stringify(answer_data[curr_team]));
			init_team_answer_data = answer_data[curr_team];
			curr_team_answer_data = answer_data[curr_team];
			toast.success(`Now grading Team ${curr_team}`, {
				duration: 2000,
			});
		} catch{
			console.log("Issue!")
		}
	
	}

	async function clear_helper(curr_team, round) {
		if (!confirm(`Are you sure you want to clear all of ${curr_team}'s answers for round ${round}?`)) {
        	return; // Exit if user cancels
    	}
		try {
			// answer_data[curr_team][round] = curr_team_answer_data[round];
			await clear(curr_team, round);
			answer_data = await getAnswerData();

			curr_team_answer_data[round] = answer_data[curr_team][round];
			init_team_answer_data = curr_team_answer_data;
			// answer_data = {...answer_data}
			// curr_team_answer_data = {...curr_team_answer_data}
			toast.success('Clear successful!', {
				duration: 3000,
			});
		} catch (error) {
			toast.error('Clear failed!', {
				duration: 3000,
			});
		}
	}


	async function submit_helper(curr_team, round) {
		if (curr_team != "...") {
			try {
				// answer_data[curr_team][round] = curr_team_answer_data[round];
				console.log(`Submitting with current team: `, curr_team);
				await submit(curr_team, round, curr_team_answer_data[round]);
				answer_data = await getAnswerData();

				curr_team_answer_data[round] = answer_data[curr_team][round];
				init_team_answer_data = curr_team_answer_data;
				toast.success('Submission successful!', {
					duration: 3000,
				});
			} catch (error) {
				toast.error('Submission failed!', {
					duration: 3000,
				});
			}
		}
	}

	// async function sleep(ms) {
    // 	return new Promise(resolve => setTimeout(resolve, ms));
	// }

	// async function submit_all(curr_team) {
	// 	for(let i = 1; i < num_rounds+1; i ++) {
	// 		let no_changes = true;
	// 		if (curr_team != "...") {
	// 			for(let j = 1; j < questions_per_round+1; j ++) {
	// 				if (curr_team_answer_data[i][j]["correct"] != false) {
	// 					no_changes = false
	// 				}
	// 				if (curr_team_answer_data[i][j]["value"] != "") {
	// 					console.log(i)
	// 					no_changes = false
	// 				}
	// 			}
	// 		}
	// 		if (!no_changes) {
	// 			await submit_helper(curr_team, i);
	// 		}
	// 		await sleep(100);
    // 	}
	// 	answer_data[curr_team] = curr_team_answer_data;
	// }

</script>

<div>
	<h1>Grade {test}</h1>
	<p>Round: {round}</p>
	<select id="teamSelect" on:change={selected}>
		Team Name: 
		<option value="" disabled selected>Select the Team:</option>
		{#each teams as team}
			<option>{team}</option>
		{/each}
	</select>
	<br>
	<br>
	<h2>Grading Team {curr_team}</h2>
	<br>

	<div id='all_info'>
			<!-- <br><button on:click={() => submit_all(curr_team)}>Submit All</button><br> -->
		<style>
			.grid-container {
				display: grid;
				grid-template-columns: repeat(3, 0.5fr); /* 3 columns */
				grid-gap: 75px;
			}
			.grid-container > * {
				border: 2px solid #000; /* Change as needed */
			}
		</style>
		<div class="centered-container">
			<div class="grid-container">
				{#each Array(num_rounds) as _, round}
					<div class='block'>
						<h3>Round {round + 1}</h3>
						<br>
						{#if round === num_rounds - 1}
							{#each Array(questions_per_round) as __, question}
								<div class="set">
									Response:
									<input type="text" placeholder={`Answer ${round + 1}.${question + 1}`} bind:value={curr_team_answer_data[round + 1][question + 1]["value"]}> &nbsp;&nbsp;&nbsp;&nbsp;
								</div>
								<br>
							{/each}
						{:else}
							<div class="grid">
								<div><strong>Answer</strong></div>
								<div></div>
								<div><strong>Correct</strong></div>
								<div><strong>Incorrect</strong></div>
								{#each Array(questions_per_round) as __, question}
								<div class="hidden">
									{@html correct_answers[round][question]["answer_display"]}
								</div>
								<div></div>
								<div>
									<input type="checkbox" bind:checked={curr_team_answer_data[round + 1][question + 1]["correct"]} 
											on:change={() => { if (curr_team_answer_data[round + 1][question + 1]["correct"]) curr_team_answer_data[round + 1][question + 1]["incorrect"] = false; }}>
								</div>
								<div>
									<input type="checkbox" bind:checked={curr_team_answer_data[round + 1][question + 1]["incorrect"]} 
											on:change={() => { if (curr_team_answer_data[round + 1][question + 1]["incorrect"]) curr_team_answer_data[round + 1][question + 1]["correct"] = false; }}>
								</div>
								{/each}
							</div>
							<!-- {#each Array(questions_per_round) as __, question}

								<div class="set">
									Correct:
									<input type="checkbox" bind:checked={curr_team_answer_data[round + 1][question + 1]["correct"]}>
									Incorrect:
									<input type="checkbox" bind:checked={curr_team_answer_data[round + 1][question + 1]["incorrect"]}>
								</div>
							{/each} -->
						{/if}
						
						<br/>
						<button on:click={() => submit_helper(curr_team, round + 1)}>Submit</button>
						<button on:click={() => clear_helper(curr_team, round + 1)}>Clear Data</button>
						<br>
						<br>
					</div>
				{/each}
			</div>
		</div>
	</div>
	
</div>

<style>
	.grid {
	  display: grid;
	  grid-template-columns: repeat(4, 1fr);
	  gap: 10px;
	  margin: 0 auto; /* Centers the grid horizontally */
	  justify-items: center; /* Centers the grid items horizontally */
	}

	.hidden {
		background-color: black;
	}

	.hidden:hover {
		background-color: white;
		cursor: none;
	}
</style>
