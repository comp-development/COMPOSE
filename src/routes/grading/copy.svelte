<script lang="ts">
	let test = "MMT 2024";
	let round = "Team Round";

	let tournaments = 

	let names = [
		//0 = Not started, 1 = In Progress, 2 = Done
		{ prob_id: 1, status: 2 },
		{ prob_id: 2, status: 1 },
		{ prob_id: 3, status: 0 },
		{ prob_id: 4, status: 0 },
	];
</script>

<div>
	<h1>Grading</h1>

	<br />

	<p style="font-style: italic;">Pick a test to grade</p>

	{#each names as item, index (item.prob_id)}
		<div>
			<a class="problemContainer" href="/grading/{item.prob_id}">
				Problem {item.prob_id}:
				{#if item.status == 0}
					<span style="color: var(--incorrect-text)">Not Started</span>
				{:else if item.status == 1}
					<span style="color: var(--unsure-text)">In Progress</span>
				{:else}
					<span style="color: var(--correct-text)">Done</span>
				{/if}
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
