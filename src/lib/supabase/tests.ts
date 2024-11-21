import { supabase } from "../supabaseClient";
import { unarchiveProblem, archiveProblem } from "./problems";

export interface TestRequest {
	test_name: string;
	test_description?: string;
	tournament_id: number;
}

export interface TestEditRequest {
	test_name?: string;
	test_description?: string;
	test_version?: string;
	tournament_id?: number;
}

export interface TestFeedbackQuestionRequest {
	test_id: number;
	question: string;
}

/**
 * Selects all tests from the database
 *
 * @param customSelect optional, string
 * @returns All tests from database
 */
export async function getAllTests(customSelect = "*") {
	let { data, error } = await supabase.from("tests").select(customSelect);
	if (error) throw error;
	console.log("TESTDATA", data);
	return data;
}

/**
 * Selects unarchived tests from the database
 *
 * @param customSelect optional, string
 * @returns Unarchived tests from database
 */
export async function getUnarchivedTests(customSelect = "*") {
	let { data: testList, error } = await supabase
		.from("tests")
		.select(customSelect)
		.eq("archived", false);
	if (error) throw error;
	return testList;
}

/**
 * Selects all tests from database, ordered by a certain column
 *
 * @param customOrder string
 * @param customSelect optional, string
 * @returns All tests ordered by customOrder
 */
export async function getAllTestsOrder(
	customOrder: string,
	customSelect = "*",
) {
	let { data, error } = await supabase
		.from("tests")
		.select(customSelect)
		.order(customOrder);
	if (error) throw error;
	return data;
}

/**
 * Returns test info from the database given a test id
 *
 * @param test_id number
 * @param customSelect optional, string
 * @returns test object
 */
export async function getTestInfo(test_id: number, customSelect: string = "*") {
	let { data, error } = await supabase
		.from("tests")
		.select(customSelect)
		.eq("id", test_id)
		.single();
	if (error) throw error;
	return data;
}

/**
 * Gets test coordinator list given a test id
 *
 * @param test_id number
 * @param customSelect optional, string
 * @returns list of test coordinator IDs
 */
export async function getTestCoordinators(
	test_id: number,
	customSelect: string = "coordinator_id",
) {
	let { data, error } = await supabase
		.from("test_coordinators")
		.select(customSelect)
		.eq("test_id", test_id);
	if (error) throw error;
	console.log(data);
	return data;
}

/**
 * Check if test coordinator
 *
 * @param test_id number
 * @param coordinator_id number
 * @param customSelect optional, string
 * @returns boolean
 */
export async function checkIfTestCoordinator(
	test_id: number,
	coordinator_id: number,
	customSelect: string = "coordinator_id",
) {
	let { error: error, count } = await supabase
		.from("test_coordinators")
		.select(customSelect, { count: "exact", head: true })
		.eq("coordinator_id", coordinator_id)
		.eq("test_id", test_id);
	if (error) throw error;
	return count > 0;
}

/**
 * Fetches test problems given a test id. Ordered by problem number
 *
 * @param test_id number
 * @param customSelect optional, string
 * @returns Test problem data (TODO: change format)
 */
export async function getTestProblems(
	test_id: number,
	customSelect: string = "*,full_problems(*)",
) {
	let { data, error } = await supabase
		.from("test_problems")
		.select(customSelect)
		.eq("test_id", test_id)
		.order("problem_number");
	if (error) throw error;
	return data;
}

/**
 * Returns everything about a test given an id: info, coordinators, problems
 *
 * @param test_id number
 * @returns Entire test object
 */
export async function getTest(test_id: number) {
	let test = await getTestInfo(test_id);
	test.coordinators = await getTestCoordinators(test_id);
	test.problems = await getTestProblems(test_id);
	return test;
}

/**
 * Creates a single test
 *
 * @param test object
 * @returns test data in database (including id)
 */
export async function createTest(test: TestRequest) {
	const { data, error } = await supabase.from("tests").insert([test]).select();
	if (error) throw error;
	return data[0];
}

/**
 * Bulk creates many tests
 *
 * @param tests
 * @returns list of test data in database (including id)
 */
export async function bulkTests(tests: TestRequest[]) {
	const { data, error } = await supabase.from("tests").insert(tests).select();
	if (error) throw error;
	return data;
}

/**
 * Edits a specific test's information from the database
 *
 * @param test object
 * @param test_id number
 * @returns test data from database
 */
export async function editTestInfo(test: TestEditRequest, test_id: number) {
	const { data, error } = await supabase
		.from("tests")
		.update(test)
		.eq("id", test_id)
		.select();
	if (error) throw error;
	return data;
}

/**
 * Adds a test coordinator
 *
 * @param test_id
 * @param coordinator_id
 * @returns test coordinator data from database
 */
export async function addTestCoordinator(
	test_id: number,
	coordinator_id: number,
) {
	const { data, error } = await supabase
		.from("test_coordinators")
		.insert([{ test_id, coordinator_id }])
		.select();
	if (error) throw error;
	return data;
}

/**
 * Removes a test coordinator. Returns nothing.
 *
 * @param test_id number
 * @param coordinator_id number
 */
export async function removeTestCoordinator(
	test_id: number,
	coordinator_id: number,
) {
	const { error } = await supabase
		.from("test_coordinators")
		.delete()
		.eq("test_id", test_id)
		.eq("coordinator_id", coordinator_id);

	if (error) throw error;
}

