<script lang="js">
	import TestProblems from "$lib/components/TestProblems.svelte";
    import Button from "$lib/components/Button.svelte";
    import Loading from "$lib/components/Loading.svelte";
    import {
        getProblem,
        getThisUser,
        getRandomProblems,
        addProblemFeedback,
        editProblem,

		addEndorsement

	} from "$lib/supabase";
    import { handleError } from "$lib/handleError";
	import toast from "svelte-french-toast";
    import TestsolveList from "$lib/components/TestsolveList.svelte";
	let startTime = new Date();
	let lastTime = startTime;
	let reviewing = false;
    let problems = [];
    let curIndex = 0;
	let problemFeedback = 
		{
			problem_id: null,
			quality: null,
			difficulty: null,
			feedback: null,
			correct: null,
			solver_id: null,
			testsolve_id: null,
			time_elapsed: 0,
		};
	let loaded = false;
    export let user_id = null;
    export let testsolves = [];
    const changeReviewing = () => {
        reviewing = !reviewing;
    }

    function handleSubmit() {
        if (problemFeedback) {
            console.log("PROBLEM", problems[curIndex])
            console.log("FEEDBACK", problemFeedback);
			addProblemFeedback([problemFeedback]);
            toast.success("Feedback added")
		}
        newProblem();
    }

    function handleEndorse() {
      if (problemFeedback) {
  			addProblemFeedback([problemFeedback]);
        addEndorsement(user_id, problemFeedback.problem_id);
        toast.success("Feedback added")
  		}
      newProblem();
    }


    const newProblem = () => {
        (async () => {
            loaded = false;
            problemFeedback = 
                {
                    problem_id: null,
                    quality: null,
                    difficulty: null,
                    feedback: null,
                    correct: null,
                    solver_id: null,
                    testsolve_id: null,
                    time_elapsed: 0,
                };
            curIndex += 1;
            reviewing = !reviewing;
            loaded = true;
        })();
        
    }
    
    (async () => {
        try {
			if (!user_id) {
				user_id = (await getThisUser()).id;
			}
	    let problem_id = new URLSearchParams(window.location.search).get('problem_id');
	    if (problem_id) {
	    	problems = [await getProblem(Number(problem_id))];
	    }
            problems = problems.concat(await getRandomProblems(user_id, true));
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
        loaded = true;

    })();
    
    
</script>

<br />
<h1>Problem Feedback</h1>
<br />
<div class="test-div">
    {#if !loaded}
        <br />
        <Loading/>
        {:else} 
        <h4><strong>Give Feedback:</strong></h4>
        {#if curIndex < problems.length}
            <div class="problems">
                <TestProblems bind:problemFeedback={problemFeedback} problem={problems[curIndex]} {reviewing} givingFeedback={true} autoUpdate={false}></TestProblems>
            </div>
            <div class = "submit-button">
            {#if !reviewing}
                <Button action={changeReviewing} title="Continue" ></Button>
            {:else}
                <Button action={handleSubmit} title="Submit" ></Button>
                <Button action={handleEndorse} title="Endorse" ></Button>
            {/if}
            </div>
        {:else}
            <h4><strong>No problems left to review. Refreshing may yield new problems.</strong></h4>
        {/if}
    {/if}
    <br/>
    <!--
    {#if loaded}
        <h4><strong>View Past Feedback:</strong></h4>
        <TestsolveList {testsolves} adminView={false} />
    {/if}
    -->
</div>


<style>

	.problems {
		display: flex;
		justify-content: center;
		padding-bottom: 20px;
	}
    .submit-button {
        display:flex;
        justify-content: center;
        align-items: center;
        flex-grow: 1;
        padding-bottom: 20px;
    }
</style>
