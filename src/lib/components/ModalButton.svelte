<script>
	import { Button, Modal } from "carbon-components-svelte";
	import TrashCan from "carbon-icons-svelte/lib/TrashCan.svelte";

	let open = false;
	export let runHeader;
	export let onSubmit;
	export let del = false;
	export let stopPropagation = false;
</script>

{#if del}
	<Button
		kind="danger-tertiary"
		iconDescription={runHeader}
		icon={TrashCan}
		on:click={(e) => {
			if (!open) {
				e.preventDefault();
				if (stopPropagation) e.stopPropagation();
			}
			open = true;
		}}
	/>
{:else}
	<Button
		kind="primary"
		class="button"
		size="small"
		type="submit"
		on:click={(e) => {
			if (!open) {
				e.preventDefault();
				if (stopPropagation) e.stopPropagation();
			}
			open = true;
		}}
		style="width: 30em; border-radius: 2.5em; margin: 0; padding: 0;"
	>
		<p
			style="margin-left: auto; margin-right: auto; font-size: 1em;font-weight:
		500;padding: 0;"
		>
			{runHeader}
		</p>
	</Button>
{/if}

<Modal
	bind:open
	modalHeading="{runHeader}?"
	primaryButtonText="Confirm"
	secondaryButtonText="Cancel"
	on:click:button--secondary={(e) => {
		e.preventDefault();
		open = false;
	}}
	on:open
	on:close
	on:submit={() => {
		onSubmit();
		open = false;
	}}
>
	Are you sure you want to perform action "{runHeader}"?
</Modal>

<style>
	:global(.bx--modal-container) {
		width: 40% !important;
	}
	:global(.bx--modal-container .bx--modal-close) {
		outline-color: var(--primary) !important;
		border-color: var(--primary) !important;
		outline: none !important;
		border: none !important;
	}
	:global(.bx--modal-footer .bx--btn--secondary) {
		text-align: center !important;
		font-weight: 700 !important;
	}
	:global(.bx--modal-container .bx--btn--primary) {
		background-color: var(--primary) !important;
		font-weight: 700 !important;
	}
</style>
