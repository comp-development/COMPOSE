<script>
	//This page is for requesting a password reset.  The User will be sent an email and
	//
	import { TextInput} from "carbon-components-svelte";
	import Banner from "$lib/components/Banner.svelte";
	import Button from "$lib/components/Button.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import {resetUserPassword} from "$lib/supabase";


	let email = "";
	let type = "";

	function validateEmail(email) {
		var re =
			/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
		return re.test(email);
	}
	async function resetPassword() {
		try {
			if (validateEmail(email)) {
				if (type == "recovery") {
					toast.success(`Your password has been updated.`);
				} else {
					toast.success(`A reset password email has been sent to ${email}.`);
				}

				await resetUserPassword(email);
			} else {
				toast.error("Your email is not valid!");
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
			<TextInput
				class="input"
				placeholder="Email"
				bind:value={email}
				label="email"
				type="email"
				required
			/>
		</div>
	</div>
	<Button action={resetPassword} title="Send Email" />
</div>
