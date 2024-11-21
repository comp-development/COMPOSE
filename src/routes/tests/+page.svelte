<script lang="ts">
	import {
		DataTable,
		Link,
		Toolbar,
		ToolbarContent,
		ToolbarSearch,
		Pagination,
	} from "carbon-components-svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import { getUnarchivedTests } from "$lib/supabase";

	let rows = [];
	let pageSize = 25;
	let page = 1;
	let tournaments = {};

	async function getTests() {
		try {
			const testList = await getUnarchivedTests(
				"*,tournaments(tournament_name)"
			);
			let rowValues = [];

			for (const test of testList) {
				if (!tournaments[test.tournament_id]) {
					tournaments[test.tournament_id] = {
						name: test.tournaments.tournament_name,
						tests: [],
					};
				}
				tournaments[test.tournament_id].tests.push(test);
				rowValues.push({
					id: test.id,
					edit: test.id,
					competition: test.tournaments.tournament_name,
					name: test.test_name,
					description: test.test_description,
					version: test.test_version,
				});
			}

			rows = rowValues;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	getTests();
</script>

<br />
<h1>View Tests</h1>
<br />
<div style="padding: 10px;">
	<DataTable
		sortable
		size="compact"
		headers={[
			{ key: "edit", value: "", width: "50px" },
			{ key: "id", value: "ID", width: "100px" },
			{ key: "competition", value: "Competition" },
			{ key: "name", value: "Name" },
			{ key: "description", value: "Description" },
			{ key: "version", value: "Version" },
		]}
		{rows}
		{pageSize}
		{page}
	>
		<Toolbar size="sm">
			<ToolbarContent>
				<ToolbarSearch persistent shouldFilterRows />
			</ToolbarContent>
		</Toolbar>

		<svelte:fragment slot="cell" let:row let:cell let:rowIndex>
			<div>
				{#if cell.key === "edit"}
					<div class="pencil">
						<Link class="link" href={"/tests/" + row.id}
							><i class="ri-pencil-fill" style="font-size: 20px;" /></Link
						>
					</div>
				{:else}
					<div style="overflow: hidden;">
						{cell.value == null || cell.value == "" ? "None" : cell.value}
					</div>
				{/if}
			</div>
		</svelte:fragment>
	</DataTable>

	<Pagination
		bind:pageSize
		bind:page
		totalItems={rows.length}
		pageSizeInputDisabled
	/>
</div>
