<script>
	import ProblemEditor from "$lib/components/ProblemEditor.svelte";
	import toast from "svelte-french-toast";
	import { ImageBucket } from "$lib/ImageBucket";
	import Button from "$lib/components/Button.svelte";
	import { invalidate } from "$app/navigation";
	import { handleError } from "$lib/handleError.ts";
	import {
		getAuthorName,
		createProblem,
		getThisUser,
		insertProblemTopics,
		uploadImage,
	} from "$lib/supabase";

	import { getProblemEmbedding } from "$lib/supabase/problems";
	import { get } from "svelte/store";

	let authorName = "";
	let openModal = false;
	let problem_id = 0;
	let dirty = false;

	window.onbeforeunload = function(){
		if (dirty) {
		  return 'Changes may not be saved.';
		}
	};


	async function submitProblem(payload) {
		authorName = await getAuthorName((await getThisUser()).id);
		
		console.log(payload);
		if (authorName === "") {
			throw new Error("Author name is not defined");
		}
		if (payload.topics.length == 0) {
			throw new Error("Must specify at least one topic for this problem");
		} else {
			const embedding = await getProblemEmbedding(payload);

			// console.log("stuff", await getProblemEmbedding(payload));
			// console.log("add embedding", embedding);
			payload.embedding = embedding;
			console.log("add embedding", payload);
			const data = await createProblem(payload);

		let imageDownloadResult = await ImageBucket.downloadLatexImages(
			payload.problem_latex
		);
		let imageName = "";
		if (imageDownloadResult.images.length > 0) {
			imageName = await ImageBucket.getImageURL(
				imageDownloadResult.images[0].name
			);
		} else {
			imageDownloadResult = await ImageBucket.downloadLatexImages(
				payload.solution_latex
			);
			if (imageDownloadResult.images.length > 0) {
				imageName = await ImageBucket.getImageURL(
					imageDownloadResult.images[0].name
				);
			}
		}

		openModal = true;
		problem_id = data.id;
		//window.location.replace(`/problems/${problemId}`);
	}
	dirty = false;
	}
</script>

<br />

<h1>Create New Problem</h1>

<ProblemEditor onSubmit={submitProblem} onDirty={() => dirty = true}/>

{#if openModal}
	<div
		class="flex"
		style="background-color: rgba(0,0,0,0.5); position: absolute; top: 0; bottom: 0;right:0;left: 0;z-index: 100;"
	>
		<div
			style="width: 31rem; height: max-content; z-index: 101;background-color: white;padding: 10px;position: relative;"
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

			<p><strong>Problem Submitted!</strong></p>

			<br />
			<Button href="/problems/{problem_id}" title="Visit Problem" />
			<br /><br />
			<Button
				action={async () => {
					await invalidate("/problems/new");
					window.location.replace("/problems/new");
				}}
				title="Create New Problem"
			/>
			<br /><br />
			<Button href="/problems" title="View All Problems" />
			<br /><br />
		</div>
	</div>
{/if}
