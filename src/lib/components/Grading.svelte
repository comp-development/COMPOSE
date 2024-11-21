<script lang="ts">
	import { onMount } from "svelte";
	import { Modal } from "carbon-components-svelte";
	import { displayLatex } from "$lib/latexStuff";
	import Button from "$lib/components/Button.svelte";
	import ImageZoomer from "$lib/components/ImageZoomer.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import Loading from "$lib/components/Loading.svelte";

	import {
		getThisUser,
		getTournamentInfo,
		fetchNewTakerResponses,
		submitGrade,
		undoGrade,
		getTestInfo,
	} from "$lib/supabase";

	export let showGrades = false;
	export let onlyConflicted = false;
	export let disableUnsure = false;
	export let tournamentId: number;
	export let testId: number;

	/**
	 * Possible grades / actions for the grader to submit.
	 * @enum {{name: string, color: string}}
	 */
	const Grade = Object.freeze({
		CORRECT: { name: "Correct", color: "#9BFF99" },
		INCORRECT: { name: "Incorrect", color: "#FF9999" },
		UNSURE: { name: "Unsure", color: "#FFFB99" },
		UNDO: { name: "Undo", color: "#999999" },
	});

	let tournament = "";
	let test = {test_name: ""};
	let loaded = false;
	let switchingProblems = false;
	let fetching_problems = false;

	let user = null;

	let gradeQueue = [];
	let currentIndex = 0;

	async function getTournament() {
		try {
			tournament = (await getTournamentInfo(tournamentId))["tournament_name"];
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function fetchMoreProblems(num_problems = 10) {
		if (fetching_problems) {
			return;
		}
		fetching_problems = true;
		loaded = false;
		let new_problems = await fetchNewTakerResponses(
			user.id,
			num_problems,
			testId,
			gradeQueue.at(currentIndex)?.problem_id,
			onlyConflicted,
		);
		if (new_problems.length == 0) {
			new_problems = await fetchNewTakerResponses(
				user.id,
				num_problems,
				testId,
				null,
				onlyConflicted,
			);
		}
		if (new_problems.length > 0) {
			for (let problem of new_problems) {
				const display = await displayLatex(problem.answer_latex, []);
				problem.answer_display = display.out;
			}
			gradeQueue = gradeQueue.concat(new_problems);
			console.log(`Fetched ${new_problems.length} new problems!`);
			console.log(`gradeQueue length ${gradeQueue.length}`);
			// console.log(gradeQueue);
		}
		fetching_problems = false;
		loaded = true;
	}

	$: (async () => {
		// TODO: @tweoss. Check if this is valid (handleAction might assume index is just 1 less)
		if (gradeQueue.length - currentIndex < 5 && user != null) {
			// if (gradeQueue.length - currentIndex < 1 && user != null) {
			console.log(`Fetching more problems... because length is at ${gradeQueue.length} and currentIndex is at ${currentIndex}`);
			await fetchMoreProblems();
			// console.log(`Fetched more problems!`);
		}
	})();

	(async () => {
		try {
			user = await getThisUser();
			console.log(user);
			loaded = true;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	})();

	function calculateDimensions(problem_data) {
		const bounding_boxes = JSON.parse(problem_data.bounding_boxes);
		const bounding_box =
			bounding_boxes.box_positions[problem_data.problem_number];

		// Parse input object
		const topLeftX = parseFloat(bounding_box.top_left[0]);
		const topLeftY = parseFloat(bounding_box.top_left[1]);
		const bottomRightX = parseFloat(bounding_box.bottom_right[0]);
		const bottomRightY = parseFloat(bounding_box.bottom_right[1]);

		// Calculate dimensions
		const left = topLeftX.toFixed(2);
		const top = topLeftY.toFixed(2);
		const width = (bottomRightX - topLeftX).toFixed(2);
		const height = (bottomRightY - topLeftY).toFixed(2);

		// Return result
		return {
			left,
			top,
			width,
			height,
		};
	}

	// Handle swipe actions
	async function handleAction(action) {
		if (switchingProblems || gradeQueue.length <= currentIndex) {
		// if (switchingProblems || gradeQueue.length <= currentIndex - 1) {
			return;
		}

		// Get the reference to the body element
		const bodyElement = document.querySelector("main");

		// Define the durations for transition into flash color and back to original color (in milliseconds)
		const flashInDuration = 100; // 0.2 seconds
		const flashOutDuration = 1000; // 1 second

		if (
			[Grade.CORRECT, Grade.INCORRECT, Grade.UNSURE].find((a) => a == action) !=
			null
		) {
			await submitGrade(user.id, {
				scan_id: gradeQueue[currentIndex].scan_id,
				test_problem_id: gradeQueue[currentIndex].test_problem_id,
				grade: action.name,
				is_override: onlyConflicted,
			});
		}

		if (action == Grade.UNDO) {
			await undoGrade(
				gradeQueue[currentIndex - 1 >= 0 ? currentIndex - 1 : 0].grade_id
			);
		}

		// Change the background color of the entire page to the color with fast transition
		bodyElement.style.transition = `background-color ${
			flashInDuration / 1000
		}s ease-in-out`;
		bodyElement.style.backgroundColor = action.color;

		// Revert the background color to original with slower transition after the specified duration
		setTimeout(() => {
			bodyElement.style.transition = `background-color ${
				flashOutDuration / 1000
			}s ease-in-out`;
			bodyElement.style.backgroundColor = ""; // Revert to original color
		}, flashInDuration);

		// Move to the next card
		if (action == Grade.UNDO) {
			if (currentIndex > 0) {
				currentIndex -= 1;
			}
		} else {
			currentIndex += 1;
			const oldScan = gradeQueue.at(currentIndex - 1);
			const newScan = gradeQueue.at(currentIndex);
			if (
				oldScan &&
				newScan &&
				(oldScan.test_id != newScan.test_id ||
					oldScan.problem_number != newScan.problem_number)
			) {
				switchingProblems = true;
			}
		}
	}

	async function handleKey(e) {
		// Check if the pressed key is 'X'
		if (e.key === "x" || e.key === "X") {
			await handleAction(Grade.INCORRECT);
		} else if (e.key === "z" || e.key === "Z") {
			await handleAction(Grade.UNDO);
		} else if (e.key === "c" || e.key === "C") {
			await handleAction(Grade.UNSURE);
		} else if (e.key === "v" || e.key === "V") {
			await handleAction(Grade.CORRECT);
		}
	}

	function count_occurences(array: {grade: string}[], grade: string) {
		return array.map(g => g.grade == grade).reduce((a, e) => a + (e ? 1 : 0), 0);
	}

	onMount(async () => {
		// Load initial card data
		console.log(`Mounting...`);
		getTournament();
		test = await getTestInfo(testId) as any;
	});
</script>

<svelte:window on:keydown={handleKey} />

<div class="grading">
	<h1>Grading {tournament}: {test.test_name}</h1>

	<br />
	<Button title="Go Back" href="/grading" />
	<br /><br />
	{#if !gradeQueue[currentIndex] && !loaded}
		<Loading />
	{:else}
		<div class="card">
			{#if gradeQueue[currentIndex]}
				<div class="flex">
					<div class="sideBySide">
						<p>{gradeQueue[currentIndex].test_name}</p>
						<p style="margin-left: 20px">
							Problem #{gradeQueue[currentIndex].problem_number + 1}
						</p>
					</div>
				</div>
				<br />
				<h2>
					{@html gradeQueue[currentIndex].answer_display}
				</h2>
				<ImageZoomer
					imageUrl={gradeQueue[currentIndex].image}
					inputCoordinates={calculateDimensions(gradeQueue[currentIndex])}
				/>
				<br />
				<div class="flex">
					<button
						style="background-color: #999999; color: #282828;"
						on:click={async () => handleAction(Grade.UNDO)}>↩ (Z)</button
					>
					<button
						style="background-color: #ff9999; color: #AD2828;"
						on:click={async () => handleAction(Grade.INCORRECT)}>X (X)</button
					>
					{#if !disableUnsure}
						<button
							style="background-color: #FFFB99; color: #7C7215;"
							on:click={async () => handleAction(Grade.UNSURE)}>? (C)</button
						>
					{/if}
					<button
						style="background-color: #9BFF99; color: #157C20;"
						on:click={async () => handleAction(Grade.CORRECT)}>✔ (V)</button
					>
				</div>
				{#if showGrades}
					<div class="flex">
						<button disabled style="background-color: #FFFB99; color: #7C7215;">
							{count_occurences(gradeQueue[currentIndex].grades, Grade.UNSURE.name)}
						</button>
						<button disabled style="background-color: #ff9999; color: #AD2828;">
							{count_occurences(gradeQueue[currentIndex].grades, Grade.INCORRECT.name)}
						</button>
						<button disabled style="background-color: #9BFF99; color: #157C20;">
							{count_occurences(gradeQueue[currentIndex].grades, Grade.CORRECT.name)}
						</button>
					</div>
				{/if}
				<br />
			{:else}
				<p>No more problems - check back later!</p>
			{/if}
			Number of problems remaining in queue: {gradeQueue.length - currentIndex}
		</div>
	{/if}

	<Modal
		bind:open={switchingProblems}
		modalHeading={`Switching to Problem ${
			gradeQueue.at(currentIndex)?.problem_number + 1
		}`}
		primaryButtonText="Confirm (space, enter)"
		on:open
		on:close
		on:submit={() => {
			switchingProblems = false;
		}}
	>
		New Answer: {@html gradeQueue[currentIndex]
			? gradeQueue[currentIndex].answer_display
			: "<div></div>"}
	</Modal>
</div>

<style>
	h1 {
		margin-bottom: 5px;
	}

	.sideBySide {
		display: flex;
	}

	.grading {

	}

	.card {
		width: fit-content;
		position: relative;
		border-radius: 8px;
		margin-left: auto;
		margin-right: auto;
	}

	/* Add this media query
	@media (max-width: 600px) {
		.card {
			width: 95%; 
		}

		.grading {
			max-height: 200vh; 
			overflow: auto; 
		}
	} */

	button {
		width: 90px;
		height: 40px;
		border: 2px solid black;
		margin: 10px;
		font-size: 22px;
		border-radius: 10px;
		font-weight: bold;
	}

	button:hover {
		cursor: pointer;
	}
</style>
