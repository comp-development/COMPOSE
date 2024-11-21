<script>
	import { getUser, updateUserRole, getThisUser } from "$lib/supabase";
	import { page } from "$app/stores";
	import { Select, SelectItem, FormGroup } from "carbon-components-svelte";
	import ModalButton from "$lib/components/ModalButton.svelte";
	import Loading from "$lib/components/Loading.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import Button from "$lib/components/Button.svelte";

	let userId = $page.params.id;
	let user = {};
	let loading = true;

	let thisUser;

	(async () => {
		thisUser = await getThisUser();
	})();

	let roleDictionary = {
		0: "No role assigned",
		10: "No permissions",
		20: "Problem Contributor",
		30: "Problem Writer",
		33: "Endorser",
		40: "Administrator",
	};

	async function fetchUser() {
		try {
			let userInfo = await getUser(userId);
			user = {
				full_name: userInfo.full_name,
				discord: userInfo.discord,
				email: userInfo.email,
				initials: userInfo.initials,
				role: userInfo.role + "",
			};
			loading = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function addRoleToUser(role) {
		try {
			await updateUserRole(userId, role);
			toast.success("Successfully updated role.");
			window.location.replace("/admin/users");
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	fetchUser();
</script>

{#if loading}
	<Loading />
{:else if !user.full_name}
	<p>User does not exist</p>
{:else}
	<div style="padding: 10px;">
		<h1>{user.full_name}</h1>
		<p><strong>User ID:</strong> {userId}</p>
		<p><strong>Discord:</strong> {user.discord}</p>
		<p><strong>Initials:</strong> {user.initials}</p>
		<p>
			<strong>Email:</strong>
			<a style="color: var(--primary);" href="mailto:{user.email}"
				>{user.email}</a
			>
		</p>
		<FormGroup disabled={userId === thisUser.id}>
			<Select labelText="Role" bind:selected={user.role}>
				{#each Object.entries(roleDictionary) as [key, value]}
					<SelectItem value={key} text={value + " (" + key + ")"} />
				{/each}
			</Select>
			<br />
			<ModalButton
				runHeader="Update Role"
				onSubmit={async () => {
					await addRoleToUser(user.role);
				}}
			/>
			<br /><br />
			<Button title="View All Users" href="/admin/users" />
		</FormGroup>
	</div>
{/if}
