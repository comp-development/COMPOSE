<script lang="ts">
	import { page } from "$app/stores";
	import Grading from "$lib/components/Grading.svelte";
</script>

<Grading
	tournamentId={parseInt($page.params.tournament)}
	testId={parseInt($page.params.test)}
/>
