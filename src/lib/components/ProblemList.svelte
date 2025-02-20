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
		Tag,
	} from "carbon-components-svelte";
	import Rating from "$lib/components/Rating.svelte";
	import { formatDate } from "$lib/formatDate.js";
	import Problem from "$lib/components/Problem.svelte";
	import { sortIDs } from "$lib/sortIDs";
	import Switcher from "carbon-icons-svelte/lib/Switcher.svelte";
	import { createEventDispatcher } from "svelte";
	import { Filter, Trophy } from "carbon-icons-svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import { LogarithmicScale } from "chart.js";

	export let problems = [];
	export let selectable = false;
	export let stickyHeader = false;
	export let selectedItems = [];
	export let nonselectableItems = [];
	export let sortKey = "created_at";
	export let sortDirection = "descending";
	export let editable = true;
	export let disableAll = false; // disables everything from being selectable
	export let customHeaders = [];
	export let draggable = false;
	export let pageEnabled = true;
	export let minWidth = 100;

	export let showList = null;

	// If showList is passed as null by the parent page, then we want to override
	// with this default list.
	if (!showList) {
		showList = [
			"full_name",
			"topics_short",
			"status",
			"endorsed",
			"unresolved_count",
			"problem_tests",
			"created_at",
		];
	}

	const dispatch = createEventDispatcher();

	let width = 0;
	$: maxCols = Math.floor((width - 100) / minWidth);
	$: colWidth = (width - 100) / Math.min(maxCols, showList.length);

	let mobileFriendly = {
		Algebra: "Alg",
		Mixed: "Mx",
		"Number Theory": "NT",
		Combination: "Comb",
		Geometry: "Geo",
	};

	let pageSize = 25;
	let page = 1;

	let editHeader = { key: "edit", value: "", width: "50px" };

	let headers = [
		{
			key: "full_name",
			value: "Author",
			short: "Author",
			icon: "ri-user-fill",
			width: "10%",
		},
		{
			key: "topics_short",
			value: "Topics",
			short: "Topics",
			icon: "ri-pie-chart-2-fill",
			width: "12%",
		},
		{
			key: "sub_topics",
			value: "Subtopics",
			short: "SubTps",
			icon: "ri-node-tree",
			width: "15%",
		},
		{
			key: "average_difficulty",
			value: "Difficulty",
			short: "Diff",
			icon: "ri-bar-chart-2-fill",
			width: "7%",
		},
		{
			key: "average_quality",
			value: "Quality",
			short: "Qlty",
			icon: "ri-star-fill",
			width: "7%",
		},
		{
			key: "unresolved_count",
			value: "Unresolved",
			icon: "ri-flag-fill",
			width: "10%",
		},
		{
			key: "feedback_count",
			value: "Feedback",
			icon: "ri-flag-fill",
			width: "10%",
		},
		{
			key: "status",
			value: "Stage",
			short: "Stage",
			icon: "ri-stairs-fill",
			width: "10%",
			sort: (a, b) => {
				const order = [
					"Draft",
					"Idea",
					"Endorsed",
					"On Test",
					"Published",
					"Archived",
				];
				return order.indexOf(a) - order.indexOf(b);
			},
		},
		{
			key: "endorsed",
			value: "Endorsed",
			short: "Endorsed",
			icon: "ri-feedback-fill",
			width: "10%",
			sort: (a, b) => (a == null ? 1 : 0) - (b == null ? 1 : 0),
		},
		{
			key: "endorse_link",
			value: "Endorse",
			short: "Endorse",
			icon: "ri-feedback-fill",
			width: "10%",
		},
		{
			key: "problem_tests",
			value: "Tests",
			short: "Tests",
			icon: "ri-file-list-3-fill",
			width: "15%",
		},
		{
			key: "created_at",
			value: "Created",
			short: "Create",
			icon: "ri-calendar-event-fill",
			width: "12%",
		},
		{
			key: "edited_at",
			value: "Edited",
			icon: "ri-calendar-todo-fill",
		},
	];

	$: headersF = headers.filter((row) => showList.includes(row.key));
	$: curHeaders = [
		...(editable ? [editHeader] : []),
		...[
			{
				key: "front_id",
				value: "ID",
				icon: "ri-key-2-fill",
				sort: sortIDs,
				width: "90px",
			},
		],
		...headersF.slice(0, maxCols),
		...customHeaders,
	];

	let tableContainerDiv = null;

	// hacky workaround to not being able to get entire rows
	function getRowElement(id) {
		return tableContainerDiv?.querySelector(`[data-row="${id}"]`);
	}

	let listeners = {};
	$: if (draggable && tableContainerDiv && !draggingRow) {
		try {
			for (let i = 0; i < problems.length; i++) {
				const row = problems[i];
				let elem = getRowElement(row.id);
				if (row.id in listeners) {
					elem?.removeEventListener("dragenter", listeners[row.id]);
				}
				listeners[row.id] = (e) => handleDragEnter(e, row);
				elem?.addEventListener("dragenter", listeners[row.id]);
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	let draggingRow = false;
	let draggedRow = null;
	let lastDraggedInd = null;

	function startDrag(e, row) {
		try {
			if (!draggable) return;
			draggingRow = true;
			draggedRow = row;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function handleDragEnter(e, row) {
		try {
			if (!draggable) return;
			if (!draggingRow) return;
			const ind = problems.indexOf(row);
			lastDraggedInd = ind;
			if (row === draggedRow) return;
			e.preventDefault();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function endDrag(e) {
		try {
			if (!draggable) return;
			if (lastDraggedInd !== null) {
				dispatch("reorder", {
					id: draggedRow.id,
					to: lastDraggedInd,
				});
			}
			draggingRow = false;
			draggedRow = null;
			lastDraggedInd = null;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}
</script>

<svelte:window />
<div bind:clientWidth={width} class="align-items: right; display: flex;">
	<MultiSelect
		bind:selectedIds={showList}
		on:select={({ detail }) => {
			localStorage.setItem(
				"problem-list.show-list",
				JSON.stringify(detail.selectedIds)
			);
		}}
		direction="top"
		size="sm"
		label="Filter visible columns"
		items={[
			{
				id: "full_name",
				text: "Author",
			},
			{
				id: "topics_short",
				text: "Topics",
			},
			{
				id: "sub_topics",
				text: "SubTopic",
			},
			{
				id: "average_difficulty",
				text: "Avg. Difficulty",
			},
			{
				id: "average_quality",
				text: "Avg. Quality",
			},
			{
				id: "status",
				text: "Stage",
			},
			{
				id: "endorsed",
				text: "Endorsed",
			},
			{
				id: "unresolved_count",
				text: "Unresolved",
			},
			{
				id: "feedback_count",
				text: "Feedback",
			},
			{
				id: "problem_tests",
				text: "Tests",
			},
			{
				id: "created_at",
				text: "Created on",
			},
			{
				id: "edited_at",
				text: "Edited on",
			},
		]}
	/>
</div>

<div
	{width}
	class="flex-dir-col"
	on:dragover={(e) => e.preventDefault()}
	bind:this={tableContainerDiv}
>
	<DataTable
		size="compact"
		expandable
		sortable
		batchExpansion
		{sortKey}
		{sortDirection}
		{selectable}
		{stickyHeader}
		bind:selectedRowIds={selectedItems}
		nonSelectableRowIds={disableAll
			? problems.map((pb) => pb.id)
			: nonselectableItems}
		class="datatable"
		headers={curHeaders}
		rows={problems}
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
						<Link class="link" href={"/problems/" + row.id}
							><i class="ri-pencil-fill" style="font-size: 20px;" /></Link
						>
					</div>
				{:else if cell.key === "drag"}
					<div
						draggable={true}
						on:dragstart={(e) => startDrag(e, row)}
						on:dragend={(e) => endDrag(e)}
						style="visibility: {disableAll ? 'hidden' : 'visible'}"
						class="drag-div"
					>
						<div
							style="margin-left: 10px;"
							class={problems.findIndex(
								(p) => p.id == row.id && p.id != draggedRow?.id
							) == lastDraggedInd
								? "target-div"
								: ""}
						>
							<Switcher />
						</div>
					</div>
				{:else if cell.key === "problem_number"}
					<div>
						{cell.value + 1}
					</div>
				{:else if cell.key === "topics_short"}
					<div style="overflow: hidden;">
						{#if cell.value == null || cell.value == ""}
							<Tag type="gray">None</Tag>
						{:else}
							{#each cell.value.split(", ") as topic}
								<Tag type="gray">{topic}</Tag>
							{/each}
						{/if}
					</div>
				{:else if cell.key === "author"}
					<div style="overflow: hidden;">
						{cell.value == null || cell.value == ""
							? "None"
							: width > 700
							? cell.value
							: cell.value.split(" ")[0].charAt(0) +
							  cell.value.split(" ")[1].charAt(0)}
					</div>
				{:else if cell.key === "created_at"}
					<div style="overflow: hidden;">
						{cell.value ? formatDate(new Date(cell.value)) : "N/A"}
					</div>
				{:else if cell.key === "edited_at"}
					<div style="overflow: hidden;">
						{cell.value ? formatDate(new Date(cell.value)) : "N/A"}
					</div>
				{:else if cell.key === "unresolved_count"}
					<div style="overflow: hidden;">
						{cell.value ?? 0}
					</div>
				{:else if cell.key === "feedback_count"}
					<div style="overflow: hidden;">
						{cell.value ?? 0}
					</div>
				{:else if cell.key === "average_difficulty" || cell.key === "average_quality"}
					<div
						style="overflow: hidden; display: flex; align-items: flex-start;"
					>
						<Rating
							rating={cell.value}
							size={15}
							count={true}
							round={2}
							style="align-items: left"
						/>
					</div>
				{:else if cell.key === "status"}
					<div
						style="overflow: hidden; display: flex; align-items: flex-start;"
					>
						{#if cell.value == "Draft"}
							<Tag type="gray">Draft</Tag>
						{:else if cell.value == "Idea"}
							<Tag type="blue">Idea</Tag>
						{:else if cell.value == "Endorsed"}
							<Tag type="cyan">Endorsed</Tag>
						{:else if cell.value == "On Test"}
							<Tag type="green">On Test</Tag>
						{:else if cell.value == "Published"}
							<Tag type="purple">Published</Tag>
						{:else if cell.value == "Archived"}
							<Tag type="high-contrast">Archived</Tag>
						{/if}
					</div>
				{:else if cell.key === "endorsed"}
					<div
						style="overflow: hidden; display: flex; align-items: flex-start;"
					>
						{#if cell.value}
							<Tag type="green">{cell.value}</Tag>
						{:else}
							<Tag type="red">{"none"}</Tag>
						{/if}
					</div>
				{:else if cell.key === "endorse_link"}
					<div class="pencil">
						<Link class="link" href={`/problems/endorse?problem_id=${row.id}`}>
							<Trophy />
						</Link>
					</div>
				{:else if cell.key === "problem_tests"}
					<div
						style="overflow: hidden; display: flex; align-items: flex-start;"
					>
						{#if row.problem_tests && row.problem_tests.length > 0}
							{#each row.problem_tests.split(", ") as test}
								<Tag type="warm-gray">{test}</Tag>
							{/each}
						{:else}
							-
						{/if}
					</div>
				{:else}
					<div style="overflow: hidden;">
						{cell.value == null || cell.value == "" ? "-" : cell.value}
					</div>
				{/if}
			</div>
		</svelte:fragment>
		<svelte:fragment slot="expanded-row" let:row>
			<Problem problem={row} />
		</svelte:fragment>
	</DataTable>
	{#if pageEnabled}
		<Pagination
			class="datatable"
			bind:pageSize
			bind:page
			totalItems={problems.length}
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

	.target-div {
		background-color: blue;
		opacity: 20%;
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
</style>
