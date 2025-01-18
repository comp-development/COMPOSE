<script lang="ts">


</script>


<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	<h1>Talk to CASSIE!</h1>


    <!-- Features:
     - should automatically sync with previous problems and their "difficulty" levels
     -->


    <h2> Train Problem Difficulty Classification </h2>

    <p> Enter a set of problems specific to your math tournament in the following table with their associated difficulty ratings. </p>
    <p> You can also include a solution for a better model! </p>

    <form on:submit={handleSubmit}>
		<input bind:value={$input}/>
		<button type="submit">Send</button>
	</form>
    
    <div style="width:80%; margin: auto;margin-bottom: 20px;">
		<ProblemList {problems} />
	</div>

    <h2> Test Problem Difficulty Classification </h2>

    <p> Enter a set of problems you'd like to classify and see the difficulty rating for. </p>

    <form on:submit={handleSubmit}>
		<input bind:value={$input}/>
		<button type="submit">Send</button>
	</form>


</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	}

	h1 {
		width: 100%;
	}

	c {
		color: #1326f9;
	}
</style>