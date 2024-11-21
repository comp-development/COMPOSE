<script>
	import {
		DataTable,
		DataTableSkeleton,
		Link,
		Toolbar,
		ToolbarContent,
		ToolbarSearch,
		Pagination,
		MultiSelect,
		Modal,
	} from "carbon-components-svelte";
	import Rating from "$lib/components/Rating.svelte";
	import { formatDate } from "$lib/formatDate.js";
	import Problem from "$lib/components/Problem.svelte";
	import { sortIDs } from "$lib/sortIDs";
	import Switcher from "carbon-icons-svelte/lib/Switcher.svelte";
	import { formatTime } from "$lib/formatDate";
	import { createEventDispatcher } from "svelte";
	import { Filter } from "carbon-icons-svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import { LogarithmicScale } from "chart.js";

	export let testsolves = [];
	export let onDelete = null;

	export let adminView = true;

	export let sortKey = "id";
	export let sortDirection = "descending";
	export let customHeaders = [];
	export let pageEnabled = true;
	export let minWidth = 100;
	export let pageSize = 25;
	export let page = 1;

	export let showList = [
		"status",
		"test_name",
		"test_version",
		"solvers",
		"start_time",
		"elapsed",
	];

	let open = false;

	let width = 0;
	$: maxCols = Math.floor((width - 100) / minWidth);
	$: colWidth = (width - 80) / Math.min(maxCols, showList.length);

	let editHeader = { key: "edit", value: "", width: "30px" };

	let headers = [
		{ key: "status", value: "Status", icon: "ri-information-fill" },
		{ key: "test_name", value: "Test", icon: "ri-archive-fill" },
		{
			key: "test_version",
			value: "Version",
			short: "V.",
			icon: "ri-folders-fill",
		},
		{ key: "solvers", value: "Solvers", icon: "ri-user-fill" },
		{
			key: "start_time",
			value: "Start Time",
			short: "Start",
			icon: "ri-calendar-event-fill",
		},
		{
			key: "elapsed",
			value: "Time Taken",
			short: "Time",
			icon: "ri-timer-fill",
		},
	];

	$: headersF = headers.filter((row) => showList.includes(row.key));
	$: curHeaders = [
		...[editHeader],
		...[
			{
				key: "id",
				value: "ID",
				icon: "ri-key-2-fill",
				width: "90px",
			},
		],
		...headersF.slice(0, maxCols),
		...customHeaders,
	];
</script>

<svelte:window />
<div bind:clientWidth={width} class="align-items: right; display: flex;">
	<MultiSelect
		bind:selectedIds={showList}
		direction="top"
		size="sm"
		label="Filter visible columns"
		items={[
			{
				id: "status",
				text: "Status",
			},
			{
				id: "test_name",
				text: "Test",
			},
			{
				id: "test_version",
				text: "Version",
			},
			{
				id: "solvers",
				text: "Solvers",
			},
			{
				id: "start_time",
				text: "Start Time",
			},
			{
				id: "elapsed",
				text: "Time Taken",
			},
		]}
	/>
</div>

<div class="flex-dir-col" on:dragover={(e) => e.preventDefault()}>
	<DataTable
		size="compact"
		sortable
		{sortKey}
		{sortDirection}
		class="datatable"
		headers={curHeaders}
		rows={testsolves}
		pageSize={pageEnabled ? pageSize : undefined}
		page={pageEnabled ? page : undefined}
	>
		<Toolbar size="sm">
			<ToolbarContent>
				<ToolbarSearch persistent shouldFilterRows />
			</ToolbarContent>
		</Toolbar>
		<svelte:fragment slot="cell-header" let:header>
			{#if colWidth > 120}
				<i class={header.icon} /> {header.value}
			{:else}
				<div style="display: flex; align-items: flex-center;">
					<i
						class={header.icon}
						style="display: flex; align-items: flex-center;"
					/>
					{header.short ? header.short : header.value}
				</div>
			{/if}
		</svelte:fragment>
		<svelte:fragment slot="cell" let:row let:header let:cell>
			<div>
				{#if cell.key === "edit"}
					<div class="pencil">
						{#if !adminView}
							{#if row.status != "Complete"}
								<Link class="link" href={"/testsolve/" + row.id}
									><i class="ri-play-fill" style="font-size: 20px;" /></Link
								>
							{:else}
								<Link class="link" href={"/testsolve/" + row.id}
									><i class="ri-eye-fill" style="font-size: 20px;" /></Link
								>
							{/if}
						{:else if row.status != "Not Started"}
							<Link class="link" href={"/testsolve/" + row.id}
								><i class="ri-eye-fill" style="font-size: 20px;" /></Link
							>
						{:else}
							<i
								class="ri-delete-bin-2-fill clickable-icon"
								style="font-size: 20px;"
								on:click={() => (open = true)}
								on:keydown={() => (open = true)}
							/>
							<div class="pencil">
								<Modal
									bind:open
									modalHeading="Are you sure you want to delete this testsolve?"
									primaryButtonText="Confirm"
									secondaryButtonText="Cancel"
									on:click:button--secondary={(e) => {
										e.preventDefault();
										open = false;
									}}
									on:open
									on:close
									on:submit={() => {
										onDelete(row.id);
										open = false;
									}}
								>
									Are you sure you want to delete this testsolve?
								</Modal>
							</div>
						{/if}
					</div>
				{:else if cell.key === "elapsed"}
					<div style="overflow: hidden;">
						{cell.value == null || cell.value == ""
							? "-"
							: formatTime(cell.value)}
					</div>
				{:else if cell.key === "solvers"}
					<div style="overflow: hidden;">
						{#if !cell.value}
							{"-"}
						{:else if colWidth > 120}
							{cell.value.names.join(", ")}
						{:else}
							{cell.value.initials.join(", ")}
						{/if}
					</div>
				{:else}
					<div style="overflow: hidden;">
						{cell.value == null || cell.value == "" ? "-" : cell.value}
					</div>
				{/if}
			</div>
		</svelte:fragment>
	</DataTable>
	{#if pageEnabled}
		<Pagination
			class="datatable"
			bind:pageSize
			bind:page
			totalItems={testsolves.length}
			pageSizeInputDisabled
		/>
	{/if}
</div>

<style>
	.drag-div {
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: grab;
	}

	.rating {
		align-items: left;
	}

	:global(.bx--data-table--sticky-header) {
		max-height: 800px;
	}

	:global(.bx--table-header-label) {
		white-space: nowrap;
	}

	:global(.bx--data-table-container),
	:global(.bx--pagination) {
		width: 100% !important;
	}

	:global(.bx--table-expand__button) {
		width: 30px;
		height: 50px;
	}

	:global(.bx--list-box__field:focus) {
		outline-color: var(--primary);
	}

	.clickable-icon {
		font-size: 20px;
		cursor: pointer;
	}

	.clickable-icon:hover {
		cursor: pointer;
	}
</style>
