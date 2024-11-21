<script lang="ts">
	import { onMount } from "svelte";
	import { num_rounds } from "$lib/supabase/guts.ts";
	import { getStatus } from "$lib/supabase/guts.ts";
	import { max_round_display } from "$lib/supabase/guts.ts";
	import { styles } from "$lib/scheme.json";
	let test = "SMT 2024";
	let round = "Guts Round: Score Display";
	let max_per_side = 10;
	let screen_width = screen.width;
	let curr_screen = 0
	let num_screens = 0
	let num_teams = 0
	let status = []
	let seconds = 0
	let minutes = 60
	document.documentElement.style.setProperty('--light', styles["secondary-light"]);
	document.documentElement.style.setProperty('--medium_green', styles["secondary"]);
	document.documentElement.style.setProperty('--yellow', styles["background-dark"]);
	//document.documentElement.style.setProperty('--light', styles["background-dark"]);
	//document.documentElement.style.setProperty('--medium_green', styles["primary"]);
	document.documentElement.style.setProperty('--screen_height', screen.height*0.65 + 'px');

	onMount(async () => {
		status = await getStatus()
		num_teams = await status.length;
		num_screens = Math.ceil(num_teams/max_per_side);
		// await fillInTeams();
		console.log(num_teams)
		await updateTable();
	});

	function calculateIndices(extra) {
		let start = curr_screen * max_per_side + extra;
		let end = Math.min((curr_screen + 1) * max_per_side + extra, status.length);
		return { start, end };
	}

	async function updateTable() {
		status = await getStatus()
		if (curr_screen + 2 >= num_screens) curr_screen = 0;
		else curr_screen += 1;

    };

	setInterval(function() {
    	updateTable();
	}, 5000);

</script>

<div>
	<h1>{test}</h1>
	<p>{round}</p>

	<br />
	{#if max_round_display > 0}
		<p style="font-style: italic;">Please note that all scores after round {max_round_display} will not be shown.</p>
	{/if}
	<div class="wrapper">
	<div id = "leftwrapper">
		<table class="gutsDisplay" id="leftTable">
			<thead>
				<tr class="gutsTr">
					<th class="gutsInfo">Rank</th>
					<th class="gutsInfo teamName">Team Name</th>
					<th class="gutsInfo progress">Progress</th>
					<th class="gutsInfo">Score</th>
				</tr>
			</thead>
			<tbody id = "leftbody">
				{#each Array.from({ length: Math.min(10, status.length) }, (_, i) => i) as i}
					<tr class="gutsTr">
						<td class="gutsResult">{i + 1}</td>
						<td class="gutsResult teamName">{status[i].team_name}</td>
						<td class="gutsResult">
							<div class ="round">
								{#each Array(num_rounds) as __, round}
									<div class="color-box" style="background-color: {status[i].round_colors[round + 1]}; border: 2px solid var(--medium_green);"></div>
								{/each}
							</div>
						</td>
						<td class="gutsResult">{status[i].showing_score}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div id = "rightwrapper">
		<table class="gutsDisplay" id="rightTable">
			<thead>
				<tr class="gutsTr">
					<th class="gutsInfo">Rank</th>
					<th class="gutsInfo teamName">Team Name</th>
					<th class="gutsInfo progress">Progress</th>
					<th class="gutsInfo">Score</th>
				</tr>
			</thead>
			<tbody id = "rightbody">
				{#each Array.from({ length: calculateIndices(max_per_side).end - calculateIndices(max_per_side).start }, (_, i) => i + (calculateIndices(max_per_side).start)) as i}
					<tr class="gutsTr">
						<td class="gutsResult">{max_per_side * (curr_screen + 1) + i % max_per_side + 1}</td>
						<td class="gutsResult teamName">{status[i].team_name}</td>
						<td class="gutsResult">
							<div class ="round">
								{#each Array(num_rounds) as __, round}
									<div class="color-box" style="background-color: {status[i].round_colors[round + 1]}; border: 2px solid var(--medium_green);"></div>
								{/each}
							</div>
						</td>
						<td class="gutsResult">{status[i].score}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	</div>
</div>



<style>
	.color-box {
		width: 18px;
		height: 18px;
		border: 1px solid #000;
		margin: 2px;
  	}

	.wrapper {
		display: flex; /* Use Flexbox */
		width: 100%;
	}


    #leftwrapper {
		flex: 1;
        justify-content: center;
		border-collapse: collapse;
		padding: 10px;
		white-space: nowrap;
		height: var(--screen_height);
        float: left;
		background-color: var(--light);
		border-right: 3px dotted var(--medium_green);
    }

	#rightwrapper {
		flex: 1;
        justify-content: center;
		border-collapse: collapse;
		padding: 10px;
		white-space: nowrap;
		height: var(--screen_height);
        float: right;
		background-color: var(--light);
    } 

	#leftTable {
		float: left;
		background-color: var(--light);
		margin: 10px;
    }

    #rightTable {
		float: right;
        background-color: var(--light);
		margin: 10px;
    }

    .gutsDisplay {
        justify-content: center;
		border-collapse: collapse;
		padding: 10px;
		white-space: nowrap;
    }

    .progress {
        width: 60px;
    }

    .teamName {
        width: 1000px;
    }

	.round {
		display: flex;
		align-items: center;
		border: none;
    }

    .gutsInfo {
		color: white;
		background-color: var(--medium_green);
		padding: 10px;
        border: none;
        text-align: left;
		font-family: var(--font-family);
		font-size: 20px;
		font-weight: bold; /* Makes the text bold */
    	text-shadow: -1px -1px 0 #000, 
			1px -1px 0 #000; ; 
    }

	.gutsResult {
		background-color: var(--light);

		padding: 10px;
        border: none;
        text-align: left;
		font-family: var(--font-family);
		font-size: 20px;
    }

    .gutsTr {
        background-color: #f2f2f2;
    }

</style>
