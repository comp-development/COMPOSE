<script>
	import { onMount, afterUpdate } from "svelte";

	export let imageUrl;
	export let inputCoordinates; // { x, y, width, height }

	let canvas;
	let focusRect;
	let group;
	let rectCoordinates;
	let ogPosition;
	let fabric;

	async function initializeCanvas() {
		({ fabric } = await import("fabric"));
		console.log(fabric);
		if (canvas) {
			canvas.clear(); // Clear canvas if it already exists
		}
		const aspectRatio = inputCoordinates.width / inputCoordinates.height;
		const canvasContainer = document.getElementById("canvas-container");
		canvasContainer.style.width = `${
			canvasContainer.offsetHeight * aspectRatio
		}px`;

		// Initialize Fabric canvas
		canvas = new fabric.Canvas("canvas", {
			width: canvasContainer.offsetWidth,
			height: canvasContainer.offsetHeight,
			selectable: false,
		});
		update();
	}

	onMount(initializeCanvas); // Initialize canvas on mount

	function update() {
		if (!fabric) {
			return;
		}
		// Load image onto canvas
		fabric.Image.fromURL(imageUrl, function (image) {
			rectCoordinates = {
				left: (inputCoordinates.left / 612) * image.width,
				top: (inputCoordinates.top / 792) * image.height,
				width: (inputCoordinates.width / 612) * image.width,
				height: (inputCoordinates.height / 792) * image.height,
			};
			image.set({ selectable: false });

			// Set initial crop rectangle
			focusRect = new fabric.Rect({
				left: rectCoordinates.left,
				top: rectCoordinates.top,
				width: rectCoordinates.width,
				height: rectCoordinates.height,
				fill: "transparent",
				stroke: "red",
				strokeWidth: 2,
				selectable: true, // Prevent selection of the rectangle
			});

			if (group) {
				canvas.remove(group);
			}

			group = new fabric.Group([image, focusRect], {
				selectable: true, // Allow selection
				hasControls: false, // Hide controls
				lockMovementX: false, // Allow horizontal movement
				lockMovementY: false, // Allow vertical movement
			});
			canvas.add(group);
			ogPosition = { left: group.left, top: group.top };
			reZoom();
		});
	}

	afterUpdate(update);

	function reset() {
		reZoom();
		recenterCanvas();
	}

	function reZoom(e) {
		if (group) {
			canvas.setViewportTransform([
				1,
				0,
				0,
				1,
				-rectCoordinates.left + canvas.width / 2 - rectCoordinates.width / 2,
				-rectCoordinates.top + canvas.height / 2 - rectCoordinates.height / 2,
			]);
			zoomOut(e, 1.25);
			canvas.renderAll();
		}
	}

	function zoomIn(e, amt = 1.2) {
		if (group) {
			canvas.zoomToPoint(
				new fabric.Point(canvas.width / 2, canvas.height / 2),
				canvas.getZoom() * amt
			);
		}
	}

	function zoomOut(e, amt = 1.2) {
		if (group) {
			canvas.zoomToPoint(
				new fabric.Point(canvas.width / 2, canvas.height / 2),
				canvas.getZoom() / amt
			);
		}
	}

	function recenterCanvas(e) {
		if (group) {
			group.set({
				left: ogPosition.left,
				top: ogPosition.top,
			});
			canvas.renderAll();
		}
	}
</script>

<div class="picture">
	<div id="canvas-container" class="centered">
		<canvas id="canvas" />
		<div class="zoom-controls">
			<button on:click={zoomIn} class="icon-button">
				<i class="ri-zoom-in-fill" style="font-size: 30px;" />
			</button>
			<button on:click={zoomOut} class="icon-button">
				<i class="ri-zoom-out-fill ri-lg" style="font-size: 30px;" />
			</button>
			<button on:click={reset} class="icon-button">
				<i class="ri-find-replace-fill ri-lg" style="font-size: 30px;" />
			</button>
		</div>
	</div>
</div>

<style>
	#canvas-container {
		position: relative;
		width: 100%;
		text-align: center;
	}

	#canvas {
		border: 1px solid #ccc;
		position: relative;
	}

	.zoom-controls {
		position: absolute;
		top: 50%;
		right: 0px;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.icon-button {
		margin: 5px;
		padding: 5px;
		margin-right: 0;
		font-size: 20px;
		background: none;
		border: none;
		cursor: pointer;
	}

	.picture {
		background-color: var(--primary-tint);
		max-width: 800px;
		max-height: 600px;
		width: auto;
		height: auto;
		padding: 10px;
		border: 5px solid var(--primary-dark);
		border-radius: 15px;
		margin: auto;
		overflow: hidden;
	}

	.icon-button i {
		color: var(--secondary-dark);
	}
</style>
