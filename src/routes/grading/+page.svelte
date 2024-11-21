<script lang="ts">
	let loaded = false;

	import { getAllTournamentsUnarchived } from "$lib/supabase";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";

	let tournaments = [];

	(async () => {
		try {
			tournaments = await getAllTournamentsUnarchived();
			loaded = true;
			console.log(tournaments);
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	})();
</script>

<div>
	<h1>Grading</h1>
	{#if !loaded}
		<p>Loading problems...</p>
	{/if}

	<br />

	<p style="font-style: italic;">Pick the tournament to grade</p>

	{#each tournaments as tournament, index (tournament.id)}
		<div>
			<a class="problemContainer" href="/grading/{tournament.id}">
				{tournament.tournament_name}
			</a>
		</div>
	{/each}
</div>

<style>
	.problemContainer {
		background-color: white;
		border: 3px solid var(--primary-tint);
		padding: 10px;
		margin: 10px;
		border-radius: 20px;
		text-align: center;
		font-weight: bold;
		text-decoration: none;
		display: block;
		color: var(--text-color-dark);
	}

	.problemContainer:hover {
		background-color: var(--primary-tint);
	}
</style>
