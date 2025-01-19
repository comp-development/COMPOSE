<script>
	import {
		MultiSelect,
		TextInput,
		Form,
		FormGroup,
		TextArea,
		Button,
	} from "carbon-components-svelte";
	import toast from "svelte-french-toast";
	import { onMount } from "svelte";

	import { checkLatex } from "$lib/latexStuff";
	import { ProblemImage } from "$lib/getProblemImages";
	import Problem from "$lib/components/Problem.svelte";
	import LatexKeyboard from "$lib/components/editor/LatexKeyboard.svelte";
	import ImageManager from "$lib/components/images/ImageManager.svelte";
	import { handleError } from "$lib/handleError.ts";
	import { getGlobalTopics } from "$lib/supabase";
	import { supabase } from "$lib/supabaseClient";
	// import { diffWords } from 'diff';
	import DiffMatchPatch from "diff-match-patch"; 

	export let originalProblem = null;
	export let originalImages = [];
	export let onDirty = () => {};

	// function that has the payload as argument, runs when submit button is pressed.
	// if not passed in, submit button is not shown
	export let onSubmit = null;
	let loading = true;

	let topics = originalProblem?.topic ?? []; // This will be a list of integer topic ids
	let all_topics = []; // [{id: 1, text: "Algebra"}]
	let topicsStr = "Select a topic...";
	$: if (topics.length > 0 && all_topics.length > 0) {
		topicsStr = topics
			.map((x) => all_topics?.find((at) => at.id === x)?.text_short)
			.join(", ");
	} else {
		topicsStr = "Select a topic...";
	}

	let subTopic = originalProblem?.sub_topics;
	let difficulty = originalProblem?.difficulty;
	let isDisabled = true;
	let problemFailed = false;
	let submittedText = "";
	let show = true;

	let fields = {
		problem: originalProblem?.problem_latex ?? "What is $1+1$?",
		comment: originalProblem?.comment_latex ?? "Very cool problem",
		answer: originalProblem?.answer_latex ?? "$2$.",
		solution: originalProblem?.solution_latex ?? "Trivially $\\ans{2}$.",
	};
	let fieldrefs = {
		problem: null,
		comment: null,
		answer: null,
		solution: null,
	};
	let latexes = {
		problem_latex: "",
		comment_latex: "",
		answer_latex: "",
		solution_latex: "",
	};
	let fieldList = ["problem", "comment", "answer", "solution"];
	let errorList = [];
	let doRender = false;

	const fileUploadLimit = 5; // # of files that can be uploaded
	const fileSizeLimit = 52428800; // 50 mb
	let problemFiles = originalImages.map((x) => x.toFile());
	$: problemImages = problemFiles.map((x) => ProblemImage.fromFile(x));

	let activeTextarea = null;
	function updateActive() {
		for (const field of fieldList) {
			if (document.activeElement === fieldrefs[field]) {
				activeTextarea = field;
				return;
			}
		}
		activeTextarea = null;
	}

	function addToField(fieldName, fieldValue) {
		fields[fieldName] += fieldValue;
	}

const dmp = new DiffMatchPatch();

let problemHistory = []; // versions and patches

let allVersions = []; // contains reconstructed full versions

let lastVersion; // full text of the last version for comparison

// Function to save a new version or patch to Supabase
async function saveVersionToSupabase() {
    try {
        const { data, error } = await supabase
            .from("problems")
            .update({ diffs: problemHistory })
			.eq('id', originalProblem.id);
        if (error) throw error;
        console.log("Version saved:", data);
    } catch (err) {
        console.error("Failed to save version to Supabase:", err.message);
    }
}

// Function to retrieve version history from Supabase
async function fetchVersionHistoryFromSupabase() {
    try {
        const { data, error } = await supabase
            .from("problems")
            .select("diffs")
			.eq('id', originalProblem.id)
			.single();
        if (error) throw error;
        return data.diffs;
    } catch (err) {
        console.error("Failed to fetch version history from Supabase:", err.message);
        return null;
    }
}

// Function to repopulate `problemHistory` from Supabase
async function loadHistoryFromSupabase() {
	const history = (await fetchVersionHistoryFromSupabase()) ?? [];
    problemHistory = history;
    allVersions = showEditHistory(problemHistory); // Reconstruct full versions for display
	if (problemHistory.length > 0)
	{
		lastVersion = getVersion(problemHistory.length - 1);
	}
}

