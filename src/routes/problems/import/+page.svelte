<script lang="ts">
	import { TextArea, Select, SelectItem } from "carbon-components-svelte";
	import Button from "$lib/components/Button.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import {
		getThisUser,
		insertTopics,
		getAllUsers,
		bulkProblems,
		getThisUserRole,
	} from "$lib/supabase";

	const regexes = {
		topic: /\\ques\[(\w*)\]/s,
		question: /\\begin\{question\}\s*(.*)\s*\\end\{question\}/s,
		comment: /\\begin\{comment\}\s*(.*)\s*\\end\{comment\}/s,
		answer: /\\begin\{answer\}\s*(.*)\s*\\end\{answer\}/s,
		solution: /\\begin\{solution\}\s*(.*)\s*\\end\{solution\}/s,
		multisolution:
			/\\begin\{solution\*\}\s*\\soln\{(\d+)\}\s*(.*?)\s*\\end\{solution\*\}/gs,
	};

	const texRegex =
		/^(?=\\begin\{question\}\s*(?<question>.*)\s*\\end\{question\})(?=\\begin\{comment\}\s*(?<comment>.*)\s*\\end\{comment\})(?=\\begin\{answer\}\s*(?<answer>.*)\s*\\end\{answer\})(?=\\begin\{solution\}\s*(?<solution>.*)\s*\\end\{solution\}).*$/s;

	const idMap = {
		Alg: 1,
		Combo: 2,
		Geo: 3,
		NT: 4,
		Calc: 5,
	};

	let files;
	let errorMessages = [];
	let payloads = [];
	let success = false;
	let problemText;
	let allUsers;
	let loadedUsers = false;
	let userSelectRef;
	let isAdmin = false;
	let user;

	(async () => {
		user = await getThisUser();
	})();

	$: if (files) {
		checkFiles();
	}

	async function checkFiles() {
		try {
			for (const file of files) {
				const extension = file.name.split(".").pop().toLowerCase();
				if (extension === "tex") {
					const text = await file.text();
					importProblem(text, file.name);
				} else if (extension === "csv") {
					const text = await file.text();
					importCSV(text, file.name);
				} else {
					errorMessages.push(
						`Skipped file ${file.name} because it is not a .tex or .csv file`
					);
				}
			}

			payloads = payloads;
			errorMessages = errorMessages;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function manualAdd() {
		try {
			if (!importProblem(problemText, "")) {
				throw new Error("Manual import failed due to improper format");
			} else {
				problemText = "";
			}
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function importProblem(text, name) {
		try {
			const getResult = (regex) => {
				const res = text.match(regex);
				if (!res) return null;
				return res[1];
			};

			const multisolutionResult = [...text.matchAll(regexes.multisolution)];
			let newSolution = null;
			if (multisolutionResult.length > 0) {
				newSolution = "";
				for (const res of multisolutionResult) {
					let [_, solNum, solText] = res;
					newSolution += `\nSolution ${solNum}:\n\n${solText}\n`;
				}
			}

			const payload = {
				problem_latex: getResult(regexes.question) ?? "",
				comment_latex:
					getResult(regexes.comment) + "\nOriginal File: " + name ?? "",
				answer_latex: getResult(regexes.answer) ?? "",
				solution_latex: newSolution ?? getResult(regexes.solution) ?? "",
				topics: [getResult(regexes.topic) ?? ""],
				sub_topics: "",
				difficulty: 0,
				edited_at: new Date().toISOString(),
				author_id:
					userSelectRef && userSelectRef != "" ? userSelectRef : user.id,
			};
			payloads = [...payloads, payload];
			return true;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function importCSV(text, name) {
		try {
			const rows = parseCSV(text);
			if (!rows || rows.length < 2) {
				errorMessages.push(`CSV file ${name} is empty or not properly formatted.`);
				return;
			}
			const headers = rows[0].map((header) => header.trim().toLowerCase());
			const requiredHeaders = ["problem", "answer", "solution", "topic_ids", "comment"];
			for (const field of requiredHeaders) {
				if (!headers.includes(field)) {
					throw new Error(`CSV file ${name} is missing expected column: ${field}`);
				}
			}
			for (let i = 1; i < rows.length; i++) {
				const row = rows[i];
				if (row.length === 0 || row.every((cell) => cell.trim() === "")) continue;
				let rowObj = {};
				headers.forEach((header, index) => {
					rowObj[header] = row[index] ? row[index].trim() : "";
				});
				const payload = {
					problem_latex: rowObj.problem,
					answer_latex: rowObj.answer,
					solution_latex: rowObj.solution,
					comment_latex: rowObj.comment,
					topics: rowObj.topic_ids ? rowObj.topic_ids.split(",").map((t) => t.trim()) : [""],
					sub_topics: "",
					edited_at: new Date().toISOString(),
					author_id: userSelectRef && userSelectRef != "" ? userSelectRef : user.id,
				};
				payloads = [...payloads, payload];
			}
			return true;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function parseCSV(csvText) {
		const rows = [];
		let currentRow = [];
		let currentValue = "";
		let insideQuotes = false;

		for (let i = 0; i < csvText.length; i++) {
			const char = csvText[i];
			if (char === '"') {
				if (insideQuotes && csvText[i + 1] === '"') {
					currentValue += '"';
					i++;
				} else {
					insideQuotes = !insideQuotes;
				}
			} else if (char === "," && !insideQuotes) {
				currentRow.push(currentValue);
				currentValue = "";
			} else if ((char === "\n" || char === "\r") && !insideQuotes) {
				if (char === "\r" && csvText[i + 1] === "\n") {
					i++;
				}
				currentRow.push(currentValue);
				rows.push(currentRow);
				currentRow = [];
				currentValue = "";
			} else {
				currentValue += char;
			}
		}
		if (currentValue || currentRow.length) {
			currentRow.push(currentValue);
			rows.push(currentRow);
		}
		return rows;
	}

	async function submitProblems() {
		try {
			success = false;
			let payloadList = [];
			for (const payload of payloads) {
				const { topics, ...payloadNoTopics } = payload;
				payloadNoTopics.author_id =
					userSelectRef && userSelectRef != "" ? userSelectRef : user.id;
				payloadList.push(payloadNoTopics);
			}

			let data = await bulkProblems(payloadList);

			let topicList = [];

			for (const payload of payloads) {
				const topics = payload.topics;
				const foundProblem = data.find((pb) =>
					[
						"problem_latex",
						"comment_latex",
						"answer_latex",
						"solution_latex",
					].every((field) => pb[field] === payload[field])
				);

				if (!foundProblem) {
					console.log("error: problem submitted but not found");
				} else {
					for (const tp of topics) {
						if (!idMap[tp]) continue;
						topicList.push({
							problem_id: foundProblem.id,
							topic_id: idMap[tp],
						});
					}
				}
			}

			await insertTopics(topicList);

			payloads = [];
			success = true;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getUserData() {
		try {
			allUsers = await getAllUsers("full_name,id");
			loadedUsers = true;
			isAdmin = (await getThisUserRole()) >= 40;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	getUserData();
</script>

<br />
<h1>Import Problems</h1>
<h4><strong>Please only import your own problems!</strong></h4>

<form on:submit|preventDefault style="padding: 20px;">
	<div>
		<label for="file-upload" class="custom-file-upload">
			&#8593 Upload .tex or .csv files for the problems
		</label>
		<input bind:files multiple type="file" id="file-upload" accept=".tex,.csv" />
	</div>

	<p style="margin-top: 20px;">Or manually add:</p>
	<TextArea
		bind:value={problemText}
		class="textArea"
		style="margin-left: 10%; margin-right: 10%;"
	/>
	<br />
	<Button action={manualAdd} title="Manually add" />

	{#if isAdmin && loadedUsers}
		<Select
			bind:selected={userSelectRef}
			labelText="User To Import As (leave default for yourself)"
		>
			<SelectItem value="" text="" />
			{#each allUsers as user}
				<SelectItem value={user.id} text={user.full_name} />
			{/each}
		</Select>
	{/if}

	<p style="margin-top: 20px;">
		{payloads.length} problems queued to be uploaded
	</p>

	<Button action={submitProblems} title="Import problems" />
</form>

{#if success}
	<p><strong>Successfully Imported Problems</strong></p>
{/if}

{#if errorMessages.length > 0}
	<p>
		Errors:<br />
		{#each errorMessages as err}
			{err}
		{/each}
	</p>
{/if}

<style>
	input[type="file"] {
		display: none;
	}
	.custom-file-upload {
		border: 2px solid var(--primary-light);
		color: var(--primary-light);
		display: inline-block;
		padding: 6px 12px;
		cursor: pointer;
		text-align: center;
		border-radius: 50px;
		font-weight: 500;
	}

	.custom-file-upload:hover {
		background-color: var(--primary-light);
		color: var(--text-color-light);
	}
</style>
