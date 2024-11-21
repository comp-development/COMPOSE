<script>
	import { page } from "$app/stores";
	import { getProblemImages } from "$lib/getProblemImages";
	import ProblemEditor from "$lib/components/ProblemEditor.svelte";
	import Button from "$lib/components/Button.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import {
		getAuthorName,
		editProblem,
		getProblemTopics,
		deleteProblemTopics,
		insertProblemTopics,
		deleteImages,
		getImages,
		uploadImage,
		getThisUser,
		getProblem,
	} from "$lib/supabase";

	let problem;
	let images = [];
	let loaded = false;
	let dirty = false;

	async function fetchTopic(problem_id) {
		try {
			const problem_topics = await getProblemTopics(
				problem_id,
				"topic_id,global_topics(topic)"
			);
			problem.topic = problem_topics.map((x) => x.topic_id);
			problem.topicArray = problem_topics.map(
				(x) => x.global_topics?.topic ?? "Unknown Topic"
			);
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function fetchProblem() {
		try {
			problem = await getProblem(Number($page.params.id));
			await fetchTopic(problem.id);
			images = await getProblemImages(problem.id);
			loaded = true;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	fetchProblem();

	window.onbeforeunload = function(){
		if (dirty) {
		  return 'Changes may not be saved.';
		}
	};

	async function submitProblem(payload) {
		try {
			const { topics, problem_files, ...payloadNoTopics } = payload;
			const data = await editProblem(payloadNoTopics, Number($page.params.id));
			console.log("DATA", data);
			await deleteProblemTopics(data.id);
			await insertProblemTopics(data.id, payload.topics);

			// delete all files already in the problem
			const fileList = await getImages(`pb${problem.id}/problem`);
			if (fileList.length > 0) {
				await deleteImages(
					fileList.map((f) => `pb${problem.id}/problem/${f.name}`)
				);
			}

			for (const file of problem_files) {
				await uploadImage(`pb${problem.id}/problem/${file.name}`, file);
			}

			fetchProblem();

			dirty = false;
			toast.success("Successfully updated problem.");
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
		/** ENDPOINT NEEDS TO BE FIXED
		try {
			// Update discord webhook.
			const authorName = await getAuthorName(await getThisUser().id);
			await fetch("/api/discord-update", {
				method: "POST",
				body: JSON.stringify({
					id: problem.id,
					update: "edited",
					updater: authorName,
				}),
			});
		} catch (error) {
			handleError(error);
			toast.error("Error updating discord webhook: " + error.message);
		}
		*/
	}
</script>

<br />

{#if loaded}
	<h1>Problem {problem.id} ({problem.front_id})</h1>
	<br />
	<Button href="/problems" title="Back to Problems" />
	<br /><br />
	<Button href={"/problems/" + problem.id} title="Return" />
	<ProblemEditor
		originalProblem={problem}
		originalImages={images}
		onSubmit={submitProblem}
		onDirty={() => dirty = true}
	/>
{:else}
	<p>Loading problem...</p>
{/if}