// Call `loadHistoryFromSupabase` when the component mounts
onMount(() => {
	loadHistoryFromSupabase();
});

async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        console.error("Failed to get user:", error.message);
        return "unknown";
    }
    return data?.user || "unknown";
}

async function getPacificTime() {
    const now = new Date();

    const options = {
        timeZone: "America/Los_Angeles",
        year: "2-digit", // Two-digit year
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true, // Use 12-hour format
    };

    const pacificTime = new Intl.DateTimeFormat("en-US", options).format(now);

    const [date, time] = pacificTime.split(", ");
    return `${date} at ${time}`;
}

async function addVersion() {

	const user = await getCurrentUser();
	const date = await getPacificTime();

    const newVersion = {
		problem: fields.problem,
		comment: fields.comment,
		answer: fields.answer,
		solution: fields.solution,
		kind: "version",
		author: user.email,
		timestamp: date
    };

	if (problemHistory.length == 0) {
		problemHistory.push(newVersion);
		await saveVersionToSupabase();
		lastVersion = structuredClone(newVersion);
		return;
	}

	console.log("last", lastVersion);
	console.log("new", newVersion);

    const diffs = {
    	problem: dmp.diff_main(lastVersion.problem, newVersion.problem),
    	comment: dmp.diff_main(lastVersion.comment, newVersion.comment),
    	answer: dmp.diff_main(lastVersion.answer, newVersion.answer),
    	solution: dmp.diff_main(lastVersion.solution, newVersion.solution),
    };

    dmp.diff_cleanupSemantic(diffs.problem);
    dmp.diff_cleanupSemantic(diffs.comment);
    dmp.diff_cleanupSemantic(diffs.answer);
    dmp.diff_cleanupSemantic(diffs.solution);

    const patch = {
    	problem: dmp.patch_make(lastVersion.problem, diffs.problem),
    	comment: dmp.patch_make(lastVersion.comment, diffs.comment),
    	answer: dmp.patch_make(lastVersion.answer, diffs.answer),
    	solution: dmp.patch_make(lastVersion.solution, diffs.solution),
		kind: "patch",
		author: user.email,
		timestamp: date
    };

    problemHistory.push(patch);
	await saveVersionToSupabase();

	lastVersion = structuredClone(newVersion);

}

// Reconstruct a full version from patches (not used anymore)
function getVersion(versionIndex) {

    if (versionIndex < 0 || versionIndex >= problemHistory.length) {
    	return {
        	problem: "",
        	comment: "",
        	answer: "",
        	solution: ""
      	};
    }

	let reconstructed = structuredClone(problemHistory[0]);

    for (let i = 1; i <= versionIndex; i++) {
    	const patch = problemHistory[i];

        reconstructed.problem = dmp.patch_apply(patch.problem, reconstructed.problem)[0];
        reconstructed.comment = dmp.patch_apply(patch.comment, reconstructed.comment)[0];
        reconstructed.answer = dmp.patch_apply(patch.answer, reconstructed.answer)[0];
        reconstructed.solution = dmp.patch_apply(patch.solution, reconstructed.solution)[0];
      }

    return reconstructed;
}

function showEditHistory(problemHistory) {

	let reconstructed = {
		problem: "",
    	comment: "",
    	answer: "",
    	solution: "",
		author: "",
		timestamp: ""
    };

	let highlighted = {
		problem: "",
    	comment: "",
    	answer: "",
    	solution: "",
		author: "",
		timestamp: ""
    };

	let reconstructedVersions = [];
	let highlightedVersions = [];
    problemHistory.forEach((historyItem) => {
		console.log(historyItem);
    	if (historyItem.kind == "version") {
      		reconstructed = structuredClone(historyItem);
			highlighted = structuredClone(historyItem); 
    	} else if (historyItem.kind == "patch") {
      		const patch = historyItem;

			highlighted.problem = highlightChanges(reconstructed.problem, patch.problem);
            highlighted.comment = highlightChanges(reconstructed.comment, patch.comment);
            highlighted.answer = highlightChanges(reconstructed.answer, patch.answer);
            highlighted.solution = highlightChanges(reconstructed.solution, patch.solution);

			reconstructed.problem = applyPatch(reconstructed.problem, patch.problem);
      		reconstructed.comment = applyPatch(reconstructed.comment, patch.comment);
      		reconstructed.answer = applyPatch(reconstructed.answer, patch.answer);
      		reconstructed.solution = applyPatch(reconstructed.solution, patch.solution);
	
			highlighted.author = patch.author;
			highlighted.timestamp = patch.timestamp;

			reconstructed.author = patch.author;
			reconstructed.timestamp = patch.timestamp;
    	}
		highlightedVersions.push(structuredClone(highlighted));
		reconstructedVersions.push(structuredClone(reconstructed));
    });

  return highlightedVersions;
}

