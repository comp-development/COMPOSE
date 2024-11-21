<script>
	import { page } from "$app/stores";
	import {
		Select,
		SelectItem,
		DataTable,
		Link,
		MultiSelect,
	} from "carbon-components-svelte";
	import Loading from "$lib/components/Loading.svelte";
	import { formatDate } from "$lib/formatDate.js";
	import Launch from "carbon-icons-svelte/lib/Launch.svelte";
	import TestsolveList from "$lib/components/TestsolveList.svelte";
	import Button from "$lib/components/Button.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import {
		getTestInfo,
		getAllUsersOrder,
		getTestTestsolvesDetailed,
		addTestsolvers,
		deleteTestsolve,
		getSolverTestsolves,
	} from "$lib/supabase";

	let testId = $page.params.id;
	let loading = true;
	let solver_ids = [];
	let testsolves;
	let test;
	let users = [];

	console.log(testId, loading, solver_ids, testsolves, test, users);

	async function getTest() {
		try {
			loading = true;
			test = await getTestInfo(testId);
			console.log("TEST", test);
			getAllUsers();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function onDelete(id) {
		await deleteTestsolve(id);
		await getTestsolves();
	}

	async function getTestsolves() {
		try {
			console.log("got users");
			testsolves = await getTestTestsolvesDetailed(testId);
			loading = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getAllUsers() {
		try {
			users = await getAllUsersOrder("full_name", "*,test_coordinators(*)");
			console.log("got users");
			getTestsolves();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}
	getTest();
</script>

<div style="padding: 10px">
	{#if loading}
		<Loading />
	{:else}
		<h1>Test {testId}: {test.test_name}</h1>
		<br />
		<Button href={`/tests/${testId}`} title="Go back" />
		<br /><br />
		<h3><strong>Add Testsolves</strong></h3>
		<div class="flex">
			<form on:submit|preventDefault style="width: 50%">
				<MultiSelect
					titleText="Testsolvers"
					label="Select Testsolvers"
					bind:selectedIds={solver_ids}
					items={users.map((item) => ({
						id: item.id,
						text: item.full_name,
					}))}
				/>
				<br />
				<Button
					action={async () => {
						try {
							console.log("USERS", solver_ids);
							if (!solver_ids.length) {
								toast.error("Please select a user");
							} else {
								const solvers = users.filter((obj) =>
									solver_ids.includes(obj.id)
								);
								console.log("TEST", test);
								console.log("SOLVERS", solvers);
								await addTestsolvers(test, solvers);
								toast.success("Success! Added testsolve.");
								await getTestsolves();
							}
						} catch (error) {
							handleError(error);
							toast.error(error.message);
						}
					}}
					title="Add Testsolve"
				/>
			</form>
		</div>
		<br /> <br />
		<h3><strong>Current Testsolves</strong></h3>
		{#if testsolves.length === 0}
			<p>There are no testsolves</p>
		{:else}
			<TestsolveList {onDelete} {testsolves} />
		{/if}
	{/if}
</div>
