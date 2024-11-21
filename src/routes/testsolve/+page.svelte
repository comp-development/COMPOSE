<script lang="ts">
	import { DataTable, Link } from "carbon-components-svelte";
	import Button from "$lib/components/Button.svelte";
	import TestsolveList from "$lib/components/TestsolveList.svelte";
	import { formatDate } from "$lib/formatDate";
	import Loading from "$lib/components/Loading.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import Launch from "carbon-icons-svelte/lib/Launch.svelte";
	import {
		getAllTests,
		getThisUserRole,
		getThisUser,
		getSolverTestsolvesDetailed,
		getAllTestsolves,
		getSelectTestsolves,
	} from "$lib/supabase";

	let loading = true;

	let availableTests = [];
	let testsolves = [];
	let user = null;

	(async () => {
		user = await getThisUser();
		await getTestsolves();
	})();

	async function getTestsolves() {
		try {
			loading = true;
			testsolves = await getSolverTestsolvesDetailed(user.id);
			loading = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}
</script>

<br />
<h1>Testsolving</h1>
<br />
<div>
	{#if loading}
		<Loading />
	{:else if testsolves.length === 0}
		<p>No available testsolves!</p>
	{:else}
		<h4><strong>Open testsolves:</strong></h4>
		<div class="row">
			{#each testsolves as test}
				<div class="box">
					<h3>
						<strong
							>{test.test_name}
							{test.test_version ? "v" + test.test_version : ""}</strong
						>
					</h3>
					<div style="margin-top: 10px">
						<Button
							href="/testsolve/{test.id}"
							title={!test.started ? "Begin solve" : "Continue solve"}
						/>
					</div>
				</div>
			{/each}
		</div>
		<br />
		<h4><strong>Past testsolves:</strong></h4>
		<div style="padding: 10px">
			<TestsolveList {testsolves} adminView={false} />
			<br />
		</div>
	{/if}
</div>

<style>
	.box {
		background-color: var(--text-color-light);
		border: 1px solid var(--primary);
		margin: 10px;
		padding: 10px 20px;
	}
</style>