function highlightChanges(originalText, patch) {
	console.log(originalText);
    // Apply the patch to get the updated text
    const [patchedText] = dmp.patch_apply(patch, originalText);

    // Generate diffs between the original and patched text
    const diffs = dmp.diff_main(originalText, patchedText);
    dmp.diff_cleanupSemantic(diffs);

    // Highlight changes
    return diffs
        .map(([operation, text]) => {
            if (operation === 1) {
                // Insertion
                return `<span style="color: green; background-color: #e6ffe6;">${text}</span>`;
            } else if (operation === -1) {
                // Deletion
                return `<span style="color: red; background-color: #ffe6e6; text-decoration: line-through;">${text}</span>`;
            } else {
                // No change
                return text;
            }
        })
        .join("");
}

// Helper function to apply a patch to a string
function applyPatch(originalText, diff) {
	// 'dmp.diff_apply' returns an array where the first element is the updated text
	const result = dmp.patch_apply(diff, originalText);
	return result[0];
}

	function updateFields() {
		try {
			errorList = [];
			let failed = false;
			doRender = false;

			for (const field of fieldList) {
				const fieldErrors = checkLatex(fields[field], field);
				fieldErrors.forEach((x) => (x.field = field));
				errorList.push(...fieldErrors);
				for (const err of fieldErrors) {
					if (err.sev === "err") failed = true;
				}

			}
			if (failed) {
				isDisabled = true;
			} else {
				for (const field of fieldList) {
					latexes[field + "_latex"] = fields[field];
				}
				// force reactivity
				latexes = latexes;

				doRender = true;
				isDisabled = false;
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}
	updateFields();

	async function getTopics() {
		try {
			loading = true;
			const global_topics = await getGlobalTopics();
			all_topics = [];
			for (const single_topic of global_topics) {
				all_topics.push({
					id: single_topic.id,
					text: single_topic.topic,
					text_short: single_topic.topic_short,
				});
			}
			all_topics = all_topics;
			topics = topics;
			loading = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}
	getTopics();

	async function submitPayload(isDraft = false) {
		try {
			isDisabled = true
			if (
				fields.problem &&
				fields.comment &&
				fields.answer &&
				fields.solution &&
				topics
			) {
				if (problemFiles.length > fileUploadLimit) {
					throw new Error("Too many files uploaded");
				} else if (problemFiles.some((f) => f.size > fileSizeLimit)) {
					throw new Error("File too large");
				} else {
					console.log("OGSTATUS", originalProblem?.status)
					console.log(isDraft)
					const status = (isDraft ? "Draft" : (originalProblem?.status == "Draft" || !originalProblem?.status ? "Idea" : originalProblem?.status))
					console.log("STATUS", status)
					const payload = {
						problem_latex: fields.problem,
						comment_latex: fields.comment,
						answer_latex: fields.answer,
						solution_latex: fields.solution,
						topics: topics,
						sub_topics: subTopic,
						difficulty: difficulty ? parseInt(difficulty) : 0,
						edited_at: new Date().toISOString(),
						problem_files: problemFiles,
						status: status,
					};

					await addVersion();
					allVersions = showEditHistory(problemHistory); // !!! Can definitely make more efficient (all the past versions are already displayed)

					submittedText = "Submitting problem...";
					await onSubmit(payload);
					submittedText = isDraft ? "Draft Saved" : "Problem Submitted";
				}
			} else {
				throw new Error("Not all the required fields have been filled out");
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

</script>

<svelte:window on:click={updateActive} />

{#if loading}
	<p>Loading problem editor...</p>
{:else}
	<div class="row editorContainer" style="grid-template-columns: 70% 30%;">
		<div class="col">
			<Form class="editorForm">
				<FormGroup style="display: flex; align-items: end;">
					<MultiSelect
						style="width: 20em; margin-right: 20px"
						bind:selectedIds={topics}
						items={all_topics}
						label={topicsStr}
						required={true}
					/>
					<TextInput
						bind:value={subTopic}
						style="margin-right: 20px;"
						placeholder="Sub-Topic (optional)"
						class="textInput"
						on:input={onDirty}
					/>
					<TextInput
						bind:value={difficulty}
						type="number"
						placeholder="Difficulty (optional)"
						class="textInput"
						on:input={onDirty}
					/>
				</FormGroup>
				<div style="position: relative;">
					<TextArea
						class="textArea"
						labelText="Problem"
						bind:value={fields.problem}
						bind:ref={fieldrefs.problem}
						on:input={updateFields}
						required={true}
						on:input={onDirty}
					/>
					<div style="position: absolute; top: 5px; right: 5px;">
						{#if show}
							<span
								style="cursor: pointer;"
								on:click={() => {
									show = !show;
								}}>&#11167;</span
							>
						{:else}
							<span
								style="cursor: pointer;"
								on:click={() => {
									show = !show;
								}}>&#11165;</span
							>
						{/if}
					</div>
				</div>
				{#if activeTextarea === "problem" && show}
					<div class="stickyKeyboard">
						<LatexKeyboard />
					</div>
				{/if}
				<br />

				<div style="position: relative;">
					<TextInput
						class="textInput"
						labelText="Answer"
						bind:value={fields.answer}
						bind:ref={fieldrefs.answer}
						on:input={() => {updateFields(); onDirty();}}
						required={true}
					/>
					<div style="position: absolute; top: 5px; right: 5px;">
						{#if show}
							<span
								style="cursor: pointer;"
								on:click={() => {
									show = !show;
								}}>&#11167;</span
							>
						{:else}
							<span
								style="cursor: pointer;"
								on:click={() => {
									show = !show;
								}}>&#11165;</span
							>
						{/if}
					</div>
				</div>
				{#if activeTextarea === "answer" && show}
					<div class="stickyKeyboard">
						<LatexKeyboard />
					</div>
				{/if}
				<br />

				<div style="position: relative;">
					<TextArea
						class="textArea"
						labelText="Solution"
						bind:value={fields.solution}
						bind:ref={fieldrefs.solution}
						on:input={() => {updateFields(); onDirty();}}
						required={true}
					/>
					<div style="position: absolute; top: 5px; right: 5px;">
						{#if show}
							<span
								style="cursor: pointer;"
								on:click={() => {
									show = !show;
								}}>&#11167;</span
							>
						{:else}
							<span
								style="cursor: pointer;"
								on:click={() => {
									show = !show;
								}}>&#11165;</span
							>
						{/if}
					</div>
				</div>
				{#if activeTextarea === "solution" && show}
					<div class="stickyKeyboard">
						<LatexKeyboard />
					</div>
				{/if}
				<br />

				<div style="position: relative;">
					<TextArea
						class="textArea"
						labelText="Comments"
						bind:value={fields.comment}
						bind:ref={fieldrefs.comment}
						on:input={() => {updateFields(); onDirty();}}
						required={true}
					/>
					<div style="position: absolute; top: 5px; right: 5px;">
						{#if show}
							<span
								style="cursor: pointer;"
								on:click={() => {
									show = !show;
								}}>&#11167;</span
							>
						{:else}
							<span
								style="cursor: pointer;"
								on:click={() => {
									show = !show;
								}}>&#11165;</span
							>
						{/if}
					</div>
				</div>
				{#if activeTextarea === "comment" && show}
					<div class="stickyKeyboard">
						<LatexKeyboard />
					</div>
				{/if}
				<br />
				<ImageManager add={addToField} />

				<div class="editHistory">
					<h3>Edit History:</h3>
					{#if allVersions && allVersions.length > 0}
						{#each allVersions.slice().reverse() as version, index}
					  		<div class="version" style="margin-bottom: 20px; border: 1px solid #ccc; padding: 10px;">
							<h4>{version.timestamp}, {version.author} (Version {allVersions.length - index})</h4>
							<p><strong>Problem:</strong> {@html version.problem}</p>
							<p><strong>Answer:</strong> {@html version.answer}</p>
							<p><strong>Solution:</strong> {@html version.solution}</p>
							<p><strong>Comments:</strong> {@html version.comment}</p>
					  		</div>
						{/each}
					{:else}
  						<p>No versions available</p>
					{/if}
				  </div>
			</Form>
		</div>

		<div class="col">
			<br />
			<br />
			{#if onSubmit}
				<Button
					kind="tertiary"
					class="button"
					type="submit"
					size="small"
					disabled={isDisabled || problemFailed}
					on:click={() => {submitPayload()}}
					style="width: 30em; border-radius: 2.5em; margin: 0; padding: 0;"
				>
					<p>Submit Problem</p>
				</Button><br><br>
				{#if !originalProblem || originalProblem?.status == "Draft"}
					<Button
						kind="tertiary"
						class="button"
						type="submit"
						size="small"
						disabled={isDisabled || problemFailed}
						on:click={() => {submitPayload(true)}}	
						style="width: 30em; border-radius: 2.5em; margin: 0; padding: 0;"
					>
						<p>Save Draft</p>
					</Button>
				{/if}
				<p>{submittedText}</p>
				<br />
			{/if}
			{#each errorList as err}
				<div style="border: 1px solid black;">
					<p>Error (in {err.field}): {err.error}</p>
					<p>Severity: {err.sev}</p>
				</div>
			{/each}

			{#if doRender}
				<Problem
					problem={latexes}
					showMetadata={false}
					showLatexErrors={true}
					widthPara={100}
					bind:failed={problemFailed}
				/>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(.editorForm) {
		padding: 20px;
	}

	:global(.bx--label) {
		font-weight: 700;
		color: var(--primary);
	}

	:global(.bx--multi-select__wrapper) {
		width: 20em;
		margin-right: 20px;
	}

	:global(.bx--text-area),
	:global(.bx--list-box__field),
	:global(.bx--checkbox-label-text),
	:global(.textInput),
	:global(.bx--modal-header h3),
	:global(.bx--modal-content),
	:global(.bx--text-input),
	:global(.bx--text-input::placeholder) {
		font-family: "Ubuntu", "Roboto", Arial, -apple-system, BlinkMacSystemFont,
			"Segoe UI", Oxygen, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
	}

	:global(.bx--file--label) {
		color: var(--primary) !important;
	}

	:global(.bx--list-box__field:focus) {
		outline-color: var(--primary) !important;
	}

	:global(.bx--text-area:focus) {
		border-color: var(--primary) !important;
		outline-color: var(--primary) !important;
	}

	:global(#button .bx--btn--primary),
	:global(#button .bx--btn--primary:focus) {
		border-color: transparent !important;
		background-color: var(--primary) !important;
	}
	:global(#button .bx--btn--primary p) {
		color: var(--primary-light) !important;
	}
	:global(#button .bx--btn--primary:hover) {
		background-color: var(--primary-light) !important;
	}
	:global(#button .bx--btn--primary:hover p) {
		color: var(--text-color-light) !important;
	}
	:global(#button .bx--btn--primary:focus) {
		border-color: var(--primary-light) !important;
		outline: none !important;
		box-shadow: none !important;
	}

	:global(#button .bx--btn--primary span) {
		margin-left: 50px;
		width: 100%;
		margin-right: auto;
		font-size: 15px;
		padding: 0;
	}
	.editHistory {
    padding: 20px;
    background-color: #f9f9f9;
    border-radius: 8px;
  }

  .version {
    margin-bottom: 20px;
    border: 1px solid #ccc;
    padding: 10px;
    background-color: #fff;
    border-radius: 5px;
  }

  h4 {
    margin: 0;
    font-size: 1.2rem;
  }

  p {
    margin: 5px 0;
  }
	  /* Styling for added and removed text */
	.added {
    	color: green;
    	font-weight: bold;
  	}
  	.removed {
    	color: red;
    	text-decoration: line-through;
  	}

  	.editHistory {
    	margin-top: 20px;
    	background: #f5f5f5;
    	padding: 10px;
    	border-radius: 5px;
  	}

  	.historyItem {
    	margin-bottom: 15px;
  	}

  	.diffContent {
    	padding-left: 20px;
  	}
</style>
