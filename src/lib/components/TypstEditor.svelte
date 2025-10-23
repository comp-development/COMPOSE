<script lang="ts">
	import { $typst as Typst } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";
	import toast from "svelte-french-toast";
	import { Checkbox, TextArea } from "carbon-components-svelte";

	import { fetchSettings } from "../supabase";
	import type { ProblemImage } from "../getProblemImages";
	import { ImageBucket } from "../ImageBucket";
	import { downloadBlob } from "../utils/download";
	import { handleError } from "../handleError";
	import { onMount } from "svelte";
	import * as JSZip from "jszip";

	export let on_template_save: (source: string) => void = (_) => {};
	export let on_answer_position_update: (source: string) => void = (_) => {};
	export let rendererPath: string;
	export let compilerPath: string;
	export let initial_text: string;
	export let test: any;
	export let problems: any[];

	type Extract<T> = T extends (infer U)[] ? U : null;

	let values = ["Problems", "Answers", "Solutions"] as const;
	let selected_values: (typeof values)[number][] = [values[0]];
	let template_body = initial_text;

	let loading = true;

	let dirty = false;

	try {
		Typst.setRendererInitOptions({ getModule: () => rendererPath });
		Typst.setCompilerInitOptions({ getModule: () => compilerPath });
	} catch (e) {
		console.warn("compiler may have already been initialized", e);
	}

	let jszip = new JSZip();
	async function resetShadow() {
		jszip = new JSZip();
		await Typst.resetShadow();
	}
	async function mapShadow(path: string, bytes: Uint8Array) {
		jszip.file(path, bytes);
		await Typst.mapShadow(path, bytes);
	}
	async function downloadZIP() {
		await jszip.generateAsync({ type: "blob" }).then(
			function (blob) {
				const a = document.createElement("a"),
					url = URL.createObjectURL(blob);
				a.href = url;
				a.download = "test_layout.zip";
				document.body.appendChild(a);
				a.click();
				setTimeout(function () {
					document.body.removeChild(a);
					window.URL.revokeObjectURL(url);
				}, 0);
			},
			function (err) {
				toast.error("Failed to generate blob " + err);
			}
		);
	}

	onMount(async () => {
		// Map metadata and problems into the virtual file system.
		await resetShadow();

		let utf8Encode = new TextEncoder();

		const scheme = await fetchSettings();
		const test_logo = await fetch(scheme.test_logo).then((r) =>
			r.arrayBuffer()
		);

		await Promise.all([
			mapShadow("/assets/test_logo.png", new Uint8Array(test_logo)),
			mapShadow(
				"/assets/problems.json",
				utf8Encode.encode(JSON.stringify(problems))
			),
			mapShadow(
				"/answer_sheet_compiling.toml",
				utf8Encode.encode("[config]\nlocal = false")
			),
			mapTestMetadata(),
		]);

		let { images, errorList }: { images: ProblemImage[]; errorList: any[] } = (
			await Promise.all(
				problems
					.flatMap((p) => [p.solution_latex, p.problem_latex, p.answer_latex])
					.map((latex: string) => ImageBucket.downloadLatexImages(latex))
			)
		).reduce(
			(a, e) => {
				a.errorList = a.errorList.concat(e.errorList);
				a.images = a.images.concat(e.images);
				return a;
			},
			{ errorList: [], images: [] }
		);
		if (errorList.length > 0) {
			throw errorList;
		}
		await Promise.all(
			images.map(async (image) => {
				return await mapShadow(
					"/problem_images" + image.name,
					new Uint8Array(await image.blob.arrayBuffer())
				);
			})
		);
		await runCompile();
		loading = false;
	});

	async function mapTestMetadata() {
		const [year, month, day] = test.tournaments.tournament_date
			.split("-")
			.map((n: string) => parseInt(n));

		const is_selected = (option: Extract<typeof selected_values>) =>
			selected_values.find((o) => o == option) != undefined;
		const test_metadata = JSON.stringify({
			name: test.test_name,
			id: "T" + test.id,
			day,
			month,
			year,
			team_test: test.is_team,
			display: {
				problems: is_selected("Problems"),
				answers: is_selected("Answers"),
				solutions: is_selected("Solutions"),
			},
		});
		await mapShadow(
			"/assets/test_metadata.json",
			new TextEncoder().encode(test_metadata)
		);
	}

	async function downloadTest(e: any) {
		let original_text = e.target.innerText;
		e.target.innerText = "Processing";

		try {
			await mapShadow("/main.typ", new TextEncoder().encode(template_body));
			const pdf_array = await Typst.pdf({ mainFilePath: "/main.typ" });
			downloadBlob(pdf_array, test.test_name + ".pdf", "application/pdf");
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}

		e.target.innerText = original_text;
	}

	// https://stackoverflow.com/questions/75988682/debounce-in-javascript
	const debounce = (callback: any, wait: any) => {
		let timeoutId = null;
		return (...args: any) => {
			window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(() => {
				callback(...args);
			}, wait);
		};
	};

	async function runCompile() {
		const begin = performance.now();
		await mapShadow("/main.typ", new TextEncoder().encode(template_body));
		const svg = await Typst.svg({
			mainFilePath: "/main.typ",
		});

		const end = performance.now();
		const rounded = Math.round((end - begin) * 1_000_000) / 1_000_000_000;

		const compileInfo = `Compiled in: ${rounded}s`;
		(
			document.querySelector("#compile-info") as HTMLParagraphElement
		).innerText = compileInfo;
		const svgTarget = document.querySelector("#typst-svg-output");
		svgTarget.innerHTML = svg;
	}

	const debouncedCompile = debounce(runCompile, 250);
</script>

{#if loading}
	<p>Loading compiler...</p>
{/if}

<button on:click={downloadTest}>Download Test</button>
<button
	on:click={() => {
		dirty = false;
		on_template_save(template_body);
	}}
	disabled={!dirty}
>
	Save Template
</button>
<button
	on:click={async () =>
		on_answer_position_update(
			JSON.stringify(
				(
					await Typst.getCompiler().then(async (compiler) =>
						compiler.query({
							mainFilePath: "/main.typ",
							selector: "<box_positions>",
							field: "value",
						})
					)
				)[0]
			)
		)}>Save Answer Positions</button
>
<button on:click={downloadZIP}> Download ZIP </button>

<div style="display: flex; justify-content: center;">
	<div style="display: grid; grid-template-columns: auto auto;">
		<div id="typst-render-container">
			<div class="controls">
				<div style="display: flex;">
					{#each values as value}
						<Checkbox
							style="margin-top: 0;"
							bind:group={selected_values}
							labelText={value}
							{value}
							on:change={async () => {
								await mapTestMetadata();
								await runCompile();
							}}
						/>
					{/each}
				</div>
			</div>
			<div
				class="fullheight"
				style="height: 80vh; border: solid black 2pt; resize: horizontal; overflow: auto;"
			>
				<TextArea
					bind:value={template_body}
					on:input={() => {
						dirty = true;
						debouncedCompile();
					}}
				/>
			</div>
		</div>
		<div>
			<div class="controls">
				<p id="compile-info" />
			</div>
			<div
				style="background-color: white; max-height: 80vh; overflow: scroll; border: solid black 2pt; resize: horizontal;"
			>
				<div id="typst-svg-output" />
			</div>
		</div>
	</div>
</div>

<style>
	:global(.fullheight *) {
		height: 100%;
	}
	:global(.fullheight textarea) {
		font-family: monospace;
		resize: none;
	}
	.controls {
		height: 3em;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
