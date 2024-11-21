<script>
	import { user } from "$lib/sessionStore";
	import { supabase } from "$lib/supabaseClient";
	import Banner from "$lib/components/Banner.svelte";
	import Loading from "$lib/components/Loading.svelte";
	import { onMount } from "svelte";
	import { getThisUser } from "$lib/supabase";

	(async () => {
		user.set(await getThisUser());
	})();

	let loaded = false;
	onMount(async () => {
		loaded = true;
	});

	supabase.auth.onAuthStateChange((_, session) => {
		user.set(session?.user);
	});
</script>

<main>
	{#if !loaded}
		<Banner />
		<div class="loadingPage flex">
			<Loading />
		</div>
	{:else}
		<slot />
	{/if}
</main>

<style>
	main {
		padding: 10px;
		min-height: 100vh;
		margin: 0;
		padding: 0;
		background-color: var(--background);
	}

	.loadingPage {
		width: 100vw;
		height: 80vh;
	}
</style>
