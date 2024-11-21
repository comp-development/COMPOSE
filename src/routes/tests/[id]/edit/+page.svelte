<script lang="ts">
	import { page } from "$app/stores";
	import ProblemList from "$lib/components/ProblemList.svelte";
	import Button from "$lib/components/Button.svelte";
	import Loading from "$lib/components/Loading.svelte";
	import { TextInput } from "carbon-components-svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import {
		getTestInfo,
		getThisUser,
		editTestInfo,
		getTestProblems,
		addAProblemOnTest,
		deleteAProblemOnTest,
		reorderProblemsOnTest,
		massProblemReordering,
		getThisUserRole,
		getProblems,
	} from "$lib/supabase";

	let testId = Number($page.params.id);
	let test;
	let testCoordinators = [];
	let loading = true;
	let loadingProblems = true;
	let refreshingProblems = false;
	let testProblems = [];
	let allProblems = [];
	let userIsTestCoordinator = false;

	let testVersion = null;
	let testVersionWasChanged = false;

	async function getTest() {
		try {
			test = await getTestInfo(
				testId,
				"*,test_coordinators(users(*)),tournaments(tournament_name)"
			);
			testVersion = test.test_version;

			testCoordinators = test.test_coordinators.map((x) => x.users);
			userIsTestCoordinator =
				!!testCoordinators.find(
					async (tc) => tc.id === (await getThisUser()).id
				) || (await getThisUserRole()) >= 40;
			loading = false;
			await getProblemData();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getProblemData() {
		try {
			let problemList = await getTestProblems(testId);

			//console.log(problemList);
			// filter duplicates ?? idk why they appear
			problemList = problemList.filter(
				(x, i) => problemList[i - 1]?.relation_id !== x.relation_id
			);
			//console.log(problemList);
			testProblems = problemList.map((pb) => ({
				problem_number: pb.problem_number,
				relation_id: pb.relation_id,
				test_id: pb.test_id,
				...pb.full_problems,
			}));
			selectedTest = testProblems.map((pb) => pb.id);
			let allProblemList = await getProblems({ customSelect: "*" });
			console.log("PROBLEMS", allProblemList);

			// prevent problems from appearing twice
			allProblems = allProblemList.filter(
				(pb) => !testProblems.find((tpb) => tpb.id === pb.id)
			);
			//console.log(testProblems, allProblems);

			selectedAll = [];

			loadingProblems = false;
			refreshingProblems = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	let selectedAll = [];
	let selectedTest = []; // should store every id of test problems

	// watch for things getting selected
	$: if (selectedAll.length > 0) {
		let selectedProblem = allProblems.find((pb) => pb.id === selectedAll[0]);
		if (selectedProblem) addProblemToTest(selectedProblem);
		else {
			console.error(
				"Selected problem was null? ID:",
				selectedAll[0],
				"Problems:",
				allProblems
			);
		}
	}

	$: if (selectedTest.length < testProblems.length) {
		let selectedProblem = testProblems.find(
			(pb) => !selectedTest.includes(pb.id)
		);
		if (selectedProblem) removeProblemFromTest(selectedProblem);
	}

	async function addProblemToTest(problem) {
		try {
			selectedAll = [];
			refreshingProblems = true;
			await addAProblemOnTest(testId, problem.id);
			refreshProblems();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function removeProblemFromTest(problem) {
		try {
			selectedAll = [];
			refreshingProblems = true;
			await deleteAProblemOnTest(testId, problem.id);
			refreshProblems();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function refreshProblems() {
		await getProblemData();
	}

	async function handleReorder(e) {
		try {
			refreshingProblems = true;
			let { id, to } = e.detail;
			await reorderProblemsOnTest(testId, id, to);
			refreshProblems();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	// manually reset the problem numbers to 1, 2, ...
	async function fixProblemOrder() {
		try {
			// confirm first
			let shouldReorder = confirm(
				"Are you sure you want to fix problem numbers? Only do this if they are broken."
			);
			if (!shouldReorder) return;

			loadingProblems = true;

			for (let i = 0; i < testProblems.length; i++) {
				const curProblem = testProblems[i];
				if (curProblem.problem_number !== i) {
					// needs reordering
					await massProblemReordering(
						curProblem.test_id,
						curProblem.id,
						i,
						curProblem.relation_id
					);
				}
			}

			loadingProblems = false;

			refreshProblems();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
			refreshProblems();
		}
	}

	function changeVersionInput() {
		testVersionWasChanged = true;
	}

	async function submitVersionChange() {
		try {
			testVersionWasChanged = false; // hide button to prevent multiple tries
			await editTestInfo({ test_version: testVersion }, testId);
			toast.success("Test version changed successfully.");
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	getTest();
</script>

{#if loading}
	<Loading />
{:else}
	<br />
	<h1>Test: {test.test_name}</h1>
	<p><strong>Tournament:</strong> {test.tournaments.tournament_name}</p>
	<p><strong>Description:</strong> {test.test_description}</p>
	<p>
		<strong>Coordinators:</strong>
		{testCoordinators.length === 0
			? "None"
			: testCoordinators.map((tc) => tc.full_name).join(", ")}
	</p>
	<br />
	<Button href={`/tests/${testId}`} title="Go back" /> <br /><br />
	<Button action={fixProblemOrder} title="Fix problem numbers" />
	<br /><br />
	{#if !userIsTestCoordinator}
		<p>You are not a coordinator so you cannot edit the problems!</p>
	{:else if loadingProblems}
		<p>Loading problems...</p>
	{:else}
		<!-- version number -->
		<div style="display: flex; justify-content: center;">
			<div>
				<TextInput
					labelText="Test Version"
					bind:value={testVersion}
					on:input={changeVersionInput}
				/>
				<div
					style="visibility: {testVersionWasChanged
						? 'visible'
						: 'hidden'}; padding-top: 5px;"
				>
					<Button action={submitVersionChange} title="Submit changes" />
				</div>
			</div>
		</div>
		<div class="flex-col">
			<h3>Test Problems</h3>
			<ProblemList
				problems={testProblems}
				selectable
				draggable
				sortKey={"problem_number"}
				sortDirection={"ascending"}
				pageEnabled={false}
				showList={[
					"topics_short",
					"sub_topics",
					"average_difficulty",
					"average_quality",
					"status",
				]}
				bind:selectedItems={selectedTest}
				disableAll={refreshingProblems}
				customHeaders={[
					{ key: "drag", value: "", sort: false, width: "50px" },
					{ key: "problem_number", value: "", icon: "ri-hashtag" },
				]}
				on:reorder={handleReorder}
			/>
		</div>
		<div class="flex-col">
			<h3>All Problems</h3>
			<ProblemList
				problems={allProblems}
				selectable
				showList={[
					"topics_short",
					"sub_topics",
					"average_difficulty",
					"average_quality",
					"status",
				]}
				bind:selectedItems={selectedAll}
				disableAll={refreshingProblems}
			/>
		</div>
	{/if}
{/if}

<style>
	.flex-row {
		display: grid;
		grid-template-columns: 50% 50%;
		width: 100%;
	}

	.flex-col {
		width: 100%;
		padding: 10px;
	}

	:global(.bx--table-expand) {
		width: 3rem !important;
	}
</style>
