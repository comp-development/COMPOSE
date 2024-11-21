<script lang="ts">
	import { page } from "$app/stores";
	import {
		TextInput,
		Select,
		SelectItem,
		TextArea,
	} from "carbon-components-svelte";
	import toast from "svelte-french-toast";
	import ModalButton from "$lib/components/ModalButton.svelte";
	import Button from "$lib/components/Button.svelte";

	import { handleError } from "$lib/handleError";
	import {
		addTestFeedbackQuestion,
		getTestInfo,
		addTestCoordinator,
		getTestCoordinators,
		removeTestCoordinator,
		editTestInfo,
		getFeedbackQuestions,
		archiveTest,
		getAllUsersOrder,
	} from "$lib/supabase";

	let testId = parseInt($page.params.id);
	let test;
	let testCoordinators = [];
	let loading = true;
	let allUsers = [];
	let selectRef;

	let curQuestion = "";
	let feedbackQuestions = [];

	async function addFeedbackQuestion() {
		console.log("addFeedbackQuestion");
		try {
			await addTestFeedbackQuestion({
				test_id: Number(testId),
				question: curQuestion,
			});
			await getFeedbackQuestions(testId);
			curQuestion = "";
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getTest() {
		console.log("getTest");
		try {
			test = await getTestInfo(Number(testId));
			console.log("test", test);
			let queriedCoordinators = await getTestCoordinators(
				Number(testId),
				"*,users(*)"
			);
			console.log(queriedCoordinators);
			testCoordinators = queriedCoordinators.map((tc) => tc.users);

			loading = false;

			let users = await getAllUsersOrder("full_name", "*,test_coordinators(*)");
			allUsers = users.filter(
				(x) => !testCoordinators.some((tc) => tc.id === x.id)
			);

			feedbackQuestions = await getFeedbackQuestions(testId);
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function addTestCoordinatorSubmit() {
		console.log("addTestCoordinatorSubmit");
		try {
			await addTestCoordinator(Number(testId), selectRef.value);
			getTest();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function deleteTestCoordinator(testCoordinatorId: number) {
		console.log("deleteTestCoordinator");
		try {
			await removeTestCoordinator(Number(testId), testCoordinatorId);
			getTest();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function editTest() {
		console.log("editTest");
		try {
			await editTestInfo(
				{
					test_name: test.test_name,
					test_description: test.test_description,
				},
				Number(testId)
			);
			toast.success("Successfully edited test information.");
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function deleteTest() {
		console.log("deleteTest");
		try {
			await archiveTest(testId);
			toast.success("Successfully deleted test.");
			window.location.replace("/admin/tests");
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	getTest();
</script>

<div style="padding: 10px">
	{#if loading}
		<p>Loading...</p>
	{:else}
		<h1>Test {testId}: {test.test_name}</h1>
		<br />
		<form on:submit|preventDefault>
			<ModalButton runHeader="Delete Test" onSubmit={deleteTest} />
		</form>
		<br />
		<br />
		<form on:submit|preventDefault>
			<TextInput label="Name" bind:value={test.test_name} />
			<br />
			<TextArea label="Description" bind:value={test.test_description} />
			<br />
			<Button action={editTest} title="Edit Test" />
		</form>
		<br />
		<br />
		<hr style="width: 60%;" />
		<br />
		<br />
		<h3><strong>Current Test Coordinators</strong></h3>
		{#if testCoordinators.length === 0}
			<p>There are no test coordinators</p>
		{:else}
			<div class="flex" style="width: 99%">
				<div
					class="grid"
					style="padding: 5px;column-gap: 10px;row-gap: 10px;width: 95%;"
				>
					{#each testCoordinators as testCoordinator}
						<div class="flex">
							<p
								style="margin-right: 10px; margin-top: auto; margin-bottom: auto;text-align: left;"
							>
								{testCoordinator.full_name}
							</p>
							<ModalButton
								runHeader="Remove {testCoordinator.full_name}"
								del={true}
								onSubmit={() => deleteTestCoordinator(testCoordinator.id)}
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}
		<br /><br />
		<h3><strong>Add Test Coordinators</strong></h3>
		<form on:submit|preventDefault>
			<div class="flex">
				<div style="width: 60%">
					<Select bind:ref={selectRef}>
						{#each allUsers as user}
							<SelectItem
								value={user.id}
								text="{user.full_name} ({user.initials})"
							/>
						{/each}
					</Select>
				</div>
			</div>
			<br />
			<Button action={addTestCoordinatorSubmit} title="Add Test Coordinator" />
		</form>
		<br />
		<br />
		<hr style="width: 60%;" />
		<br />
		<br />
		<h3><strong>Current Feedback Questions</strong></h3>
		<br />
		<div class="flex">
			<div style="width: 60%">
				{#if feedbackQuestions.length > 0}
					<ol style="text-align: left;">
						{#each feedbackQuestions as question}
							<li style="margin-bottom: 8px;">- {question.question}</li>
						{/each}
					</ol>
				{:else}
					<p>There are no current questions.</p>
				{/if}
			</div>
		</div>

		<br />
		<h3><strong>Add Feedback Questions</strong></h3>
		<div class="flex">
			<div style="width: 60%">
				<TextInput labelText="Feedback Question" bind:value={curQuestion} />
			</div>
		</div>
		<br />
		<Button action={addFeedbackQuestion} title="Submit" />
		<br />
		<br />
	{/if}
</div>
