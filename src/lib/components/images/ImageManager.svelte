<script lang="ts">
	/* ImageManager
	 * This component allows users to upload/manage problem images.
	 * Users can create folders to store images in, as well as upload images.
	 */
	import {
		ImageListing,
		ImageBucket,
		type ListingType,
	} from "$lib/ImageBucket";
	import { Folder, Image, ArrowLeft } from "carbon-icons-svelte";
	import { FileUploader, TextInput } from "carbon-components-svelte";
	import Button from "$lib/components/Button.svelte";
	import { ProblemImage } from "$lib/getProblemImages";
	import { fail } from "@sveltejs/kit";
	import ModalButton from "../ModalButton.svelte";
	import toast from "svelte-french-toast";
	import { handleError } from "$lib/handleError.ts";

	export let add: any;

	const MAX_IMAGE_SIZE = 1024 * 1024;
	const MAX_IMAGE_SIZE_READABLE = "1 mb";
	const MAX_NAME_LENGTH = 32;

	const ACCEPTED_IMAGE_FORMATS = [".jpg", ".png", ".jpeg", ".webp"];

	let curFolder = []; // array of folders
	let folderString = "/";
	let curListing = [];

	let fileUploader: FileUploader;
	let fileList = [];

	async function loadFolder() {
		curListing = await ImageBucket.getFolderFromList(curFolder);
		if (curFolder.length > 0) {
			curListing = [
				new ImageListing({ type: "folder", name: "(back)", special: "back" }),
				...curListing,
			];
		}
	}

	async function openItem(listing: ImageListing) {
		if (listing.type === "folder") {
			if (listing.special === "back") {
				curFolder.pop();
				curFolder = curFolder;
			} else {
				curFolder = [...curFolder, listing.name];
			}
			await loadFolder();
			// only update after folder has loaded
			folderString = curFolder.join("/") + "/";
		} else if (listing.type === "image") {
			listing.expanded = !listing.expanded;
			curListing = curListing;
			add("problem", " $\\image{" + listing.folderString + listing.name + "}$");
		}
	}

	async function addImage(e: CustomEvent<ReadonlyArray<File>>) {
		const images = e.detail;

		for (const img of images) {
			if (img.size > MAX_IMAGE_SIZE) {
				cancelUpload(
					`Image ${img.name} is too large (${MAX_IMAGE_SIZE_READABLE} max)`
				);
				return;
			}
			if (itemExists(img.name, "image")) {
				cancelUpload(`Image ${img.name} is already present`);
				return;
			}
		}
	}

	// clear and cancel file upload
	function cancelUpload(reason: string) {
		fileUploader.clearFiles();
		toast.error(reason);
	}

	async function submitImages(e: Event) {
		try {
			e.preventDefault();
			let imageList = fileList.map((f) => ProblemImage.fromFile(f));
			let failedList = [];
			for (const img of imageList) {
				try {
					await ImageBucket.addImage(folderString, img);
				} catch (e) {
					failedList.push(img.name);
				}
			}
			if (failedList.length > 0) {
				cancelUpload(
					"The following files failed to upload: " + failedList.join(", ")
				);
			}
			fileList = [];
			loadFolder();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	let showNewFolder = false;
	function toggleNewFolder(e: Event) {
		e.preventDefault();
		showNewFolder = !showNewFolder;
	}

	// checks if item with name exists in current folder
	function itemExists(name: string, type: ListingType | "" = "") {
		for (const listing of curListing) {
			if (listing.name === name && type !== "" && listing.type === type) {
				return true;
			}
		}
		return false;
	}

	let folderNameInput = "";
	const folderNameRegex = /^[a-zA-Z0-9_-]{1,32}$/;
	function createNewFolder(e: Event) {
		try {
			e.preventDefault();

			folderNameInput = folderNameInput.trim();

			if (folderNameInput.length === 0) {
				throw new Error("Folder must have a name");
			}

			if (folderNameInput.length > MAX_NAME_LENGTH) {
				throw new Error("Folder name is too long");
			}

			if (itemExists(folderNameInput, "folder")) {
				throw new Error("Folder with that name already exists");
			}

			if (!folderNameInput.match(folderNameRegex)) {
				throw new Error("Invalid folder name");
			}

			// add folder
			ImageBucket.addFakeFolder(folderString, folderNameInput);

			loadFolder();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function deleteImage(listing: ImageListing) {
		try {
			const path = listing.fullName();
			await ImageBucket.deleteImage(path);
			if (curListing.length <= 2) {
				// folder now empty, navigate back
				curFolder = [];
				folderString = "/";
			}
			loadFolder();
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	loadFolder();
</script>

<div class="manager-container">
	<p>Image Manager</p>
	<p>Current Folder: {folderString}</p>

	<div class="new-folder-options">
		<Button title="New folder" action={toggleNewFolder} />
		{#if showNewFolder}
			<div class="new-folder-form">
				<div>
					<TextInput
						size="sm"
						placeholder="Enter folder name..."
						bind:value={folderNameInput}
					/>
				</div>
				<div style="margin-left: 5px">
					<Button bwidth="5em" title="Add" action={createNewFolder} />
				</div>
			</div>
			<p>Note: folders without images are deleted upon refresh.</p>
		{/if}
	</div>
	<div class="listing-container">
		{#each curListing as listing}
			<div
				class="listing-item"
				on:click={() => openItem(listing)}
				on:keydown={() => openItem(listing)}
			>
				{#if listing.special === "back"}
					<ArrowLeft />
				{:else if listing.type === "folder"}
					<Folder />
				{:else}
					<Image />
				{/if}
				{listing.name}

				{#if listing.expanded}
					<div class="listing-expanded">
						{#await listing.download()}
							<p>Loading image...</p>
						{:then img}
							<img
								src={img.url}
								alt="Attached for problem"
								style="max-width: 100%;"
							/>
							<br />
							<ModalButton
								runHeader="Delete"
								onSubmit={() => deleteImage(listing)}
								del
								stopPropagation
							/>
						{/await}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div>
		<FileUploader
			multiple
			buttonLabel="Upload files"
			labelDescription={`Accepts ${ACCEPTED_IMAGE_FORMATS.join(
				", "
			)}. ${MAX_IMAGE_SIZE_READABLE} max each (but please try and use smaller images). To use in the problem, use \\image{<image file path>}`}
			accept={ACCEPTED_IMAGE_FORMATS}
			status="edit"
			bind:this={fileUploader}
			bind:files={fileList}
			on:add={addImage}
		/>
		<Button action={submitImages} title="Submit images" />
	</div>
</div>

<style>
	.manager-container {
		border: 1px solid black;
		text-align: left;
		padding: 5px;
	}

	.listing-container {
		margin-top: 5px;
	}

	.listing-item {
		border: 1px solid black;
		margin-bottom: 3px;
		padding: 3px;
		vertical-align: middle;
		width: auto;
		background-color: var(--text-color-light);
		cursor: pointer;
	}

	.listing-item:hover {
		background-color: lightgray;
	}

	.listing-expanded {
		margin: 5px;
	}

	.error-p {
		color: #aa0000;
	}

	.new-folder-form {
		display: flex;
		flex-direction: row;
		margin-top: 5px;
	}
</style>
