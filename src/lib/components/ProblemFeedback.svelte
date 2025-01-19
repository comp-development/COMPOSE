<script>
	import Rating from "$lib/components/Rating.svelte";
	import { Checkbox } from "carbon-components-svelte";
	import {
		DataTable,
		Toolbar,
		ToolbarContent,
		ToolbarSearch,
		TextInput,
		Form,
		FormGroup,
		TextArea,
		Dropdown,
		MultiSelect,
	} from "carbon-components-svelte";
	import Button from "$lib/components/Button.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import {
		addProblemFeedback,
		getProblemFeedback,
		updateTestsolveAnswer,
	} from "$lib/supabase";
	import Error from "../../routes/+error.svelte";

	export let problem_id;
	export let solver_id;
	let feedbackList = [];
	let answerList;
	let allAnswers = [];
	let noRepeatAnswers = [];
	let showFeedbackPanel = false;
	let loaded = false;
	let difficultyAverage = null;
	let qualityAverage = null;
	let pageSize = 25;
	let page = 1;

	let feedback = "";
	let answer = "";
	let difficulty = "0";
	let quality = "0";

	const difficultyOptions = Array.from({ length: 11 }, (value, index) => {
		return {
			id: index.toString(),
			text: index === 0 ? "Difficulty" : index.toString(),
		};
	});
	const qualityOptions = Array.from({ length: 11 }, (value, index) => {
		return {
			id: index.toString(),
			text: index === 0 ? "Quality" : index.toString(),
		};
	});

	async function loadFeedback() {
		try {
			const data = await getProblemFeedback(problem_id, "*,users(*)");

			// filter empty feedback
			const totalFeedbackList = data.filter((fd) => !!fd.feedback);

			feedbackList = totalFeedbackList.map((e) => ({
				id: e.id,
				answer: e.answer,
				feedback: e.feedback,
				resolved: e.resolved,
				ratings: { difficulty: e.difficulty, quality: e.quality },
				difficulty: e.difficulty,
				quality: e.quality,
				user: e.users ? e.users.full_name : "N/A",
				user_discord: e.users ? e.users.discord : "N/A",
				user_id: e.users ? e.users.id : "N/A",
				user_math_background: e.users ? e.users.math_comp_background : "N/A",
			}));

			answerList = data
				.filter((fd) => fd.answer !== null)
				.map((fd) => ({
					answer: fd.answer,
					correct: fd.correct,
				}));

			const difficultyValues = data
				.filter((fd) => fd.difficulty !== null)
				.map((fd) => fd.difficulty);

			difficultyAverage =
				difficultyValues.length > 0
					? (
							difficultyValues.reduce((acc, val) => acc + val, 0) /
							difficultyValues.length
					  ).toFixed(1)
					: null;

			const qualityValues = data
				.filter((fd) => fd.quality !== null)
				.map((fd) => fd.quality);

			qualityAverage =
				qualityValues.length > 0
					? (
							qualityValues.reduce((acc, val) => acc + val, 0) /
							qualityValues.length
					  ).toFixed(1)
					: null;

			groupAnswerList();

			loaded = true;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function groupAnswerList() {
		try {
			let answerMap = new Map();
			for (let ans of answerList) {
				if (ans.correct !== true) ans.correct = false;
				let stringified = JSON.stringify(ans);
				answerMap.set(stringified, (answerMap.get(stringified) ?? 0) + 1);
			}
			answerList = Array.from(answerMap.entries()).map((x) => {
				let str = JSON.parse(x[0]);
				allAnswers.push(x[1]);
				noRepeatAnswers.push(str.answer);
				return {
					answer: str.answer,
					correct: str.correct,
					count: x[1],
				};
			});
			answerList.sort((a, b) => {
				try {
					let aNum = parseFloat(a.answer);
					let bNum = parseFloat(b.answer);
					return aNum - bNum;
				} catch (e) {
					return a.answer.localeCompare(b.answer);
				}
			});
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	// only works on time+s
	function maybePluralize(word, num) {
		return num !== 1 ? word + "s" : word;
	}

	// resolve or unresolve an answer
	async function changeResolve(e, feedback_id) {
		try {
			let newFeedback = {
				resolved: e.detail,
			};
			await updateTestsolveAnswer(feedback_id, newFeedback);
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function addFeedback() {
		try {
			if (feedback == "" && answer == "" && quality == 0 && difficulty == 0) {
				throw new Error("You must provide some feedback!");
			}
			console.log("QUAL", quality);
			console.log("DIFF", difficulty);
			feedback == "" ? (feedback = null) : (feedback = feedback);
			quality == 0 ? (quality = null) : (quality = quality);
			difficulty == 0 ? (difficulty = null) : (difficulty = difficulty);
			answer == "" ? (answer = null) : (answer = answer);
			console.log("QUAL", quality);
			console.log("DIFF", difficulty);
			await addProblemFeedback([
				{
					solver_id: solver_id,
					problem_id: problem_id,
					feedback: feedback,
					answer: answer,
					quality: quality,
					difficulty: difficulty,
				},
			]);
			feedback = "";
			quality = "";
			difficulty = "0";
			quality = "0";
			showFeedbackPanel = false;
			loadFeedback();
		} catch (error) {
			toast.error(error.message);
			handleError(error.message);
		}
	}

	loadFeedback();
</script>

<div class="flex">
	<div class="data-container">
		<div class="ratings">
			{#if loaded}
				<Rating rating={difficultyAverage / 2} size={50} count={false}
					><p slot="pretext">Average Difficulty:&nbsp</p>
					<p slot="posttext">
						&nbsp&nbsp{difficultyAverage}
					</p></Rating
				>
				<Rating rating={qualityAverage / 2} size={50} count={false}
					><p slot="pretext">Average Quality:&nbsp</p>
					<p slot="posttext">
						&nbsp&nbsp{qualityAverage}
					</p></Rating
				>
			{/if}
		</div>
		<br /><br />
		<!--
		<div class="answerChart">
			<h2>Submitted Answers</h2>

			{#if loaded}
				{#if answerList.length === 0}
					<p>No submitted answers to this problem</p>
				{:else}
					<div class="flex">
						<div style="height: 300px;">
							<PieChart labels={noRepeatAnswers} dataSet={allAnswers} />
						</div>
					</div>
				{/if}
			{/if}
		</div>
		-->
	</div>
</div>
<div class="flex">
	<div class="feedback-container">
		<h2>Feedback</h2>
		<br />
		<Button
			action={() => {
				showFeedbackPanel = true;
			}}
			title="Add Feedback"
		/>
		<br />
		{#if showFeedbackPanel}
			<br />
			<Form class="form-container">
				<FormGroup style="display: flex; align-items: end; gap: 20px">
					<TextInput
						placeholder="Answer"
						class="textInput"
						bind:value={answer}
					/>
					<Dropdown items={difficultyOptions} bind:selectedId={difficulty} />
					<Dropdown items={qualityOptions} bind:selectedId={quality} />
				</FormGroup>
				<div style="position: relative;">
					<TextArea
						class="textArea"
						placeholder="Add Feedback"
						bind:value={feedback}
					/>
				</div>
			</Form>

			<br />
			<Button action={addFeedback} title="Submit Feedback" />
			<br />
		{/if}
		<br />
		{#if loaded}
			{#if feedbackList.length == 0}
				<p>No feedback for this problem</p>
			{:else}
				<br />
				<DataTable
					expandable
					sortable
					size="compact"
					headers={[
						{ key: "user", value: "User", width: "15%" },
						{ key: "feedback", value: "Feedback", width: "50%" },
						{ key: "answer", value: "Answer", width: "10%" },
						{ key: "ratings", value: "Ratings", width: "15%" },
						{ key: "resolved", value: "Resolved", width: "10%" }
					]}
					rows={feedbackList}
					{pageSize}
					{page}
				>
					<Toolbar size="sm">
						<ToolbarContent>
							<ToolbarSearch persistent shouldFilterRows />
						</ToolbarContent>
					</Toolbar>

					<svelte:fragment slot="cell" let:row let:cell let:rowIndex>
						<div>
							{#if cell.key == "resolved"}
								<p>
									<Checkbox
										bind:checked={feedbackList[rowIndex].resolved}
										style="flex-basis: 0"
										on:check={(e) => changeResolve(e, row.id)}
									/>
								</p>
							{:else if cell.key == "ratings"}
								<Rating
									rating={cell.value.difficulty / 2}
									size={15}
									count={true}
									><p slot="pretext">D:&nbsp</p>
								</Rating>
								<Rating rating={cell.value.quality / 2} size={15} count={true}
									><p slot="pretext">Q:&nbsp</p>
								</Rating>
							{:else if cell.key == "difficulty" || cell.key == "quality"}
								<Rating rating={cell.value / 2} size={15} count={true} />
							{:else if cell.value == null}
								<div style="overflow: hidden;">-</div>
							{:else}
								<div style="overflow: hidden;">
									{cell.value}
								</div>
							{/if}
						</div>
					</svelte:fragment>
					<svelte:fragment slot="expanded-row" let:row>
						<div style="padding: 10px;">
							<pre><strong>User Discord</strong>: {row.user_discord}</pre>
							<pre><strong>User Math Competition Background</strong
								>: {row.user_math_background}</pre>
						</div>
					</svelte:fragment>
				</DataTable>
			{/if}
		{/if}
	</div>
</div>
<br />

<style>
	.feedback-container,
	.data-container {
		width: 70%;
		margin-bottom: 10px;
	}

	:global(.bx--table-expand__button) {
		width: 30px;
		height: 20px;
	}

	.textArea {
		min-height: 100px;
	}

	.form-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		width: 100%;
	}

	.input-row {
		display: flex;
		gap: 10px;
		margin-bottom: 10px;
	}

	.feedback-container {
		margin-bottom: 20px;
	}
</style>
