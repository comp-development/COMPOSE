<script>
	import "carbon-components-svelte/css/white.css";
	import {
		Form,
		TextInput,
		NumberInput,
		TextArea,
	} from "carbon-components-svelte";
	import Button from "$lib/components/Button.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import Header from "$lib/components/styles/Header.svelte";
	import { getThisUser, getUser, upsertUserData } from "$lib/supabase";
	export let data;
	let user;
	let loading = false;
	let full_name;
	let discord;
	let discord_id;
	let initials;
	let quote;
	let math_comp_background;
	let amc_score;

	const getProfile = async () => {
		try {
			loading = true;
			user = await getThisUser();
			const data = await getUser(user.id);

			({
				full_name,
				discord,
				initials,
				math_comp_background,
				amc_score,
				discord_id,
			} = data);

			/**if (discord.includes("#")) {
				throw new Error("Must update discord username from discriminator");
			}*/
		} catch (error) {
			if (error.code === "PGRST116" || error.message.includes("Cannot read properties of null")) {
				// no user
				full_name = "";
				discord = "";
				initials = "";
				amc_score = "";
				math_comp_background = "";
			} else {
				handleError(error);
				toast.error(error.message);
			}
		} finally {
			loading = false;
		}
	};

	console.log(user)

	function discordAuth() {
		console.log("user", user.id);
		window.location.replace(`/api/linked-role?userId=${user.id}`);
	}

	async function updateProfile(e) {
		e.preventDefault();
		try {
			if (full_name.length > 100) {
				throw new Error(
					"Full name is too long (if this is an actual issue, please notify us)"
				);
			} else if (full_name.length <= 0) {
				throw new Error("You must enter a full name");
			} /**else if (discord.length > 50) {
				throw new Error("Discord is too long");
			} else if (discord.includes("#")) {
				throw new Error("Must update discord username from discriminator");
			} */ else if (initials.length > 5) {
				throw new Error("Initials are too long");
			} else if (!/^[A-Z]+$/.test(initials)) {
				throw new Error("Initials must be all uppercase letters");
			} /**else if (amc_score < 0 || amc_score > 150) {
				throw new Error("AMC Score needs to be valid");
			} */ else if (math_comp_background.length <= 0) {
				throw new Error("Math competition background cannot be empty");
			} else {
				loading = true;
				const user = await getThisUser();

				const updates = {
					id: user.id,
					full_name,
					initials,
					math_comp_background,
					email: user.email,
				};

				await upsertUserData(updates);
				toast.success("Successfully updated profile.");
			}
		} catch (error) {
			if (error.code === "23505") {
				toast.error(
					"You must enter a unique set of initials (try adding another letter)"
				);
			} else {
				handleError(error);
				toast.error(error.message);
			}
		} finally {
			loading = false;
		}
	}

	getProfile();
</script>

<Header fontSize="5em" type="level1">Welcome, {full_name}</Header>
<h4 class="quote">
	{#if data.quote}
		"{data.quote.q}" - {data.quote.a}
	{:else}
		Loading inspirational quote...
	{/if}
</h4>
<div class="flex profileButtons">
	<div>
		<Header type="level3">Profile</Header>

		<Form on:submit={updateProfile}>
			<div class="row">
				<TextInput
					placeholder="Full Name"
					class="inputField"
					bind:value={full_name}
				/>
				<TextInput
					placeholder="Initials"
					class="inputField"
					bind:value={initials}
				/>
				<!--
				<TextInput
					readonly
					placeholder="Discord"
					class="inputField"
					bind:value={discord}
				/>
				<NumberInput
					placeholder="Best AMC 10/12 score (optional)"
					class="inputField"
					min={0}
					max={150}
					step={0.1}
					bind:value={amc_score}
				/>
				-->
			</div>
			<br />
			<TextArea
				placeholder="Math Competition Background"
				class="inputField"
				bind:value={math_comp_background}
			/> <br />
			<Button title="Submit" fontSize="1.5em" />
			<br />
			<br />
		</Form>
		{#if !discord_id}
			<Button
				action={discordAuth}
				title="Connect"
				classs="discordbutton"
				fontSize="1.5em"
				icon="fa-brands fa-discord"
			/>
		{:else}
			<Button
				title={discord}
				classs="disabled discordbutton"
				fontSize="1.5em"
				icon="fa-brands fa-discord"
			/>
		{/if}
		<br />
	</div>
</div>

<style>
	.quote {
		margin-bottom: var(--large-gap);
		font-style: italic;
	}
</style>