export async function getNumScanProblems(test_id) {
	const { count, error } = await supabase
		.from("grade_tracking")
		.select("count", { count: "exact", head: true })
		.eq("test_id", test_id)
		.single();
	if (error) throw error;
	console.log("getNumGradeProblems: ", count);
	return count;
}

export async function getNumGradeProblems(test_id) {
	const { count, error } = await supabase
		.from("grade_tracking")
		.select("count", { count: "exact", head: true })
		.eq("test_id", test_id)
		.filter("graded_count", "gte", 2)
		.single();
	if (error) throw error;
	console.log("getNumGradeProblems: ", count);
	return count;
}

export async function getNumConflictProblems(test_id) {
	const { count, error } = await supabase
		.from("grade_tracking")
		.select("count", { count: "exact", head: true })
		.eq("test_id", test_id)
		.eq("needs_resolution", true)
		.single();
	if (error) throw error;
	console.log("getNumGradeProblems: ", count);
	return count;
}

/**
 * Archives a test. Returns nothing.
 *
 * @param test_id number
 */
export async function archiveTest(test_id: number) {
	const { error: error1 } = await supabase
		.from("tests")
		.update({ archived: true })
		.eq("id", test_id);
	if (error1) throw error1;

	let { data, error: error2 } = await supabase
		.from("test_problems")
		.select("problem_id")
		.eq("test_id", test_id);
	if (error2) throw error2;
	for (let i of data) {
		archiveProblem(i.problem_id, true);
	}
}

/**
 * Archives a test. Returns nothing.
 *
 * @param test_id number
 */
export async function unarchiveTest(test_id: number) {
	const { error: error1 } = await supabase
		.from("tests")
		.update({ archived: false })
		.eq("id", test_id);
	if (error1) throw error1;

	let { data, error: error2 } = await supabase
		.from("test_problems")
		.select("problem_id")
		.eq("test_id", test_id);
	if (error2) throw error2;
	for (let i of data) {
		unarchiveProblem(i.problem_id);
	}
}

/**
 * Creates a test feedback question given its data
 *
 * @param question object
 * @returns object in database, including id
 */
export async function addTestFeedbackQuestion(
	question: TestFeedbackQuestionRequest,
) {
	const { data, error } = await supabase
		.from("test_feedback_questions")
		.insert([question])
		.select();
	if (error) throw error;
	return data;
}

/**
 * Removes a test feedback question given its id. Returns nothing.
 *
 * @param question_id number
 */
export async function removeTestFeedbackQuestion(feedback_question: number) {
	const { error } = await supabase
		.from("test_feedback_questions")
		.delete()
		.eq("id", question_id);
	if (error) throw error;
}

/**
 * Get feedback questions for a particular test
 *
 * @param test_id number
 * @returns object in database, including id
 */
export async function getFeedbackQuestions(test_id: number) {
	console.log("getting Feedback Questions", test_id);
	const { data, error } = await supabase
		.from("test_feedback_questions")
		.select("*")
		.eq("test_id", test_id);
	if (error) throw error;
	return data;
}

/**
 * Add a problem to a test. Returns nothing.
 *
 * @param test_id number
 * @param problem_id number
 */
export async function addAProblemOnTest(test_id: number, problem_id: number) {
	let { error } = await supabase.rpc("add_test_problem", {
		p_problem_id: problem_id,
		p_test_id: test_id,
	});
	if (error) throw error;
}

/**
 * Delete a problem to a test. Returns nothing.
 *
 * @param test_id number
 * @param problem_id number
 */
export async function deleteAProblemOnTest(
	test_id: number,
	problem_id: number,
) {
	let { error } = await supabase.rpc("delete_test_problem", {
		p_problem_id: problem_id,
		cur_test_id: test_id,
	});
	if (error) throw error;
}

/**
 * Reorder the problems on a test. Returns nothing.
 *
 * @param test_id number
 * @param problem_id number
 * @param problem_order number
 */
export async function reorderProblemsOnTest(
	test_id: number,
	problem_id: number,
	problem_order: number,
) {
	let { error } = await supabase.rpc("reorder_test_problem", {
		p_problem_id: problem_id,
		p_new_number: problem_order,
		cur_test_id: test_id,
	});
	if (error) throw error;
}

/**
 * Reorder the problems on a test. Returns nothing.
 *
 * @param test_id number
 * @param problem_id number
 * @param problem_order number
 * @param relation_id number
 */
export async function massProblemReordering(
	test_id: number,
	problem_id: number,
	problem_order: number,
	relation_id: number,
) {
	let { error } = await supabase
		.from("test_problems")
		.update({
			problem_id: problem_id,
			test_id: test_id,
			problem_number: problem_order,
		})
		.eq("relation_id", relation_id);
	if (error) {
		throw error;
	}
}

/**
 * Upsert the bounding boxes on answers and the location of header lines for a test.
 *
 * @param test_id number
 * @param bounding_boxes string (json)
 */
export async function upsertTestAnswerBoxes(
	test_id: number,
	bounding_boxes: string,
) {
	const { error } = await supabase
		.from("tests")
		.update({
			bounding_boxes,
		})
		.eq("id", test_id);

	if (error) {
		throw error;
	}
}
