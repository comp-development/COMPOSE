import { writable } from "svelte/store";
import { browser } from "$app/environment";

export const user = writable(null);

const defaultProblems = JSON.stringify([]);
let storedProblemList = defaultProblems;
if (browser) {
	storedProblemList = window.localStorage.getItem("problemList");
	if (!storedProblemList || !storedProblemList.startsWith('[{"id":')) {
		//very naive check for right format
		storedProblemList = defaultProblems;
	}
}
console.log("STORED", storedProblemList, JSON.parse(storedProblemList));
export const problemList = writable(JSON.parse(storedProblemList));
problemList.subscribe((value) => {
	if (browser) {
		window.localStorage.setItem("problemList", JSON.stringify(value));
	}
	console.log("LIST", value);
});
