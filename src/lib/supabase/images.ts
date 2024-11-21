import { supabase } from "../supabaseClient";

/**
 * Fetches image from path
 *
 * @param path string
 * @returns images
 */
export async function getImages(path: string) {
	const { data, error } = await supabase.storage
		.from("problem-images")
		.list(path);
	if (error) throw error;
	return data;
}

export async function getScan(testId, takerId) {
	const { data, error } = await supabase
		.from("scans")
		.select("*")
		.eq("test_id", testId)
		.eq("taker_id", takerId)
		.single();
	if (error) throw error;
	return data;
}

/**
 * Download all images
 *
 * @param path string
 * @returns downloadableFiles
 */
export async function downloadImagesFromPath(path: string) {
	const { data: imageX, error } = await supabase.storage
		.from("problem-images")
		.download(path);
	if (error) throw error;
	return imageX;
}

/**
 * Delete a problem's image. Returns nothing.
 *
 * @param filePaths string[]
 */
export async function deleteImages(filePaths: string[]) {
	const { error } = await supabase.storage
		.from("problem-images")
		.remove(filePaths);
	if (error) throw error;
}

/**
 * Upload an image to the image database. Returns nothing.
 *
 * @param filePath string
 * @param file
 * @param upsert optional, boolean
 */
export async function uploadImage(filePath: string, file: Blob, upsert = true) {
	let { error } = await supabase.storage
		.from("problem-images")
		.upload(filePath, file, {
			upsert: upsert,
		});
	if (error) throw error;
}

/**
 * Get an image URL
 *
 * @param filePath string
 * @returns the image's public URL
 */
export async function getImageURL(filePath: string) {
	let { data } = supabase.storage.from("problem-images").getPublicUrl(filePath);

	return data.publicUrl;
}
