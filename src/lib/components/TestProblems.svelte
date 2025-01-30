<!-- TestProblems.svelte-->

<script>
	import {
		Checkbox,
		TextArea,
		TextInput,
		Dropdown,
	} from "carbon-components-svelte";
	import { formatTime } from "$lib/formatDate";
	import { handleError } from "$lib/handleError";
	import Latex from "$lib/components/Latex.svelte";
	import toast from "svelte-french-toast";
	export let problemFeedback = 
		{
			problem_id: null,
			quality: null,
			difficulty: null,
			feedback: null,
			correct: null,
			solver_id: null,
			testsolve_id: null,
			time_elapsed: 0,
		};
	console.log("FEDBACK", problemFeedback);
	export let problem;
	console.log("PROBLEM", problem);
	export let problemNumber = null;
	export let testsolve_id = null;
	export let user_id = null;
	$: {
		problemFeedback.problem_id = problem.id;
		problemFeedback.solver_id = user_id;
		problemFeedback.testsolve_id = testsolve_id;
	}
	console.log("TPROBS", problemFeedback);
	export let reviewing = false;
	export let lastTime = new Date();
	export let endorsing = false;
	export let givingFeedback = false;
	export let autoUpdate = true;
	let screen_width = screen.width;
	console.log("PROBLEM", problem)
	import {
		getTestProblems,
		getThisUser,
		getTestsolveProblemFeedback,
		upsertProblemFeedback,
		updateTestsolve,
		upsertTestsolveFeedbackAnswers,
		getTestsolveFeedbackAnswers,
		getFeedbackQuestions,
	} from "$lib/supabase";

	(async () => {
		try {
			if (!user_id) {
				user_id = (await getThisUser()).id;
				console.log(user_id);
			}	
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	})();

	function updateFeedback() {
		if (!autoUpdate) return;
		upsertProblemFeedback([problemFeedback]);
	}
	
	function changeChecked() {
		updateFeedback();
	}

	function changeFeedback() {
		updateFeedback();
	}

	function changeDifficulty() {
		console.log(problemFeedback);
		const num = parseInt(problemFeedback.difficulty);
		console.log(num, "NUM");
		if (
			problemFeedback.difficulty == "" ||
			(!isNaN(num) && num >= 1 && num <= 10)
		) {
			problemFeedback.difficulty = num;
			updateFeedback();
		} else {
			toast.error("You must enter an integer from 1-10, or leave it blank");
			problemFeedback.difficulty = "";
		}
		// Check if the value is within the range of 1 to 10 (inclusive)
	}

	function changeQuality() {
		console.log(problemFeedback);
		const num = parseInt(problemFeedback.quality);
		console.log(num, "NUM");
		if (
			problemFeedback.quality == "" ||
			(!isNaN(num) && num >= 1 && num <= 10)
		) {
			problemFeedback.quality = num;
			updateFeedback();
		} else {
			toast.error("You must enter an integer from 1-10, or leave it blank");
			problemFeedback.quality = "";
		}
		// Check if the value is within the range of 1 to 10 (inclusive)
	}

	function changeAnswer(e, id) {
		const nowTime = new Date().getTime();
		const problemTime =
			nowTime - lastTime + problemFeedback.time_elapsed;
		lastTime = nowTime;
		problemFeedback.time_elapsed = problemTime;
		updateFeedback();
		console.log("f", problemFeedback.time_elapsed);
	}

</script>

<div class="problem-container">
					<div class="problem-div">
						<p>
							{#if problemNumber}
								<span style="font-size: 30px;">
									{problemNumber + 1}.
								</span>
							{/if}
							{#if reviewing || givingFeedback}
								({problem.front_id})
							{/if}
						</p>
						<!--How problem is initially displayed-->
						<div class="problem-latex">
						<Latex 
							style="font-size: 16px"
							value={problem.problem_latex}
						/>
						</div>
						<!--Change problem when reviewing/submitted-->
						{#if reviewing}
							<div style="margin-top: 10px;">
								Answer:
								<Latex
									style="font-size: 16px"
									value={problem.answer_latex}
								/>
							</div>
							<div style="margin-top: 10px;">
								Solution:
								<Latex
									style="font-size: 16px"
									value={problem.solution_latex}
								/>
							</div>
						{/if}
					</div>
					<div class="feedback-div">
						<div>
							Time: {formatTime(
								problemFeedback.time_elapsed
							)}
						</div>
						<div style="margin-top: 10px;">
							<TextInput
								labelText={reviewing ? "Your answer" : "Answer"}
								disabled={reviewing}
								bind:value={problemFeedback.answer}
								on:blur={changeAnswer}
							/>
						</div>
						{#if reviewing}
							<div style="margin-top: 3px;">
								<Checkbox
									labelText="Correct?"
									bind:checked={problemFeedback.correct}
									on:change={changeChecked}
								/>
							</div>
						{/if}
						<br>
						<div>
							<TextArea
								labelText="Feedback"
								bind:value={problemFeedback.feedback}
								on:blur={changeFeedback}
							/>
						</div>
						{#if reviewing}
							<br />
							<div class="flex">
								<div style="margin: 3px">
									<TextInput
										labelText={"Difficulty"}
										placeholder={"1-10"}
										bind:value={problemFeedback
											.difficulty}
										on:change={changeDifficulty}
									/>
								</div>
								<div style="margin: 3px">
									<TextInput
										labelText={"Quality"}
										placeholder={"1-10"}
										bind:value={problemFeedback.quality}
										on:change={changeQuality}
									/>
								</div>
							</div>
						{/if}
					</div>
				</div>

<style>
	.problem-container {
		display: flex;
	}

	.problem-div,
	.feedback-div {
		background-color: var(--text-color-light);
		border: 2px solid black;
		margin: 10px;
		padding: 20px;
		text-align: left;
		flex-grow: 1;
	}

	.problem-latex
	{
		margin: 10px;
	}

	.problem-div {
		width: 60%;
	}
</style>