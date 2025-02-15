<script lang="ts">
    import { onMount } from "svelte";
    import { supabase } from "$lib/supabaseClient";
	import { defaultSettings, fetchSettings } from "$lib/supabase/settings";
	let scheme = defaultSettings;
    let loaded = false;
    let rows = [];

    // Fetch data from full_problems and process it
    async function fetchLeaderboard() {
        const { data, error } = await supabase
            .from("full_problems")
            .select(`
                author_id,
                status,
                unresolved_count,
                users(full_name)
            `)
            .eq('archived', false)
			.gt('created_at', scheme.progress.after);

        if (error) {
            console.error("Error fetching problems data:", error);
            return [];
        }

        // Process the data to calculate counts and scores
        const leaderboardMap = new Map();

        data.forEach((problem) => {
            const authorId = problem.author_id;

            if (!leaderboardMap.has(authorId)) {
                leaderboardMap.set(authorId, {
                    full_name: problem.users?.full_name || "Anonymous",
                    on_test_count: 0,
                    endorsed_count: 0,
                    idea_count: 0,
                    needs_review_count: 0,
                    total_score: 0,
                });
            }

            const authorData = leaderboardMap.get(authorId);

            // Update counts based on status
            if (problem.status === "On Test") authorData.on_test_count++;
            if (problem.status === "Endorsed") authorData.endorsed_count++;
            if (problem.status === "Idea") authorData.idea_count++;

            // Update counts based on unresolved_count
            if (problem.unresolved_count > 0) authorData.needs_review_count++;

            // Recalculate total score
            authorData.total_score =
                6 * authorData.on_test_count +
                5 * authorData.endorsed_count +
                3 * authorData.idea_count -
                2 * authorData.needs_review_count;

            leaderboardMap.set(authorId, authorData);
        });

        return Array.from(leaderboardMap.values());
    }

    // Load leaderboard data
    onMount(async () => {
		scheme = await fetchSettings();
        rows = await fetchLeaderboard();
        loaded = true;
    });
</script>

<style>
    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
    }

    th, td {
        text-align: center;
        padding: 10px;
        border: 1px solid #ccc;
        color: white;
    }

    th {
        background-color: var(--primary-dark);
        color: white;
        font-weight: bold;
        vertical-align: middle;
    }

    tr:nth-child(even) {
        background-color: var(--primary-dark);
    }

    tr:hover {
        background-color: var(--primary-light);
    }

    .rank {
        font-weight: bold;
    }

    .total-score {
        font-weight: bold;
    }

    .table-container {
        margin: auto;
        max-width: 800px;
        padding: 20px;
        border-radius: 10px;
        background-color: var(--primary);
    }

    .table-container h1 {
        color: white;
        text-align: center;
    }

    .point-circle {
        display: inline-block;
        width: 40px; /* Adjust size as needed */
        height: 40px; /* Adjust size as needed */
        border-radius: 50%;
        color: black; /* Text color */
        text-align: center;
        line-height: 40px; /* Center text vertically (match height) */
        margin: 0 5px; /* Spacing around circles */
    }

    .gold {
        background-color: gold; /* Gold color */
    }

    .silver {
        background-color: silver; /* Silver color */
    }

    .bronze {
        background-color: #cd7f32; /* Bronze color */
    }

    .light-red {
        background-color: lightcoral; /* Light red color */
    }
</style>

<div class="table-container">
    <h1>Problem Leaderboard</h1>
    {#if !loaded}
        <p>Loading leaderboard...</p>
    {:else}
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Author</th>
                    <th><strong><span class="point-circle gold">6pt</span></strong><br>(On Test)</th>
                    <th><strong><span class="point-circle silver">5pt</span></strong><br>(Endorsed)</th>
                    <th><strong><span class="point-circle bronze">3pt</span></strong><br>(Idea)</th>
                    <th><strong><span class="point-circle light-red">-2pt</span></strong><br>(Needs Review)</th>
                    <th>Total Score</th>
                </tr>
            </thead>
            <tbody>
                {#each rows.sort((a, b) => b.total_score - a.total_score) as row, i}
                    <tr>
                        <td class="rank">{i + 1}</td>
                        <td>
                            {row.full_name || "Anonymous"}
                            {#if i === 0} 🏆
                            {:else if i === 1} 🥇
                            {:else if i === 2} ✨
                            {/if}
                        </td>
                        <td>{row.on_test_count || 0}</td>
                        <td>{row.endorsed_count || 0}</td>
                        <td>{row.idea_count || 0}</td>
                        <td>{row.needs_review_count || 0}</td>
                        <td class="total-score">{row.total_score}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>
