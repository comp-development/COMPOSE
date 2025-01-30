<script>
	import Drawer from "svelte-drawer-component";
	import Banner from "./Banner.svelte";
	import { Link } from "carbon-components-svelte";
	import { page } from "$app/stores";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";
	import {
		getAuthorName,
		getThisUser,
		getThisUserRole,
		signOut,
	} from "$lib/supabase";

	$: path = $page.route.id;

	let open = false;
	let fullname = "";
	let loading = false;
	let width = 0;
	let isAdmin;
	let userRole = 0;
	let user;

	(async () => {
		user = await getThisUser();
		userRole = await getThisUserRole();
		isAdmin = userRole >= 40;
		fullname = await getAuthorName(user.id);
	})();

	const handleSignout = async (e) => {
		e.preventDefault();
		try {
			loading = true;
			await signOut();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		} finally {
			loading = false;
		}
	};
</script>

<svelte:window bind:outerWidth={width} />

<Drawer
	{open}
	size={width > 1350 ? "40%" : width > 770 ? "50%" : "100%"}
	placement="left"
	on:clickAway={() => (open = false)}
>
	<div class="drawer">
		<div class="flex">
			<div class="banner">
				<Banner />
			</div>
		</div>
		<br />
		<div class="menu">
			<Link href="/" class={path == "" ? "active link" : "link"}>
				<p class="linkPara">Home</p>
			</Link>
			{#if userRole}
				{#if userRole >= 20}
					<div class="fixedHr" />
					<Link
						href="/dashboard"
						class={path == "dashboard" ? "active link" : "link"}
					>
						<p class="linkPara">Dashboard</p>
					</Link>
					<Link
						href="/problems/new"
						class={path == "problems/new" ? "active link" : "link"}
					>
						<p class="linkPara">Write New Problem</p>
					</Link>
					<br />
				{/if}
				{#if userRole >= 30}
					<Link
						href="/problems"
						class={path == "problems" ? "active link" : "link"}
					>
						<p class="linkPara">Problem Inventory</p>
					</Link>
					<br />
					<Link
						href="/leaderboard"
						class={path == "leaderboard" ? "active link" : "link"}
					>
						<p class="linkPara">Leaderboard</p>
					</Link>
					<br />
					<Link
						href="/problems/feedback"
						class={path == "problems/feedback" ? "active link" : "link"}
					>
						<p class="linkPara">Give Feedback</p>
					</Link>
					{#if userRole >= 33}
						<Link
							href="/problems/endorse"
							class={path == "problems/endorse" ? "active link" : "link"}
						>
							<p class="linkPara">Endorse Problems</p>
						</Link>
					{/if}
					<Link href="/tests" class={path == "tests" ? "active link" : "link"}>
						<p class="linkPara">View Tests</p>
					</Link>
				{/if}
				{#if userRole >= 10}
					<Link
						href="/testsolve"
						class={path == "testsolve" ? "active link" : "link"}
					>
						<p class="linkPara">View Testsolves</p>
					</Link>
					<div class="fixedHr" />
					<Link
						href="/grading"
						class={path == "grading" ? "active link" : "link"}
					>
						<p class="linkPara">Grade Tests</p>
					</Link>
					<Link
						href="/input-guts"
						class={path == "input-guts" ? "active link" : "link"}
					>
						<p class="linkPara">Grade Guts Tests</p>
					</Link>
					<Link
						href="/display-guts"
						class={path == "display-guts" ? "active link" : "link"}
					>
						<p class="linkPara">Guts Live Scoreboard</p>
					</Link>
				{/if}
				{#if isAdmin}
					<div class="fixedHr" />
					<Link
						href="/admin/grading/upload"
						class={path == "/admin/grading/upload" ? "active link" : "link"}
					>
						<p class="linkPara">Admin: Scans Upload</p>
					</Link>
					<br />
					<Link
						href="/admin/grading/resolve"
						class={path == "/admin/grading/resolve" ? "active link" : "link"}
					>
						<p class="linkPara">Admin: Resolve Conflicts</p>
					</Link>
					<br />
					<Link href="/admin" class={path == "admin" ? "active link" : "link"}>
						<p class="linkPara">Admin: Home</p>
					</Link>
					<br />
					<Link
						href="/admin/users"
						class={path == "admin/users" ? "active link" : "link"}
					>
						<p class="linkPara">Admin: Users</p>
					</Link>
					<br />
					<Link
						href="/admin/tests"
						class={path == "admin/tests" ? "active link" : "link"}
					>
						<p class="linkPara">Admin: Tests</p>
					</Link>
					<br />
					<Link
						href="/admin/testsolves"
						class={path == "/admin/testsolves" ? "active link" : "link"}
					>
						<p class="linkPara">Admin: Testsolves</p>
					</Link>
					<br />
					<Link
						href="/admin/transfer-problem"
						class={path == "admin/transfer-problem" ? "active link" : "link"}
					>
						<p class="linkPara">Admin: Transfer Problem</p>
					</Link>
					<Link
						href="/problems/import"
						class={path == "problems/import" ? "active link" : "link"}
					>
						<p class="linkPara">Admin: Import Problems</p>
					</Link>
					<br />
					<Link
						href="/admin/tournaments"
						class={path == "admin/tournaments" ? "active link" : "link"}
					>
						<p class="linkPara">Admin: Tournaments</p>
					</Link>
				{/if}
				{#if userRole < 10}
					<br />
					<p>You need to be verified to see other links.</p>
				{/if}
			{/if}
			<br />
			<div class="fixedHr" />
			<Link on:click={handleSignout} class="link">
				<p class="linkPara">Sign Out</p>
			</Link>
		</div>
		<div class="bottomBanner">
			<p style="font-weight: 700;">{fullname}</p>
		</div>
	</div>
	<button class="close" on:click={() => (open = false)}>
		<i class="ri-menu-fold-line" />
	</button>
</Drawer>

<button on:click={() => (open = true)} class="unfoldButton">
	<i class="ri-menu-unfold-fill" />
</button>

<style>
	button {
		background-color: var(--primary);
		border: none;
		outline: none;
		color: var(--text-color-light);
		padding: 10px;
		position: fixed;
		top: 20px;
		padding-left: 20px;
		left: 0;
		border-radius: 0 5px 5px 0;
	}

	.close {
		background-color: var(--primary-light);
		z-index: 101;
	}

	.linkPara {
		color: var(--text-color-light);
		text-decoration: none;
		border: none;
		width: 100%;
		height: 5px;
		text-align: right;
	}

	.unfoldButton {
		z-index: 10;
		cursor: pointer;
	}

	.linkPara:hover {
		cursor: pointer;
		color: var(--primary-light);
	}

	.close {
		display: block;
		margin-left: auto;
	}
	.drawer {
		background-color: var(--primary);
		width: 100%;
		height: 100%;
		color: var(--text-color-light);
	}

	.banner {
		border-bottom: 2px solid var(--text-color-light);
		padding-bottom: 5px;
		width: 50%;
		position: relative;
	}

	.banner:before,
	.banner:after {
		position: absolute;
		bottom: -6px;
		left: 0;
		height: 10px;
		width: 10px;
		background: var(--text-color-light);
		content: "";
		border-radius: 5px;
	}

	.banner:after {
		right: 0;
		left: auto;
	}

	.bottomBanner {
		position: fixed;
		bottom: 0;
		background-color: var(--primary-light);
		padding: 20px;
		width: 100%;
	}

	.fixedHr {
		width: 50%;
		border: 1px solid white;
		background-color: white;
		margin-left: auto;
		margin-right: auto;
		margin-top: 10px;
		margin-bottom: 5px;
	}
</style>
