<script>
	import { DataTable, Modal, TextInput } from "carbon-components-svelte";
	import JSZip from "jszip";
	import { writable } from "svelte/store";
	import { uploadScan } from "$lib/supabase";
	import { onMount } from "svelte";
	import QrScanner from "qr-scanner";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError";
	import Button from "$lib/components/Button.svelte";
	

	// When rendering to canvas, the scaling we use.
	const PDF_SCALE = 2.0;
	// Location in pts of the top right qr code
	const TEST_ID_PAGE_BOX = { left: 465, top: 14, width: 70, height: 70 };
	// Location in pts of the sticker qr code (test taker ID)
	const FRONT_ID_BOX = { left: 335, top: 130, width: 57.6, height: 57.6 };
	// Location in pts of bottom left alignment dot.
	const ALIGNMENT_DOT_BOX = { left: 59, top: 748, width: 28, height: 28 };
	// How many pts to expand the bounding boxes when looking to recognize the qr codes.
	const QR_SEARCH_PADDING = 50;

	let files = [];
	let pngs_to_upload = new Map();
	let unnamed_discriminators = { test: 0, front: 0 };
	let selectedRow = writable(null);
	let showModal = writable(false);

	$: if (files) {
		(async () => {
			try {
				await handleFileUpload();
			} catch (error) {
				handleError(error);
				toast.error(error.message);
			}
		})();
	}

	function initializePDFJS() {
		let pdf_js_loaded = new Promise(async (resolve, reject) => {
			let counter = 0;
			function is_pdf_js_loaded() {
				if (typeof pdfjsLib !== "undefined") {
					resolve();
				} else {
					counter += 1;
					// 10 seconds later, if pdf js has not loaded, throw an error.
					if (counter > 100) {
						reject("PDF.js did not load in 10 seconds.");
					}
					// Every .1 seconds
					setTimeout(is_pdf_js_loaded, 100);
				}
			}
			is_pdf_js_loaded();
		});

		pdf_js_loaded.then(() => {
			console.log("pdf.js loaded");
			pdfjsLib.GlobalWorkerOptions.workerSrc =
				"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
		});
	}

	onMount(initializePDFJS);

	async function handleFileUpload() {
		const filesToProcess = [];
		for (const file of files) {
			if (
				file.type === "application/zip" ||
				file.type === "application/x-zip-compressed"
			) {
				filesToProcess.push(...(await unzipFile(file)));
			} else {
				filesToProcess.push(file);
			}
		}

		console.log(filesToProcess);
		const file_pngs = await Promise.all(
			filesToProcess.map(async (file) => [
				file.name,
				await convertToPngs(await file.arrayBuffer()),
			])
		);
		const expand_box = (bounding_box) => {
			const b = bounding_box;
			return {
				x: (b.left - QR_SEARCH_PADDING) * PDF_SCALE,
				y: (b.top - QR_SEARCH_PADDING) * PDF_SCALE,
				width: (b.width + 2 * QR_SEARCH_PADDING) * PDF_SCALE,
				height: (b.height + 2 * QR_SEARCH_PADDING) * PDF_SCALE,
			};
		};

		const scan_box = (png, bounding_box) => {
			return new Promise((resolve, reject) =>
				QrScanner.scanImage(png, {
					scanRegion: expand_box(bounding_box),
					returnDetailedScanResult: true,
				})
					.then(resolve)
					.catch((e) => reject(e || "ERROR: QR not found"))
			);
		};
		const scan_test_id = async (png, test_id_page_box) => {
			const { data: test_id_page, cornerPoints } = await scan_box(
				png,
				test_id_page_box
			);
			// Assert that the test id matches a certain pattern.
			if (!test_id_page.match(/T\d+P\d+/)) {
				throw "Expected test and page id in T\\d+P\\d+ format.";
			}
			const [start, end] = test_id_page.split("P");
			const test_id = start.substr(1);
			// Convert from 1 indexed to 0 indexed.
			const page = parseInt(end) - 1;
			console.log(cornerPoints);
			return { test_id, page, cornerPoints };
		};
		const scan_front_id = async (png, front_id_box) => {
			let { data: front_id } = await scan_box(png, front_id_box);
			if (!front_id.match(/\d{3}(([ABCDEF] Individual)|( Team))/)) {
				throw `Expected front id in \\d{3}(([ABCDEF] Individual)|( Team)) format. Instead got ${front_id}`;
			}
			front_id = front_id.replace(" Team", "");
			front_id = front_id.replace(" Individual", "");
			return { front_id };
		};
		const scan_boxes = async (
			png,
			test_id_page_box,
			front_id_box,
			alignment_dot_box
		) => {
			// We absolutely demand that the test and page qr code be visible.
			// Otherwise, we consider this scan unreadable.
			const { test_id, page, cornerPoints } = await scan_test_id(
				png,
				test_id_page_box
			);
			let front_id;
			try {
				let cornerPoints, dot_location;
				dot_location = await detect_alignment_dot(
					png,
					expand_box(alignment_dot_box)
				);
				console.log(dot_location);
				({ front_id } = await scan_front_id(png, front_id_box));
				png = await apply_transform(
					png,
					test_id_page_box,
					alignment_dot_box,
					cornerPoints,
					dot_location
				);
			} catch (e) {
				console.log("Warning: error scanning" +  e.message);
			}

			if (!front_id) {
				unnamed_discriminators.front += 1;
				front_id = "ERROR: QR not found (" + unnamed_discriminators.front + ")";
			}

			return {
				test_id,
				page: page ?? "0",
				front_id: front_id,
				png,
			};
		};

		for (const [file_name, pngs] of file_pngs) {
			for (const png of pngs) {
				// Try to get either the top right or the bottom left qr boxes.
				const {
					test_id,
					page,
					front_id,
					png: matched_png,
				} = await Promise.any([
					scan_boxes(png[0], TEST_ID_PAGE_BOX, FRONT_ID_BOX, ALIGNMENT_DOT_BOX),
					scan_boxes(png[1], TEST_ID_PAGE_BOX, FRONT_ID_BOX, ALIGNMENT_DOT_BOX),
				]).catch((e) => {
					toast.error("Error scanning: " + e);
					console.log("Error scanning:", e);
					unnamed_discriminators.test += 1;
					unnamed_discriminators.front += 1;
					return {
						test_id: "ERROR: QR not found (" + unnamed_discriminators.test + ")",
						page: "0",
						front_id: "ERROR: QR not found (" + unnamed_discriminators.front + ")",
						png: png[0],
					};
				});
				const identifier = test_id + page + front_id;

				// Handle already loaded conflicts.
				if (pngs_to_upload.has(identifier)) {
					let message = `Found duplicated identifier: T${test_id}P${page} ${front_id} in ${file_name}. \
						Conflicts with ${pngs_to_upload.get(identifier).file_name}`;
					toast.error(message);
					console.error(message);
				}
				pngs_to_upload.set(identifier, {
					file_name,
					matched_png,
					blob_url: URL.createObjectURL(matched_png),
					test_id,
					page: page.toString(),
					front_id,
				});
			}
		}
		// Trigger svelte to run listeners.
		pngs_to_upload = pngs_to_upload;
	}

	async function unzipFile(zipFile) {
		const zip = new JSZip();
		const zipData = await zip.loadAsync(zipFile);

		const fileList = [];
		zipData.forEach(async (relativePath, zipEntry) =>
			fileList.push([relativePath, zipEntry])
		);

		// Mac Finder-generated zip files contain extra __MACOSX files that are redundant.
		const extracted_files = fileList
			.filter(
				([_, zipEntry]) =>
					!zipEntry.dir &&
					!zipEntry.name.startsWith("__MACOSX") &&
					zipEntry.name.endsWith(".pdf")
			)
			.map(([_relativePath, zipEntry]) => {
				return new Promise(async (resolve, _reject) => {
					const extractedFileData = await zipEntry.async("arraybuffer");
					const extractedFile = new File([extractedFileData], zipEntry.name);
					resolve(extractedFile);
				});
			});

		return Promise.all(extracted_files);
	}

	// Returns the rendered PDF file as a blob and as rotated.
	function convertToPngs(file) {
		const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(file) });

		// Render a single pdf page onto a canvas with pdf.js
		const convert_page_to_png = async (page, canvasdiv) => {
			const viewport = page.getViewport({ scale: PDF_SCALE });

			const canvas = document.createElement("canvas");
			canvasdiv.appendChild(canvas);

			// Prepare canvas using PDF page dimensions
			const context = canvas.getContext("2d");
			canvas.height = viewport.height;
			canvas.width = viewport.width;

			// Render PDF page into canvas context
			const renderContext = { canvasContext: context, viewport: viewport };

			const renderTask = page.render(renderContext);
			const [blob, rotated_blob] = await renderTask.promise.then(async () => {
				const unrotated = await new Promise((resolve) => {
					canvas.toBlob(resolve);
				});
				context.translate(canvas.width / 2, canvas.height / 2);
				context.rotate(Math.PI);
				context.drawImage(
					context.canvas,
					0,
					0,
					canvas.width,
					canvas.height,
					-canvas.width / 2,
					-canvas.height / 2,
					canvas.width,
					canvas.height
				);

				const rotated = await new Promise((resolve) => {
					canvas.toBlob(resolve);
				});
				return [unrotated, rotated];
			});

			canvas.remove();
			return [blob, rotated_blob];
		};

		return loadingTask.promise.then(
			async (pdf) => {
				const canvas_div = document.getElementById("canvas");
				const totalPages = pdf.numPages;
				console.log(`processing ${totalPages} pages`);
				let data = [];

				for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
					let page = await pdf.getPage(pageNumber);
					data.push(await convert_page_to_png(page, canvas_div));
				}
				return data;
			},
			function (reason) {
				// PDF loading error
				console.error(reason);
			}
		);
	}

	async function upload_scans() {
		try {

			await Promise.all(
				pngs_to_upload
					.entries()
					.map(([_, png]) =>
						uploadScan(png.matched_png, png.test_id, png.page, png.front_id)
					)
			);
			const message = `Successfully uploaded ${pngs_to_upload.size} scan(s)`;
			toast.success(message);
			pngs_to_upload.clear();
			pngs_to_upload = pngs_to_upload;
			
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function openModal(row) {
		selectedRow.set(row);
		showModal.set(true);
		console.log(`Opening Modal`);
		console.log(row);
		console.log($selectedRow);
		console.log($showModal);
	}

	function deleteRow(row) {
			const identifier = row.test_id + row.page + row.front_id;
			pngs_to_upload.delete(identifier);
			pngs_to_upload = pngs_to_upload;
	}

	async function saveChanges() {
		const row = $selectedRow;
		pngs_to_upload.set(row.id, row);
		pngs_to_upload = pngs_to_upload;
		showModal.set(false);
	}

	const sum = (values) => values.reduce((a, b) => a + b, 0);

	async function detect_alignment_dot(png, box) {
		const canvasdiv = document.getElementById("canvas");
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		canvasdiv.appendChild(canvas);
		const image_bitmap = await createImageBitmap(png);
		canvas.width = image_bitmap.width;
		canvas.height = image_bitmap.height;
		context.drawImage(image_bitmap, 0, 0);
		// console.log(canvas.width, canvas.height, box);
		box.width = Math.min(canvas.width - box.x, box.width);
		box.height = Math.min(canvas.height - box.y, box.height);
		const image_data_o = context.getImageData(
			box.x,
			box.y,
			box.width,
			box.height
		);
		const image_data = image_data_o.data;
		const take_while = (start, end, step, predicate) => {
			// uint8 array. RGBA => 4 entries per color.
			let index = start * 4;
			while (index < end * 4 && predicate(image_data.slice(index, index + 4))) {
				index += step * 4;
			}
			return [index / 4, (index / 4 - start) / step];
		};
		const black = ([r, g, b, _a]) => r + g + b < 3 * 80;
		const white = (colors) => !black(colors);
		const get_lengths = (start, end, step, predicates) => {
			let [index, output] = [start, []];
			for (const p of predicates) {
				const [new_index, steps] = take_while(index, end, step, p);
				output.push(steps);
				index = new_index;
			}
			return output;
		};
		const norm = (values) => Math.sqrt(sum(values.map((v) => Math.pow(v, 2))));
		const normalize = (values) => values.map((v) => v / norm(values));

		// Calculate dot product against expected ratio.
		const calculate_dot = (lengths, ratios) => {
			lengths = lengths.slice(1, -1);
			if (norm(lengths) == 0) {
				return Number.NEGATIVE_INFINITY;
			}
			lengths = normalize(lengths);
			return sum(lengths.map((l, i) => l * ratios[i]));
		};

		// Pattern is lots of white, then 1 black, 1 white, 3 black, 1 white, 1
		// black, then lots of white. Explicitly, WW...WWBWBBBWBWW..WW.
		const predicates = [white, black, white, black, white, black, white];
		const ratios = normalize([1, 1, 3, 1, 1]);
		let [best_rows, best_cols] = [[], []];
		for (let row = 0; row < box.height; row++) {
			const lengths = get_lengths(
				row * box.width,
				(row + 1) * box.width,
				1,
				predicates
			);
			const dot = calculate_dot(lengths, ratios);
			if (dot > 0.9) {
				best_rows.push(row);
			}
		}
		for (let col = 0; col < box.width; col++) {
			const lengths = get_lengths(
				col,
				col + (box.height - 1) * box.width,
				box.width,
				predicates
			);
			const dot = calculate_dot(lengths, ratios);
			if (dot > 0.9) {
				best_cols.push(col);
			}
		}

		if (best_cols.length == 0 || best_rows.length == 0) {
			throw "Alignment dot not detected.";
		}

		const best_col = sum(best_cols) / best_cols.length;
		const best_row = sum(best_rows) / best_rows.length;

		canvas.remove();
		return [best_col + box.x, best_row + box.y];
	}

	async function apply_transform(
		png,
		test_id_page_box,
		alignment_dot_box,
		corner_points,
		dot_location
	) {
		const canvasdiv = document.getElementById("canvas");
		const canvas = document.createElement("canvas");
		canvasdiv.appendChild(canvas);
		const image_bitmap = await createImageBitmap(png);
		canvas.width = image_bitmap.width;
		canvas.height = image_bitmap.height;
		const context = canvas.getContext("2d");
		const expected = {
			qr_x: (test_id_page_box.left + test_id_page_box.width / 2) * PDF_SCALE,
			qr_y: (test_id_page_box.top + test_id_page_box.height / 2) * PDF_SCALE,
			dot_x: (alignment_dot_box.left + alignment_dot_box.width / 2) * PDF_SCALE,
			dot_y: (alignment_dot_box.top + alignment_dot_box.height / 2) * PDF_SCALE,
		};
		const expected_vec = {
			x: expected.qr_x - expected.dot_x,
			y: expected.qr_y - expected.dot_y,
		};
		const scanned = {
			qr_x: sum(corner_points.map((v) => v.x)) / 4,
			qr_y: sum(corner_points.map((v) => v.y)) / 4,
			dot_x: dot_location[0],
			dot_y: dot_location[1],
		};
		console.log(expected, scanned);
		const scanned_vec = {
			x: scanned.qr_x - scanned.dot_x,
			y: scanned.qr_y - scanned.dot_y,
		};

		// The transforms are right multiplied (reversing order)
		// Order:
		// - Move alignment dot to origin.
		// - Rotate and scale to match vector of dot to qr.
		// - Translate the aligment dot back.

		const scale =
			Math.hypot(expected_vec.x, expected_vec.y) /
			Math.hypot(scanned_vec.x, scanned_vec.y);

		const t = new DOMMatrix()
			.translate(expected.dot_x, expected.dot_y)
			.rotate(
				((Math.atan2(expected_vec.y, expected_vec.x) -
					Math.atan2(scanned_vec.y, scanned_vec.x)) *
					180) /
					Math.PI
			)
			.scale(scale, scale)
			.translate(-scanned.dot_x, -scanned.dot_y);

		context.setTransform(t);

		context.drawImage(image_bitmap, 0, 0);
		const output = await new Promise((resolve) => {
			canvas.toBlob(resolve);
		});
		canvas.remove();
		return output;
	}
</script>

<svelte:head>
	<script
		type="module"
		src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs"
	></script>
</svelte:head>

<h2>Upload Scans</h2>

<br />

<label>
	<input type="file" multiple bind:files accept=".pdf,.zip" />
</label>

<br />
<br />

<Button title="Upload Scans" action={upload_scans} />

<br />
<br />

<DataTable
	sortable
	size="compact"
	expandable
	headers={[
		{ key: "edit", value: "" },
		{ key: "delete", value: "" },
		{ key: "file_name", value: "File Name" },
		{ key: "test_id", value: "Test ID" },
		{ key: "page", value: "Page Index" },
		{ key: "front_id", value: "Taker ID" },
	]}
	rows={[
		...pngs_to_upload.entries().map(([k, v]) => {
			return { id: k, ...v };
		}),
	]}
>
	<svelte:fragment slot="cell" let:row let:cell>
		{#if cell.key === "edit"}
			<button class="edit-icon" on:click={() => openModal(row)}>
				<i class="fas fa-pencil-alt" />
			</button>
		{:else if cell.key === "delete"}
			<button class="edit-icon" on:click={() => deleteRow(row)}>
				<i class="fa-solid fa-trash"/>
			</button>
		{:else}
			<div>
				<div style="overflow: hidden;">
					{cell.value == null || cell.value == "" ? "None" : cell.value}
				</div>
			</div>
		{/if}
	</svelte:fragment>
	<svelte:fragment slot="expanded-row" let:row>
		<div class="flex">
			<div
				style="border: 2px solid black;width: 50%;margin: 10px;padding: 10px;"
			>
				<img src={row.blob_url} class="scan-preview" />
			</div>
		</div>
	</svelte:fragment>
</DataTable>

<Modal
	bind:open={$showModal}
	modalHeading="Edit Scan Information"
	primaryButtonText="Confirm"
	secondaryButtonText="Cancel"
	on:click:button--secondary={(e) => {
		e.preventDefault();
	}}
	on:open
	on:close={() => {
		selectedRow.set(null);
		showModal.set(false);
	}}
	on:submit={() => {
		saveChanges();
		selectedRow.set(null);
	}}
>
	{#if $selectedRow}
		<TextInput
			label="Test ID"
			labelText="Test ID #"
			bind:value={$selectedRow.test_id}
		/>
		<TextInput
			label="Taker ID"
			labelText="Student/Team ID"
			bind:value={$selectedRow.front_id}
		/>
	{/if}
</Modal>

<div id="canvas" />

<style>
	img.scan-preview {
		width: 100%;
	}
</style>
