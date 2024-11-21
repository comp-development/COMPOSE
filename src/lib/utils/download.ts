function downloadURL(data: string, fileName: string) {
	const a = document.createElement("a");
	a.href = data;
	a.download = fileName;
	document.body.appendChild(a);
	a.style.display = "none";
	a.click();
	a.remove();
}

export function downloadBlob(
	data: Uint8Array,
	fileName: string,
	mimeType: string,
) {
	const url = window.URL.createObjectURL(
		new Blob([data], {
			type: mimeType,
		}),
	);
	downloadURL(url, fileName);
	setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
