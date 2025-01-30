<script>
	import { TextInput, PasswordInput } from "carbon-components-svelte";
	import { page } from "$app/stores";
	import Banner from "$lib/components/Banner.svelte";
	import Button from "$lib/components/Button.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import { resetUserPassword, updateUserAuth } from "$lib/supabase";

	let accessToken = "";
	let password = "";
	let newPassword = "";

	//Validates a password making sure that there is 
	function validatePassword(password) {
		var re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9!@#$%^&*]{8,}$/;
		return re.test(password);
	}

	async function updateUser() {
		try {
			clearInterval();
			if (validatePassword(password)) {
				if (password == newPassword) {
					await updateUserAuth(accessToken, password);
					toast.success("Successfully changed password.");
					window.location.href = "/";
				} else {
					throw new Error("Your passwords should match.");
				}
			} else {
				throw new Error(
					"Your password should contain 8 characters, an uppercase and lowercase letter, and a number."
				);
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}
</script>

<Banner />
<br />
<h1>Reset Password</h1>
<div style="padding: 20px;overflow: hidden;">
	<div class="flex" style="width: 100%; margin-bottom: 0.75rem;">
		<div style="width: 30em;">
			<PasswordInput
				bind:value={password}
				class="input"
				placeholder="New password"
			/>
		</div>
	</div>
	<br />
	<div class="flex" style="width: 100%; margin-bottom: 0.75rem;">
		<div style="width: 30em;">
			<PasswordInput
				bind:value={newPassword}
				class="input"
				placeholder="Confirm new password"
			/>
		</div>
	</div>
	<Button action={updateUser} title="Reset Password" />
</div>
