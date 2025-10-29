import { writable, derived } from 'svelte/store';

export function useProblemFilters(problemsStore) {
	const selectedTopics = writable([]);
	const selectedStages = writable([]);
	const selectedEndorsed = writable([]);

	const availableTopics = ["Algebra", "Calculus", "Combinatorics", "Number Theory", "Geometry"];
	const availableStages = ["Draft", "Idea", "Endorsed", "On Test", "Published", "Archived"];
	const availableEndorsed = ["Yes", "No"];

	const filteredProblems = derived(
		[problemsStore, selectedTopics, selectedStages, selectedEndorsed],
		([$problems, $selectedTopics, $selectedStages, $selectedEndorsed]) => {
			if (!$problems || $problems.length === 0) return [];

			let filtered = $problems;

			if ($selectedTopics.length > 0) {
				filtered = filtered.filter(problem => {
					if (!problem.topics || problem.topics.trim() === "") return false;
					const problemTopics = problem.topics.split(", ").map(topic => topic.trim());
					return $selectedTopics.some(selectedTopic => 
						problemTopics.includes(selectedTopic)
					);
				});
			}

			if ($selectedStages.length > 0) {
				filtered = filtered.filter(problem => {
					return $selectedStages.includes(problem.status);
				});
			}

			if ($selectedEndorsed.length > 0) {
				filtered = filtered.filter(problem => {
					const isEndorsed = problem.endorsed && problem.endorsed.trim() !== "";
					if ($selectedEndorsed.includes("Yes")) {
						return isEndorsed;
					}
					if ($selectedEndorsed.includes("No")) {
						return !isEndorsed;
					}
					return true;
				});
			}

			return filtered;
		}
	);

	const filteredCount = derived(filteredProblems, $filteredProblems => $filteredProblems.length);

	function clearAllFilters() {
		selectedTopics.set([]);
		selectedStages.set([]);
		selectedEndorsed.set([]);
	}

	return {
		selectedTopics,
		selectedStages,
		selectedEndorsed,
		filteredProblems,
		filteredCount,
		
		availableTopics,
		availableStages,
		availableEndorsed,
		
		clearAllFilters
	};
}
