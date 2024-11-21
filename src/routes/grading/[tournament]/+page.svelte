<script lang="ts">
	let loaded = false;
	import { page } from "$app/stores";
	import {
		getNumConflictProblems,
		getNumGradeProblems,
		getNumScanProblems,
		getTournamentTests,
	} from "$lib/supabase";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	const tournament_id = Number($page.params.tournament);
	console.log(tournament_id);
	let tests = [];

	(async () => {
		try {
			tests = await getTournamentTests(
				tournament_id,
				"*,grade_tracking(test_id, *)"
			);
			await Promise.all(
				tests.map(async (test) => {
					[
						test.num_scan_problems,
						test.graded_scan_problems,
						test.conflict_scan_problems,
					] = await Promise.all([
						getNumScanProblems(test.id),
						getNumGradeProblems(test.id),
						getNumConflictProblems(test.id),
					]);
				})
			);
			tests.sort((a, b) => {
				if (a.num_scans === 0 && b.num_scans === 0) {
					return 0;
				} else if (a.num_scans === 0) {
					return 1;
				} else if (b.num_scans === 0) {
					return -1;
				} else {
					// Calculate progress for both tests
					const progressA = calculateProgress(
						a.graded_scan_problems + a.conflict_scan_problems,
						a.num_scan_problems
					);
					const progressB = calculateProgress(
						b.graded_scan_problems + b.conflict_scan_problems,
						b.num_scan_problems
					);
					// Sort by progress (least to most)
					return progressA - progressB;
				}
			});
			tests = tests;
			loaded = true;
			console.log(tests);
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	})();

	function calculateGradientBars(conflict, graded, total, colors) {
		// How much length out of a 100 should be dedicated to transitioning.
		const transition_duration = 2;
		const d = transition_duration;
		if (total == 0) {
			return `${colors[2]} 100`;
		}
		const [g, c, t] = [(graded - conflict) / total, graded / total, 1].map(
			(v) => v * 100
		);
		let a = `${colors[0]} ${g}%, ${colors[1]} ${Math.min(g + d, c)}%, 
		${colors[1]} ${c}%, ${colors[2]} ${Math.min(c + d, t)}%, ${colors[2]} ${t}%`;
		return a;
	}

	function calculateProgress(graded, total) {
		return (graded / total) * 100;
	}
</script>

<div class="page">
	<h1>Grading</h1>
	{#if !loaded}
		<p>Loading problems...</p>
	{/if}

	<br />

	<p style="font-style: italic;">Pick a test to grade</p>
	<div class="buttonContainer">
		{#each tests as test, index (test.id)}
			<div>
				<a
					class="problemContainer"
					href="/grading/{tournament_id}/{test.id}/"
					style="background: linear-gradient(to right, 
					{calculateGradientBars(
						test.conflict_scan_problems,
						test.graded_scan_problems,
						test.num_scan_problems,
						['var(--primary-light)', 'var(--primary-tint)', '#ffffff']
					)}
					);
					"
				>
					<h4>
						{test.test_name} [{test.graded_scan_problems -
							test.conflict_scan_problems} done + {test.conflict_scan_problems} conflict
						/ {test.num_scan_problems} scans = {calculateProgress(
							test.graded_scan_problems,
							test.num_scan_problems
						)
							? calculateProgress(
									test.graded_scan_problems,
									test.num_scan_problems
							  ).toFixed(0)
							: 0}%]
					</h4>
				</a>
			</div>
		{/each}
	</div>
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
		transition: all 0.3s ease; /* Add transition for smooth hover effect */
	}

	.problemContainer:hover {
		transform: scale(1.05); /* Scale up on hover */
		border-width: 5px; /* Increase border width on hover */
	}

	.buttonContainer {
		flex-direction: column; /* Align children vertically */
		align-items: center; /* Center children horizontally */
		justify-content: center; /* Center children vertically */
		margin: 0 auto; /* Center the container horizontally on the page */
		width: 70%;
	}
</style>
