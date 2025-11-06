<script lang="ts">
	import { displayLatex } from "$lib/latexStuff";
	import { ImageBucket } from "$lib/ImageBucket";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import { getAuthorName } from "$lib/supabase";

	export let problem; // whole object from database
	export let showMetadata = false;
	export let showLatexErrors = false;
	export let widthPara = 70;
	export let failed = false; // if this problem failed to render (use as bind)
	export let displaySolution = false; // if false, show answers and solutions without spoiler (always visible)

	let loaded = false;

	let author = "";

	(async () => {
		try {
			if ("full_name" in problem) {
				author = problem.full_name;
			} else if ("author_id" in problem) {
				let user = await getAuthorName(problem.author_id);
				author = user.full_name;
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
		loaded = true;
	})();

	let latexes = {
		problem: "",
		comment: "",
		answer: "",
		solution: "",
	};

	let fieldList = ["problem", "comment", "answer", "solution"];
	let errorList = [];

	let reveal = false;

	async function loadProblem() {
		try {
			failed = false;
			errorList = [];
			for (const field of fieldList) {
				// find and load images
				const fieldText = problem[field + "_latex"];
				const imageDownloadResult = await ImageBucket.downloadLatexImages(
					fieldText
				);
				if (imageDownloadResult.errorList.length > 0) {
					failed = true;
					errorList.push(...imageDownloadResult.errorList);
				}

				const displayed = await displayLatex(
					fieldText,
					imageDownloadResult.images
				);
				displayed.errorList.forEach((x) => (x.field = field)); // add context to errors
				errorList.push(...displayed.errorList);
				latexes[field] = displayed.out;
				for (const err of displayed.errorList) {
					if (err.sev === "err") failed = true;
				}
				errorList = errorList;
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	$: if (loaded && problem) {
		loadProblem();
	}
</script>

{#if loaded}
	{#if showLatexErrors}
		{#each errorList as err}
			<div style="border: 1px solid black;">
				<p>Error (in {err.field}): {err.error}</p>
				<p>Severity: {err.sev}</p>
			</div>
		{/each}
	{/if}

	{#if showMetadata}
		<h2>About</h2>
		<div class="flex">
			<div
				style="border: 2px solid black;width: {widthPara}%;margin: 10px;padding: 10px;"
			>
				<p><span class="header">Author: </span>{author}</p>
				{#if "front_id" in problem}
					<p><span class="header">ID: </span>{problem.front_id}</p>
				{/if}
				{#if "topic" in problem}
					<p>
						<span class="header">Topic: </span>{problem.topics ??
							problem.topicArray.join(", ")}
					</p>
				{/if}
				{#if "sub_topics" in problem}
					<p><span class="header">Sub-Topic: </span>{problem.sub_topics}</p>
				{/if}
				{#if "status" in problem}
					<p><span class="header">Status: </span>{problem.status}</p>
				{/if}
				{#if "difficulty" in problem}
					<p><span class="header">Difficulty: </span>{problem.difficulty}</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if showMetadata}
		<h2>Problem Data</h2>
	{/if}
	<div class="flex">
		<div
			style="border: 2px solid black;width: {widthPara}%;margin: 10px;padding: 10px; resize: vertical; overflow: scroll; height: 60vh;"
		>
			<p class="header">Problem</p>
			<p id="problem-render">{@html latexes.problem}</p>
			{#if displaySolution}
				<div class="spoiler-section">
					<p class="header">Answer</p>
					<p id="answer-render">{@html latexes.answer}</p>
				</div>
				<div class="spoiler-section">
					<p class="header">Solution</p>
					<p id="solution-render">{@html latexes.solution}</p>
				</div>
			{:else}
				<div class="spoiler-section">
					<div class="spoiler-header">
						<p class="header">Answer</p>
						<button
							class="reveal-button"
							on:click={() => (reveal = !reveal)}
						>
							{reveal ? "Hide" : "Reveal"}
						</button>
					</div>
					<div class="spoiler-content" class:revealed={reveal}>
						<p id="answer-render">{@html latexes.answer}</p>
					</div>
				</div>
				<div class="spoiler-section">
					<div class="spoiler-header">
						<p class="header">Solution</p>
					</div>
					<div class="spoiler-content" class:revealed={reveal}>
						<p id="solution-render">{@html latexes.solution}</p>
					</div>
				</div>
			{/if}
			<br />
			<p>
				<span class="header">Comments:</span>
				<span id="comment-render">{@html latexes.comment}</span>
			</p>
		</div>
	</div>
{:else}
	<p>Loading problem...</p>
{/if}

<style>
	.header {
		font-weight: 700;
	}

	#comment-render {
		font-style: italic;
	}

	.spoiler-section {
		margin: 10px 0;
	}

	.spoiler-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.reveal-button {
		padding: 5px 15px;
		cursor: pointer;
		background-color: #4a5568;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.9em;
		transition: background-color 0.2s;
	}

	.reveal-button:hover {
		background-color: #2d3748;
	}

	.spoiler-content {
		position: relative;
		user-select: none;
		transition: filter 0.3s, opacity 0.3s;
	}

	.spoiler-content:not(.revealed) {
		filter: blur(8px);
		opacity: 0.3;
		pointer-events: none;
	}

	.spoiler-content.revealed {
		filter: blur(0);
		opacity: 1;
		user-select: auto;
		pointer-events: auto;
	}
</style>
