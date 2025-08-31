<script>
	import { MultiSelect, TextInput, Button as CarbonButton } from "carbon-components-svelte";

	export let problems = [];
	export let filtered = [];

	let allTests = [];
	let selectedTests = [];
	let allTopics = [];
	let selectedTopics = [];
	let allStages = [];
	let selectedStages = [];
	const endorsedOptions = [
		{ id: "yes", text: "Endorsed" },
		{ id: "no", text: "Not Endorsed" },
	];
	let selectedEndorsed = [];

	function extractTests() {
		const testCounts = {};
		(problems || []).forEach((problem) => {
			if (problem.problem_tests) {
				const tests = problem.problem_tests.split(", ").map((t) => t.trim());
				tests.forEach((t) => {
					testCounts[t] = (testCounts[t] || 0) + 1;
				});
			}
		});
		allTests = Object.keys(testCounts)
			.sort()
			.map((test) => ({ id: test, text: `${test} (${testCounts[test]})`, count: testCounts[test] }));
	}

	function extractTopics() {
		const topicCounts = {};
		(problems || []).forEach((problem) => {
			if (problem.topics) {
				problem.topics.split(", ").map((tp) => tp.trim()).forEach((tp) => {
					topicCounts[tp] = (topicCounts[tp] || 0) + 1;
				});
			}
		});
		allTopics = Object.keys(topicCounts)
			.sort()
			.map((topic) => ({ id: topic, text: `${topic} (${topicCounts[topic]})`, count: topicCounts[topic] }));
	}

	function extractStages() {
		const stageCounts = {};
		(problems || []).forEach((p) => {
			if (p.status) {
				stageCounts[p.status] = (stageCounts[p.status] || 0) + 1;
			}
		});
		allStages = Object.keys(stageCounts)
			.sort()
			.map((stage) => ({ id: stage, text: `${stage} (${stageCounts[stage]})`, count: stageCounts[stage] }));
	}

	function applyFilters() {
		let result = [...(problems || [])];

		if (selectedTests.length > 0) {
			result = result.filter((p) => {
				if (!p.problem_tests) return false;
				const tests = p.problem_tests.split(", ").map((t) => t.trim());
				return selectedTests.some((sel) => tests.includes(sel));
			});
		}

		if (selectedTopics.length > 0) {
			result = result.filter((p) => {
				if (!p.topics) return false;
				const topics = p.topics.split(", ").map((t) => t.trim());
				return selectedTopics.some((sel) => topics.includes(sel));
			});
		}

		if (selectedStages.length > 0) {
			result = result.filter((p) => selectedStages.includes(p.status));
		}

		if (selectedEndorsed.length > 0 && selectedEndorsed.length < 2) {
			const wantYes = selectedEndorsed.includes("yes");
			result = result.filter((p) => (wantYes ? !!p.endorsed : !p.endorsed));
		}

		filtered = result;
	}

	$: problems, extractTests(), extractTopics(), extractStages(), applyFilters();
	$: selectedTests, selectedTopics, selectedStages, selectedEndorsed, applyFilters();
</script>

<div class="filter-container">
	<div class="filter-header">
		<h3>Browse Problems</h3>
		{#if selectedTests.length > 0 || selectedTopics.length > 0 || selectedStages.length > 0 || selectedEndorsed.length > 0}
			<CarbonButton on:click={() => { selectedTests = []; selectedTopics = []; selectedStages = []; selectedEndorsed = []; }} kind="ghost" size="small">Clear Filters</CarbonButton>
		{/if}
	</div>

	<div class="filter-controls">
		{#if allTests.length > 0}
		<div class="filter-group">
			<MultiSelect titleText="Filter by Tests" label="Select tests..." bind:selectedIds={selectedTests} items={allTests} sortItem={() => {}} />
		</div>
		{/if}

		{#if allTopics.length > 0}
		<div class="filter-group">
			<MultiSelect titleText="Filter by Topics" label="Select topics..." bind:selectedIds={selectedTopics} items={allTopics} sortItem={() => {}} />
		</div>
		{/if}

		{#if allStages.length > 0}
		<div class="filter-group">
			<MultiSelect titleText="Filter by Stage" label="Select stage(s)..." bind:selectedIds={selectedStages} items={allStages} sortItem={() => {}} />
		</div>
		{/if}

		<div class="filter-group">
			<MultiSelect titleText="Filter by Endorsed" label="Choose..." bind:selectedIds={selectedEndorsed} items={endorsedOptions} sortItem={() => {}} />
		</div>

		<div class="results-count">
			<p>Showing <strong>{filtered.length}</strong> of <strong>{problems.length}</strong> problems</p>
		</div>
	</div>
</div>

<style>
	.filter-container {
		width: 80%;
		margin: 20px auto;
		background-color: white;
		border: 1px solid var(--primary);
		border-radius: 8px;
		padding: 20px;
	}

	.filter-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		border-bottom: 1px solid #e0e0e0;
		padding-bottom: 10px;
	}

	.filter-controls {
		display: flex;
		gap: 20px;
		align-items: end;
		flex-wrap: wrap;
	}

	.filter-group {
		min-width: 180px;
		flex: 1;
	}

	.results-count {
		margin-left: auto;
		text-align: right;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.results-count p {
		margin: 0;
		color: var(--primary);
	}
</style>

