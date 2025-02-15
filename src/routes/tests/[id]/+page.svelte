<script lang="ts">
	import { page } from "$app/stores";
	import ProblemList from "$lib/components/ProblemList.svelte";
	import Button from "$lib/components/Button.svelte";
	import { Loading, Checkbox } from "carbon-components-svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import { downloadBlob } from "$lib/utils/download";
	import {
		getTestInfo,
		getTestProblems,
		getThisUser,
		getThisUserRole,
		upsertTestAnswerBoxes,
	} from "$lib/supabase";
	import compilerPath from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
	import rendererPath from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";
	import { $typst as Typst } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";
	import { ImageBucket } from "$lib/ImageBucket";
	import type { ProblemImage } from "$lib/getProblemImages";
	import testSheet from "./test_sheet.typ?url";
	import gutsSheet from "./guts.typ?url";
	import tiebreakerSheet from "./tiebreaker.typ?url";
	import * as scheme from "$lib/scheme.json";

	try {
		Typst.setRendererInitOptions({ getModule: () => rendererPath });
		Typst.setCompilerInitOptions({ getModule: () => compilerPath });
	} catch (e) {
		console.error("compiler may have been initialized", e);
	}

	let testId = Number($page.params.id);
	let test;
	let testCoordinators = [];
	let loading = true;
	let loadingProblems = true;
	let problems = [];
	let userIsTestCoordinator = false;

	let feedback = [];

	let openModal = false;
	let values = [
		"Problems",
		"Problem ID",
		"Answers",
		"Solutions",
		"Comments",
		"Feedback",
		"Standard Layout",
	];
	let selected_values = values.slice(0, 1);

	async function getTest() {
		try {
			test = await getTestInfo(
				testId,
				"*,test_coordinators(users(*)),tournaments(tournament_name,tournament_date),testsolves(test_id,id)"
			);
			testCoordinators = test.test_coordinators.map((x) => x.users);
			userIsTestCoordinator =
				!!testCoordinators.find(
					async (tc) => tc.id === (await getThisUser()).id
				) || (await getThisUserRole()) >= 40;
			getProblems();
			loading = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	//Look a comment
	async function getProblems() {
		try {
			let problemList = await getTestProblems(testId);

			problems = problemList.map((pb) => ({
				problem_number: pb.problem_number,
				...pb.full_problems,
			}));
			loadingProblems = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function downloadTest(e) {
		let original_text = e.target.innerText;
		e.target.innerText = "Processing";

		try {
			const is_selected = (option) =>
				selected_values.find((o) => o == option) != undefined;
			let template_source = testSheet;
			// TODO: consolidate guts, tiebreakers, and standard typst document layouts.
			if (
				test.test_name == "Guts"
				&& !is_selected("Answers")
				&& !is_selected("Solutions")
				&& !is_selected("Standard Layout")
			) {
				template_source = gutsSheet;
			} else if (
				test.test_name.indexOf("Tiebreaker") != -1 
			  && !is_selected("Answers") 
			  && !is_selected("Solutions")
				&& !is_selected("Standard Layout")
			) {
				template_source = tiebreakerSheet;
			}
			const answer_template_body = await fetch(template_source ).then((r) => r.text());

			// TODO: @tweoss (francis) get rid of this hack of using test name directly
			if (test.test_name == "Integration Bee") {
				// Sort by ascending difficulty.
				// TODO: why is this using average_difficulty not difficulty?
				problems = problems.sort(
					(a, b) => a.average_difficulty - b.average_difficulty
				);
				console.log("sorting by difficulty", problems);
			}

			let utf8Encode = new TextEncoder();
			let [year, month, day] = test.tournaments.tournament_date
				.split("-")
				.map((n) => parseInt(n));
			const test_metadata = JSON.stringify({
				name: test.test_name,
				id: "T" + test.id,
				day,
				month,
				year,
				team_test: test.is_team, // TODO: label tests in database as team or individual
				display: {
					answers: is_selected("Answers"),
					solutions: is_selected("Solutions"),
				},
			});
			const test_logo = await fetch(scheme.test_logo).then((r) =>
				r.arrayBuffer()
			);

			await Typst.resetShadow();
			await Promise.all([
				Typst.mapShadow(
					"/assets/test_metadata.json",
					utf8Encode.encode(test_metadata)
				),
				Typst.mapShadow("/assets/test_logo.png", new Uint8Array(test_logo)),
				Typst.mapShadow(
					"/assets/problems.json",
					utf8Encode.encode(JSON.stringify(problems))
				),
				Typst.mapShadow(
					"/answer_sheet_compiling.toml",
					utf8Encode.encode("[config]\nlocal = false")
				),
				Typst.mapShadow("/main.typ", utf8Encode.encode(answer_template_body)),
			]);
			console.log("test metadata", test_metadata);

			let { images, errorList }: { images: ProblemImage[]; errorList: any[] } =
				(
					await Promise.all(
						problems
							.flatMap((p) => [
								p.solution_latex,
								p.problem_latex,
								p.answer_latex,
							])
							.map((latex: string) => ImageBucket.downloadLatexImages(latex))
					)
				).reduce((a, e) => {
					a.errorList = a.errorList.concat(e.errorList);
					a.images = a.images.concat(e.images);
					return a;
				});
			if (errorList.length > 0) {
				throw errorList;
			}

			await Promise.all(
				images.map(async (image) => {
					return await Typst.mapShadow(
						"/problem_images" + image.name,
						new Uint8Array(await image.blob.arrayBuffer())
					);
				})
			);
			console.log(images);

			await new Promise((r) => setTimeout(() => r(1), 1000));
			const pdf_array = await Typst.pdf({ mainFilePath: "/main.typ" });
			downloadBlob(pdf_array, test.test_name + ".pdf", "application/pdf");

			Typst.getCompiler()
				.then(
					async (compiler) =>
						await Promise.all(
							["<box_positions>", "<header_lines>"].map((selector) =>
								compiler.query({
									mainFilePath: "/main.typ",
									selector,
									field: "value",
								})
							)
						)
				)
				.then(([box_positions, header_lines]) => {
					upsertTestAnswerBoxes(
						test.id,
						JSON.stringify({
							box_positions: box_positions[0],
							header_lines: header_lines[0],
						})
					);
				});
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}

		e.target.innerText = original_text;
	}

	getTest();
</script>

<br />
{#if loading}
	<Loading />
{:else}
	<div>
		<h1>Test: {test.test_name}</h1>
		<p><strong>Tournament:</strong> {test.tournaments.tournament_name}</p>
		<p><strong>Description:</strong> {test.test_description}</p>
		<p style="margin-bottom: 5px;">
			<strong>Coordinators:</strong>
		</p>
		<div class="flex">
			<ul style="text-align: left;">
				{#each testCoordinators as coordinator}
					<li>- {coordinator.full_name}</li>
				{/each}
			</ul>
		</div>
		<br />
		{#if userIsTestCoordinator}
			<Button href={`/tests/${testId}/edit`} title="Edit problems" />
			<br /><br />
			<Button href={`/tests/${testId}/testsolve`} title="Manage testsolves" />
			<br /><br />
			<Button
				action={() => {
					openModal = !openModal;
				}}
				title="Open Test"
			/>
			<br /><br />
			<Button href={`/tests/${testId}/feedback`} title="Manage Feedback" />
		{/if}
		{#if loadingProblems}
			<p>Loading problems...</p>
		{:else}
			<div style="width: 80%; margin: auto; padding: 20px;">
				<ProblemList
					{problems}
					showList={[
						"full_name",
						"topics_short",
						"sub_topics",
						"problem_tests",
						// "feedback_status",
						// "average_difficulty",
						// "average_quality",
						"unresolved_count",
					]}
					customHeaders={[
						{ key: "problem_number", value: "", icon: "ri-hashtag" },
						{ key: "endorse_link", value: "Endorse" },
					]}
				/>
			</div>
		{/if}
	</div>

	{#if openModal}
		<div
			class="flex"
			style="background-color: rgba(0,0,0,0.5); position: absolute; top: 0; bottom: 0;right:0;left: 0;z-index: 100;"
		>
			<div
				style="width: 300px; height: max-content; z-index: 101;background-color: white;padding: 10px;position: relative;"
			>
				<div style="position: absolute; top: 5px; right: 8px;">
					<button
						on:click={() => {
							openModal = !openModal;
						}}
						style="font-size: 12px;cursor:pointer;outline: none;border: none;background: none;"
						><i class="fa-solid fa-x" /></button
					>
				</div>

				<p><strong>PDF Options</strong></p>

				{#each values as value}
					<Checkbox bind:group={selected_values} labelText={value} {value} />
				{/each}

				<br />
				<button on:click={downloadTest}>Download Test</button>
				<br /><br />
			</div>
		</div>
	{/if}
{/if}
<br />
