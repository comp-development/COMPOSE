<script lang="ts">
	import { page } from "$app/stores";
	import toast from "svelte-french-toast";
	import { formatTime } from "$lib/formatDate";

	import TestView from "$lib/components/TestView.svelte";
	import Button from "$lib/components/Button.svelte";
	import { handleError } from "$lib/handleError";
	import {
		getFeedbackQuestions,
		deleteTestsolve,
		getThisUserRole,
		getThisUser,
		getTestsolveFeedbackAnswers,
		getProblemFeedback,
		updateTestsolve,
		addProblemFeedback,
		updateTestsolveFeedbackAnswers,
		getOneTestsolve,
		checkIfTestCoordinator,
		getTestsolveProblemFeedback,
		deleteTestsolveAnswer,
		getTest,
		sendFeedbackMessage,
		getTestCoordinators,
		getUser,
		fetchSettings,
	} from "$lib/supabase";

	let loading = true;
	let disallowed = true;

	let answers = [];
	let feedbackQuestions = {};
	let feedbackAnswers = [];

	let startTime = new Date().getTime();
	let endTime = null;
	let isAdmin: boolean;

	let testsolve = null;
	let solverIds = null;
	let timeElapsed: number;

	timeElapsed = 0; // in ms

	$: timeElapsed =
		testsolve?.time_elapsed * 1000 ??
		new Date(testsolve?.end_time).getTime() -
			new Date(testsolve?.start_time).getTime();

	let user;
	let scheme = {};
	(async () => {
		scheme = await fetchSettings();
		user = await getThisUser();
		await getTestsolve();
		await permissionCheck();
	})();

	async function deleteThisTestsolve() {
		try {
			if (isAdmin) {
				await deleteTestsolve(Number($page.params.id));
				toast.success("Successfully deleted testsolve!");
				window.location.href = "/admin/testsolves";
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getTestsolve() {
		testsolve = await getOneTestsolve(
			Number($page.params.id),
			"*,tests(test_name),testsolvers(solver_id)"
		);

		if (testsolve.length === 0) {
			throw new Error(
				"Testsolve with id " + $page.params.id + " doesn't exist!"
			);
		} else {
			console.log("TESTSOLVE", testsolve);
			solverIds = new Set(testsolve.testsolvers.map((obj) => obj.solver_id));
			console.log("solverIds1", solverIds);
		}
	}

	async function permissionCheck() {
		try {
			if ((await getThisUserRole()) === 40) {
				console.log("Here");
				disallowed = false;
				isAdmin = true;
			}
			console.log("THERE");
			console.log("TESTSOLVE2", testsolve);
			console.log("TEST_ID", testsolve.test_id);

			if (await checkIfTestCoordinator(testsolve.test_id, user.id)) {
				disallowed = false;
				isAdmin = true;
			}
			console.log("solverIds2", solverIds);
			if (solverIds.has(user.id)) {
				disallowed = false;
				isAdmin = false;
				if (testsolve.status == "Not Started") {
					await updateTestsolve(testsolve.id, { status: "Testsolving" });
					await getTestsolve();
				}
			}

			console.log("testsolve", testsolve);

			loading = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function completeTestsolve() {
		console.log("DISPATCH 2");
		await updateTestsolve(testsolve.id, { status: "Reviewing" });
		await getTestsolve();
	}

	async function submitTestsolve() {
		try {
			console.log("Submit");
			await updateTestsolve(testsolve.id, { status: "Complete" });
			await getTestsolve();
			toast.success("Submitted!");

			const testsolve_feedback = await getTestsolveProblemFeedback(
				testsolve.id
			);
			console.log(testsolve_feedback);
			await sendFeedbackMessage(testsolve_feedback);

			const test = await getTest(testsolve.test_id);
			const user_name = (await getUser(user.id)).full_name;
			console.log("USER", user_name);
			const embed = {
				title: test.test_name + " Testsolve Complete!",
				//description: "This is the description of the embed.",
				type: "rich",
				color: parseInt(scheme.discord.embed_color, 16), // You can set the color using hex values
				author: {
					name: user_name,
					//icon_url: "https://example.com/author.png", // URL to the author's icon
				},
				footer: {
					text: "COMPOSE",
					icon_url: scheme.logo, // URL to the footer icon
				},
			};

			const linkButton = {
				type: 2, // LINK button component
				style: 5, // LINK style (5) for external links
				label: "View Testsolve",
				url: scheme.url + "/testsolve/" + Number($page.params.id), // The external URL you want to link to
			};

			const coordinators = await getTestCoordinators(testsolve.test_id);
			console.log("COORD", coordinators);
			for (const coordinator of coordinators) {
				console.log("COOR", coordinator);
				fetch("/api/discord/dm", {
					method: "POST",
					body: JSON.stringify({
						userId: coordinator.coordinator_id,
						message: {
							message: "",
							embeds: [embed],
							components: [
								{
									type: 1,
									components: [linkButton],
								},
							],
						},
					}),
				});
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}
</script>

{#if loading}
	<p>Loading...</p>
{:else if disallowed}
	<p>You are not authorized!</p>
{:else}
	<br />
	{#if isAdmin}
		<Button action={deleteThisTestsolve} title="Delete Testsolve" />
	{/if}
	<br />
	{#if testsolve.status == "Testsolving" && !isAdmin}
		<TestView {testsolve} on:complete={completeTestsolve} />
	{:else}
		<TestView
			{testsolve}
			reviewing
			submittable={testsolve.status != "Complete"}
			on:submit={submitTestsolve}
		/>
		<br />
	{/if}
{/if}

<style>
</style>
