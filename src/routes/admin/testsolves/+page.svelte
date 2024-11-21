<script>
	import { formatDate } from "$lib/formatDate";
	import {
		DataTable,
		Link,
		Toolbar,
		ToolbarContent,
		ToolbarSearch,
		MultiSelect,
		Select,
		SelectItem,
	} from "carbon-components-svelte";
	import toast from "svelte-french-toast";
	import Button from "$lib/components/Button.svelte";
	import TestsolveList from "$lib/components/TestsolveList.svelte";
	import { handleError } from "$lib/handleError.ts";
	import {
		deleteTestsolve,
		getAllTestsolvesDetailed,
		getTestInfo,
		addTestsolvers,
		getAllUsers,
		getAllTests,
	} from "$lib/supabase";

	let loading = true;
	let testsolves = [];
	let solver_ids = [];
	let users = [];
	let tests = [];
	let test_id = "";
	let pageSize = 25;
	let page = 1;

	async function getTestsolves() {
		try {
			loading = true;
			testsolves = await getAllTestsolvesDetailed();
			console.log("Testsolves", testsolves);
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getUsers() {
		try {
			users = await getAllUsers();
			console.log(JSON.stringify(users));
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getTests() {
		try {
			tests = await getAllTests();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function onDelete(id) {
		await deleteTestsolve(id);
		await getTestsolves();
	}

	(async () => {
		loading = true;
		await getTests();
		await getTestsolves();
		await getUsers();
		loading = false;
	})();

	$: testsolvesSameWeek = testsolves
		.filter((row) => {
			var today = new Date();
			var nextWeek = Date.parse(
				new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)
			);

			if (nextWeek > new Date(row.end_time)) {
				return false;
			} else {
				return true;
			}
		})
		.map((row) => row.id);

	$: selectors = testsolvesSameWeek.map((id) => `[data-row="${id}"]`).join(",");

	$: styles = `
		<style>
		${selectors} {
			outline: 1.5px solid var(--primary);
		}
		<\/style>
	`;
</script>

<svelte:head>
	{@html styles}
</svelte:head>

<br />
<h1 style="margin-bottom: 5px;">Admin Testsolves</h1>
<br />
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
		<Select labelText="Test" bind:selected={test_id}>
			<SelectItem text="" value="" />
			{#each tests as test}
				<SelectItem text={test.test_name} value={test.id} />
			{/each}
		</Select>
		<br />
		<Button
			action={async () => {
				try {
					console.log("USERS", solver_ids);
					if (!solver_ids.length) {
						toast.error("Please select a user");
					} else {
						const test = await getTestInfo(test_id);
						const solvers = users.filter((obj) => solver_ids.includes(obj.id));
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
<div style="padding: 20px">
	<TestsolveList {onDelete} {testsolves} />
</div>
