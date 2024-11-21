import { supabase } from "../supabaseClient";

// These two constants control the number of scans that are fetched at a time.
const MIN_SCAN_INDEX = 0;
const MAX_SCAN_INDEX = 100;
// NOTE: const jsonData (a list of JSON dictionaries {scan_id: int, test_id: int}) is hard coded at the bottom of this file. Please update if necessary!


function getImageUrl(path: string, bucket: string = "scans"): string | null {
	const { data } = supabase.storage.from(bucket).getPublicUrl(path);
	return data?.publicUrl || null;
}

export async function uploadScan(
	file: any,
	test_id: string,
	page_number: string,
	front_id: string,
) {
	if (test_id.startsWith("ERROR")) {
		throw new Error(
			"Could not read Test QR code. Must manually input the Test ID before uploading.",
		);
	}
	if (front_id.startsWith("ERROR")) {
		throw new Error(
			"Could not read Team/Student QR code. Must manually input the Taker ID before uploading scans.",
		);
	}
	let { data, error: upload_error } = await supabase.storage
		.from("scans")
		.upload(`test_${test_id}/${front_id}/page_${page_number}.png`, file, {
			upsert: true,
		});
	if (upload_error) throw upload_error;

	let { error: upsert_error } = await supabase.from("scans").upsert(
		{ test_id, taker_id: front_id, page_number, scan_path: data.path },
		{
			onConflict: "test_id,taker_id,page_number",
		},
	);
	if (upsert_error) throw upsert_error;
}

export async function getTestTrackingData(grader_id: number): Promise<any[]> {
	const { data: testTrackingData, error: testTrackingError } = await supabase
		.from("test_tracking")
		.select("test_id, available_responses, total_responses, scan_count");
	if (testTrackingError) {
		throw testTrackingError;
	}
	return testTrackingData;
}

// If test_problem_id not specified (null), looks at other problem ids in the
// same test, starting with lower # of unique grader_id entries that are claimed
// but not graded (pending).
//
// Returns scans in groups of their problem ids sorted by # unique grader_id's,
// then sorted in increasing order by their claimed_count.
//
// All returned scans have graded_count < 2.
//
// If no scans, returns empty list.
export async function fetchNewTakerResponses(
	grader_id: number,
	batch_size: number | null = null,
	test_id: number | null = null,
	test_problem_id: number | null = null,
	only_conflicted: boolean,
): Promise<any[]> {
	// If test_problem_id is not specified, order all other problems by num_graders.
	// console.log(`Inside fetchNewTakerResponses`, batch_size, test_id, test_problem_id);
	let test_problem_id_list = [];
	if (test_problem_id == null) {
		const { data: testData, error: testError } = await supabase
			.from("test_problem_grader_tracking")
			.select("test_id, num_graders, test_problem_id")
			.eq("test_id", test_id)
			.order("num_graders", { ascending: false });
		if (testError) {
			throw testError;
		}
		test_problem_id_list = testData.map((d) => d.test_problem_id);
	} else {
		test_problem_id_list = [test_problem_id];
	}

	let output = [];
	// Run every fetch in parallel, early exit once enough problems have been fetched.
	await new Promise<void>(async (resolve) => {
		await Promise.all(
			test_problem_id_list.map((p_id) =>
				fetch_single_problem(
					p_id,
					grader_id,
					batch_size,
					only_conflicted,
					(results: any[]) => {
						output = output.concat(results);
						if (output.length >= batch_size) {
							output = output.slice(0, batch_size);
							// Early exit condition.
							resolve();
						}
					},
				),
			),
		);
		// Once all fetches are run, even if we can't fill the batch size, return.
		resolve();
	});

	return output;
}

async function fetch_single_problem(
	test_problem_id: number,
	grader_id: number,
	batch_size: number,
	only_conflicted: boolean,
	continuation: { (results: any[]): void },
) {
	// Get the scans that this grader has graded for this test_problem_id.
	// These scans should not be given again.
	const { data: gradesData, error: gradesError } = await supabase
		.from("grades")
		.select("scan_id, test_problem_id, grade")
		.eq("grader_id", grader_id)
		.eq("test_problem_id", test_problem_id)
		.not("grade", "is", null);
	if (gradesError) {
		throw gradesError;
	}

	let query = supabase
		.from("grade_tracking")
		.select("scan_id, test_id, test_problem_id")
		.eq("test_problem_id", test_problem_id)
		// Absolutely do not return problems that have already been graded twice.
		.lt("graded_count", 2)
		.order("claimed_count")
		// Ignore scans that this grader has graded.
		.not("scan_id", "in", `(${gradesData.map((row) => row.scan_id).join(",")})`)
		.limit(batch_size);

	// Override the query to be just conflicted items.
	// We thus do not care if this admin has graded a problem or not
	// (they will override anyway).
	if (only_conflicted) {
		query = supabase
			.from("grade_tracking")
			.select("scan_id, test_id, test_problem_id")
			.eq("test_problem_id", test_problem_id)
			.eq("needs_resolution", true)
			.limit(batch_size);
	}

	const { data: gradeTrackingData, error: gradeTrackingError } = await query;
	if (gradeTrackingError) {
		throw gradeTrackingError;
	}

	// Mark that this grader claims these scans.
	const { error: newGradeError } = await supabase.from("grades").upsert(
		gradeTrackingData.map((item) => ({
			grader_id,
			scan_id: item.scan_id,
			test_problem_id: item.test_problem_id,
		})),
		{ onConflict: "grader_id, scan_id, test_problem_id" },
	);
	if (newGradeError) {
		throw newGradeError;
	}

	let problem_id_output = [];
	// Process the trTrackingData as needed
	for (const item of gradeTrackingData) {
		const { data: gradeData, error: gradeError } = await supabase
			.from("grades")
			.select("id")
			.eq("scan_id", item.scan_id)
			.eq("test_problem_id", item.test_problem_id)
			.eq("grader_id", grader_id)
			.single();
		if (gradeError) {
			throw gradeError;
		}

		const { data: otherGradeData, error: otherGradeError } = await supabase
			.from("grades")
			.select("grade")
			.eq("scan_id", item.scan_id)
			.eq("test_problem_id", item.test_problem_id);
		if (otherGradeError) {
			throw otherGradeError;
		}

		const { data: scanData, error: scanError } = await supabase
			.from("scans")
			.select("scan_path")
			.eq("id", item.scan_id)
			.single();
		if (scanError) {
			throw scanError;
		}

		const { data: testData, error: testError } = await supabase
			.from("tests")
			.select("test_name, bounding_boxes")
			.eq("id", item.test_id)
			.single();
		if (testError) {
			throw testError;
		}

		const { data: testProblemData, error: testProblemError } = await supabase
			.from("test_problems")
			.select("problem_id, problem_number")
			.eq("relation_id", item.test_problem_id)
			.single();
		if (testProblemError) {
			throw testProblemError;
		}

		const { data: problemData, error: problemError } = await supabase
			.from("problems")
			.select("problem_latex, answer_latex, solution_latex")
			.eq("id", testProblemData.problem_id)
			.single();
		if (problemError) {
			throw problemError;
		}

		problem_id_output.push({
			...item,
			...testData,
			...problemData,
			...testProblemData,
			grades: otherGradeData,
			grade_id: gradeData.id,
			image: getImageUrl(scanData.scan_path),
		});
	}
	continuation(problem_id_output);
}

export async function submitGrade(grader_id: number, data: any): Promise<void> {
	// if (data.is_override ?? false) {
	// 	const { data: existingRow, error } = await supabase
	// 		.from("grades")
	// 		.select("*")
	// 		.eq("scan_id", data.scan_id)
	// 		.eq("test_problem_id", data.test_problem_id)
	// 		.eq("is_override", true)
	// 		.single();
	// 	if (error) {
	// 		throw error;
	// 	}
	// 	if (existingRow) {
	// 		return;
	// 	}
	// }
	const { error } = await supabase
		.from("grades")
		.upsert(
			{ ...data, grader_id },
			{ onConflict: "grader_id,scan_id,test_problem_id" },
		);
	if (error) {
		throw error;
	}
}

export async function undoGrade(grade_id: number): Promise<void> {
	const { error: updateGradeError } = await supabase
		.from("grades")
		.update({ grade: null })
		.eq("id", grade_id);
	if (updateGradeError) {
		throw updateGradeError;
	}
}


export async function getGrades() {

	const distinctPairs = Array.from(new Set(jsonData.map((item: any) => [item.scan_id, item.test_id])));

	console.log(distinctPairs);
	let gradeTrackingData = [];
	for (let i = MIN_SCAN_INDEX; i < MAX_SCAN_INDEX; i++) {
		const pair = distinctPairs[i];
		let { data, error } = await supabase
			.from("grade_tracking")
			.select("scan_id,test_id,correct")
			.eq("grade_finalized", true)
			.eq("scan_id", pair[0])
			.eq("test_id", pair[1]);
		
		gradeTrackingData.push(...data);
	}
	
	// let gradeTrackingData = [];
	// let { data: , error: gradeTrackingError } = await supabase
	// 	.from("grade_tracking")
	// 	.select("scan_id,test_id,correct")
	// 	.eq("grade_finalized", true)
	// 	.limit(pageSize);
	// if (gradeTrackingError) {
	// 	throw gradeTrackingError;
	// }
	// gradeTrackingData.push(...data);
	// while (data.length === pageSize) {
		
	// 	({ data, error: gradeTrackingError } = await supabase
	// 		.from("grade_tracking")
	// 		.select("scan_id,test_id,correct")
	// 		.eq("grade_finalized", true)
	// 		.limit(pageSize));
	// 	if (gradeTrackingError) {
	// 		throw gradeTrackingError;
	// 	}
	// 	gradeTrackingData.push(...data);
	// }
	console.log("Constructed gradeTrackingDAta")
	console.log(gradeTrackingData.length);
	const scores = {};

	const get_row = async (row) => {
		
		const { data: testData, error: testError } = await supabase
			.from("tests")
			.select("test_name")
			.eq("id", row.test_id)
			.single();

		if (testError) {
			throw testError;
		}

		const test_name = testData.test_name;
		if (!Object.keys(scores).includes(test_name)) {
			scores[test_name] = {};
		}

		const { data: scanData, error: scanError } = await supabase
			.from("scans")
			.select("taker_id")
			.eq("id", row.scan_id)
			.single();
		if (scanError) {
			throw scanError;
		}
		
		const taker_id = scanData.taker_id;
		if (typeof taker_id === "string" && /[A-Z]$/.test(taker_id)) {
			// console.log("taker_id is a student");
			// console.log(taker_id);
			let team_num = taker_id.slice(0, -1);
			// console.log(team_num);
			let { data: team } = await supabase
				.from("teams")
				.select("id")
				.eq("number", team_num)
				.eq("tournament_id", 2)
				.single();

			// console.log(team.id);

			const { data: teamStudentData, error: teamStudentError } = await supabase
				.from("team_students")
				.select("student_id")
				.eq("team_id", team.id)
				.eq("student_num", taker_id)
				.single();

			// console.log(teamStudentData.student_id);
			// const { data: teamStudentData, error: teamStudentError } = await supabase
			// 	.from("team_students")
			// 	.select("student_id")
			// 	.eq("student_num", taker_id)
			// 	.single();
			// if (teamStudentError) {
			// 	throw teamStudentError;
			// }

			const { data: studentData, error: studentError } = await supabase
				.from("students")
				.select("first_name,last_name")
				.eq("id", teamStudentData.student_id)
				.single();
			if (studentError) {
				throw studentError;
			}

			if (!Object.keys(scores[test_name]).includes(taker_id)) {
				scores[test_name][taker_id] = {
					name: `${studentData.first_name} ${studentData.last_name}`,
					score: 0,
					grades: [],
				};
			}
			scores[test_name][taker_id].score += row.correct ? 1 : 0;
			scores[test_name][taker_id].grades.push(row.correct);
		} else {
			const { data: teamData, error: teamError } = await supabase
				.from("teams")
				.select("name")
				// TODO: @tweoss. no hardcoding, make this per tournament and per test
				.eq("tournament_id", 2)
				.eq("number", taker_id)
				.single();
			if (teamError) {
				throw teamError;
			}
			// console.log(test_name);
			if (!Object.keys(scores[test_name]).includes(taker_id)) {
				scores[test_name][taker_id] = {
					name: teamData.name,
					score: 0,
					grades: [],
				};
			}
			scores[test_name][taker_id].score += row.correct ? 1 : 0;
			scores[test_name][taker_id].grades.push(row.correct);
		}
		
	};

	await Promise.all(gradeTrackingData.map(get_row));
	console.log(scores);
	return scores;
}


const jsonData = [
    {
      "scan_id": 386,
      "test_id": 6
    },
    {
      "scan_id": 613,
      "test_id": 4
    },
    {
      "scan_id": 611,
      "test_id": 4
    },
    {
      "scan_id": 405,
      "test_id": 6
    },
    {
      "scan_id": 583,
      "test_id": 4
    },
    {
      "scan_id": 741,
      "test_id": 8
    },
    {
      "scan_id": 488,
      "test_id": 6
    },
    {
      "scan_id": 236,
      "test_id": 2
    },
    {
      "scan_id": 590,
      "test_id": 4
    },
    {
      "scan_id": 759,
      "test_id": 8
    },
    {
      "scan_id": 282,
      "test_id": 2
    },
    {
      "scan_id": 620,
      "test_id": 4
    },
    {
      "scan_id": 603,
      "test_id": 4
    },
    {
      "scan_id": 483,
      "test_id": 6
    },
    {
      "scan_id": 146,
      "test_id": 2
    },
    {
      "scan_id": 141,
      "test_id": 2
    },
    {
      "scan_id": 207,
      "test_id": 2
    },
    {
      "scan_id": 50,
      "test_id": 7
    },
    {
      "scan_id": 474,
      "test_id": 6
    },
    {
      "scan_id": 751,
      "test_id": 8
    },
    {
      "scan_id": 35,
      "test_id": 7
    },
    {
      "scan_id": 287,
      "test_id": 2
    },
    {
      "scan_id": 110,
      "test_id": 2
    },
    {
      "scan_id": 661,
      "test_id": 4
    },
    {
      "scan_id": 610,
      "test_id": 4
    },
    {
      "scan_id": 466,
      "test_id": 6
    },
    {
      "scan_id": 456,
      "test_id": 6
    },
    {
      "scan_id": 537,
      "test_id": 10
    },
    {
      "scan_id": 679,
      "test_id": 8
    },
    {
      "scan_id": 338,
      "test_id": 10
    },
    {
      "scan_id": 203,
      "test_id": 2
    },
    {
      "scan_id": 95,
      "test_id": 2
    },
    {
      "scan_id": 595,
      "test_id": 4
    },
    {
      "scan_id": 84,
      "test_id": 7
    },
    {
      "scan_id": 450,
      "test_id": 6
    },
    {
      "scan_id": 81,
      "test_id": 7
    },
    {
      "scan_id": 334,
      "test_id": 6
    },
    {
      "scan_id": 717,
      "test_id": 8
    },
    {
      "scan_id": 31,
      "test_id": 7
    },
    {
      "scan_id": 396,
      "test_id": 6
    },
    {
      "scan_id": 307,
      "test_id": 2
    },
    {
      "scan_id": 695,
      "test_id": 8
    },
    {
      "scan_id": 733,
      "test_id": 8
    },
    {
      "scan_id": 431,
      "test_id": 6
    },
    {
      "scan_id": 304,
      "test_id": 2
    },
    {
      "scan_id": 185,
      "test_id": 2
    },
    {
      "scan_id": 138,
      "test_id": 2
    },
    {
      "scan_id": 372,
      "test_id": 10
    },
    {
      "scan_id": 226,
      "test_id": 2
    },
    {
      "scan_id": 555,
      "test_id": 10
    },
    {
      "scan_id": 635,
      "test_id": 4
    },
    {
      "scan_id": 428,
      "test_id": 6
    },
    {
      "scan_id": 469,
      "test_id": 6
    },
    {
      "scan_id": 195,
      "test_id": 2
    },
    {
      "scan_id": 180,
      "test_id": 2
    },
    {
      "scan_id": 443,
      "test_id": 6
    },
    {
      "scan_id": 738,
      "test_id": 8
    },
    {
      "scan_id": 169,
      "test_id": 2
    },
    {
      "scan_id": 344,
      "test_id": 10
    },
    {
      "scan_id": 137,
      "test_id": 2
    },
    {
      "scan_id": 665,
      "test_id": 8
    },
    {
      "scan_id": 630,
      "test_id": 4
    },
    {
      "scan_id": 693,
      "test_id": 8
    },
    {
      "scan_id": 46,
      "test_id": 7
    },
    {
      "scan_id": 311,
      "test_id": 6
    },
    {
      "scan_id": 369,
      "test_id": 10
    },
    {
      "scan_id": 62,
      "test_id": 7
    },
    {
      "scan_id": 215,
      "test_id": 2
    },
    {
      "scan_id": 433,
      "test_id": 6
    },
    {
      "scan_id": 482,
      "test_id": 6
    },
    {
      "scan_id": 247,
      "test_id": 2
    },
    {
      "scan_id": 222,
      "test_id": 2
    },
    {
      "scan_id": 528,
      "test_id": 10
    },
    {
      "scan_id": 284,
      "test_id": 2
    },
    {
      "scan_id": 28,
      "test_id": 7
    },
    {
      "scan_id": 697,
      "test_id": 8
    },
    {
      "scan_id": 420,
      "test_id": 6
    },
    {
      "scan_id": 347,
      "test_id": 10
    },
    {
      "scan_id": 388,
      "test_id": 6
    },
    {
      "scan_id": 755,
      "test_id": 8
    },
    {
      "scan_id": 42,
      "test_id": 7
    },
    {
      "scan_id": 585,
      "test_id": 4
    },
    {
      "scan_id": 310,
      "test_id": 6
    },
    {
      "scan_id": 514,
      "test_id": 10
    },
    {
      "scan_id": 362,
      "test_id": 10
    },
    {
      "scan_id": 429,
      "test_id": 6
    },
    {
      "scan_id": 744,
      "test_id": 8
    },
    {
      "scan_id": 22,
      "test_id": 7
    },
    {
      "scan_id": 104,
      "test_id": 2
    },
    {
      "scan_id": 758,
      "test_id": 8
    },
    {
      "scan_id": 341,
      "test_id": 10
    },
    {
      "scan_id": 343,
      "test_id": 10
    },
    {
      "scan_id": 335,
      "test_id": 6
    },
    {
      "scan_id": 152,
      "test_id": 2
    },
    {
      "scan_id": 66,
      "test_id": 7
    },
    {
      "scan_id": 594,
      "test_id": 4
    },
    {
      "scan_id": 238,
      "test_id": 2
    },
    {
      "scan_id": 591,
      "test_id": 4
    },
    {
      "scan_id": 39,
      "test_id": 7
    },
    {
      "scan_id": 147,
      "test_id": 2
    },
    {
      "scan_id": 536,
      "test_id": 10
    },
    {
      "scan_id": 319,
      "test_id": 6
    },
    {
      "scan_id": 584,
      "test_id": 4
    },
    {
      "scan_id": 657,
      "test_id": 4
    },
    {
      "scan_id": 370,
      "test_id": 10
    },
    {
      "scan_id": 107,
      "test_id": 2
    },
    {
      "scan_id": 696,
      "test_id": 8
    },
    {
      "scan_id": 40,
      "test_id": 7
    },
    {
      "scan_id": 601,
      "test_id": 4
    },
    {
      "scan_id": 490,
      "test_id": 10
    },
    {
      "scan_id": 348,
      "test_id": 10
    },
    {
      "scan_id": 725,
      "test_id": 8
    },
    {
      "scan_id": 25,
      "test_id": 7
    },
    {
      "scan_id": 202,
      "test_id": 2
    },
    {
      "scan_id": 221,
      "test_id": 2
    },
    {
      "scan_id": 198,
      "test_id": 2
    },
    {
      "scan_id": 112,
      "test_id": 2
    },
    {
      "scan_id": 668,
      "test_id": 8
    },
    {
      "scan_id": 153,
      "test_id": 2
    },
    {
      "scan_id": 715,
      "test_id": 8
    },
    {
      "scan_id": 89,
      "test_id": 2
    },
    {
      "scan_id": 322,
      "test_id": 6
    },
    {
      "scan_id": 476,
      "test_id": 6
    },
    {
      "scan_id": 606,
      "test_id": 4
    },
    {
      "scan_id": 373,
      "test_id": 10
    },
    {
      "scan_id": 175,
      "test_id": 2
    },
    {
      "scan_id": 340,
      "test_id": 10
    },
    {
      "scan_id": 121,
      "test_id": 2
    },
    {
      "scan_id": 23,
      "test_id": 7
    },
    {
      "scan_id": 246,
      "test_id": 2
    },
    {
      "scan_id": 124,
      "test_id": 2
    },
    {
      "scan_id": 171,
      "test_id": 2
    },
    {
      "scan_id": 721,
      "test_id": 8
    },
    {
      "scan_id": 231,
      "test_id": 2
    },
    {
      "scan_id": 566,
      "test_id": 4
    },
    {
      "scan_id": 402,
      "test_id": 6
    },
    {
      "scan_id": 551,
      "test_id": 10
    },
    {
      "scan_id": 400,
      "test_id": 6
    },
    {
      "scan_id": 411,
      "test_id": 6
    },
    {
      "scan_id": 324,
      "test_id": 6
    },
    {
      "scan_id": 161,
      "test_id": 2
    },
    {
      "scan_id": 494,
      "test_id": 10
    },
    {
      "scan_id": 208,
      "test_id": 2
    },
    {
      "scan_id": 91,
      "test_id": 2
    },
    {
      "scan_id": 419,
      "test_id": 6
    },
    {
      "scan_id": 617,
      "test_id": 4
    },
    {
      "scan_id": 549,
      "test_id": 10
    },
    {
      "scan_id": 712,
      "test_id": 8
    },
    {
      "scan_id": 486,
      "test_id": 6
    },
    {
      "scan_id": 682,
      "test_id": 8
    },
    {
      "scan_id": 444,
      "test_id": 6
    },
    {
      "scan_id": 376,
      "test_id": 6
    },
    {
      "scan_id": 660,
      "test_id": 4
    },
    {
      "scan_id": 278,
      "test_id": 2
    },
    {
      "scan_id": 44,
      "test_id": 7
    },
    {
      "scan_id": 496,
      "test_id": 10
    },
    {
      "scan_id": 626,
      "test_id": 4
    },
    {
      "scan_id": 542,
      "test_id": 10
    },
    {
      "scan_id": 253,
      "test_id": 2
    },
    {
      "scan_id": 477,
      "test_id": 6
    },
    {
      "scan_id": 30,
      "test_id": 7
    },
    {
      "scan_id": 92,
      "test_id": 2
    },
    {
      "scan_id": 377,
      "test_id": 6
    },
    {
      "scan_id": 708,
      "test_id": 8
    },
    {
      "scan_id": 196,
      "test_id": 2
    },
    {
      "scan_id": 174,
      "test_id": 2
    },
    {
      "scan_id": 190,
      "test_id": 2
    },
    {
      "scan_id": 346,
      "test_id": 10
    },
    {
      "scan_id": 397,
      "test_id": 6
    },
    {
      "scan_id": 51,
      "test_id": 7
    },
    {
      "scan_id": 204,
      "test_id": 2
    },
    {
      "scan_id": 67,
      "test_id": 7
    },
    {
      "scan_id": 558,
      "test_id": 10
    },
    {
      "scan_id": 518,
      "test_id": 10
    },
    {
      "scan_id": 727,
      "test_id": 8
    },
    {
      "scan_id": 129,
      "test_id": 2
    },
    {
      "scan_id": 544,
      "test_id": 10
    },
    {
      "scan_id": 650,
      "test_id": 4
    },
    {
      "scan_id": 705,
      "test_id": 8
    },
    {
      "scan_id": 115,
      "test_id": 2
    },
    {
      "scan_id": 742,
      "test_id": 8
    },
    {
      "scan_id": 119,
      "test_id": 2
    },
    {
      "scan_id": 80,
      "test_id": 7
    },
    {
      "scan_id": 740,
      "test_id": 8
    },
    {
      "scan_id": 70,
      "test_id": 7
    },
    {
      "scan_id": 296,
      "test_id": 2
    },
    {
      "scan_id": 276,
      "test_id": 2
    },
    {
      "scan_id": 548,
      "test_id": 10
    },
    {
      "scan_id": 531,
      "test_id": 10
    },
    {
      "scan_id": 72,
      "test_id": 7
    },
    {
      "scan_id": 588,
      "test_id": 4
    },
    {
      "scan_id": 113,
      "test_id": 2
    },
    {
      "scan_id": 525,
      "test_id": 10
    },
    {
      "scan_id": 305,
      "test_id": 2
    },
    {
      "scan_id": 244,
      "test_id": 2
    },
    {
      "scan_id": 235,
      "test_id": 2
    },
    {
      "scan_id": 550,
      "test_id": 10
    },
    {
      "scan_id": 232,
      "test_id": 2
    },
    {
      "scan_id": 295,
      "test_id": 2
    },
    {
      "scan_id": 380,
      "test_id": 6
    },
    {
      "scan_id": 374,
      "test_id": 10
    },
    {
      "scan_id": 261,
      "test_id": 2
    },
    {
      "scan_id": 394,
      "test_id": 6
    },
    {
      "scan_id": 559,
      "test_id": 10
    },
    {
      "scan_id": 149,
      "test_id": 2
    },
    {
      "scan_id": 471,
      "test_id": 6
    },
    {
      "scan_id": 448,
      "test_id": 6
    },
    {
      "scan_id": 684,
      "test_id": 8
    },
    {
      "scan_id": 214,
      "test_id": 2
    },
    {
      "scan_id": 498,
      "test_id": 10
    },
    {
      "scan_id": 728,
      "test_id": 8
    },
    {
      "scan_id": 415,
      "test_id": 6
    },
    {
      "scan_id": 142,
      "test_id": 2
    },
    {
      "scan_id": 101,
      "test_id": 2
    },
    {
      "scan_id": 36,
      "test_id": 7
    },
    {
      "scan_id": 437,
      "test_id": 6
    },
    {
      "scan_id": 242,
      "test_id": 2
    },
    {
      "scan_id": 383,
      "test_id": 6
    },
    {
      "scan_id": 527,
      "test_id": 10
    },
    {
      "scan_id": 130,
      "test_id": 2
    },
    {
      "scan_id": 164,
      "test_id": 2
    },
    {
      "scan_id": 241,
      "test_id": 2
    },
    {
      "scan_id": 292,
      "test_id": 2
    },
    {
      "scan_id": 446,
      "test_id": 6
    },
    {
      "scan_id": 674,
      "test_id": 8
    },
    {
      "scan_id": 567,
      "test_id": 4
    },
    {
      "scan_id": 360,
      "test_id": 10
    },
    {
      "scan_id": 571,
      "test_id": 4
    },
    {
      "scan_id": 517,
      "test_id": 10
    },
    {
      "scan_id": 621,
      "test_id": 4
    },
    {
      "scan_id": 659,
      "test_id": 4
    },
    {
      "scan_id": 673,
      "test_id": 8
    },
    {
      "scan_id": 643,
      "test_id": 4
    },
    {
      "scan_id": 506,
      "test_id": 10
    },
    {
      "scan_id": 426,
      "test_id": 6
    },
    {
      "scan_id": 206,
      "test_id": 2
    },
    {
      "scan_id": 672,
      "test_id": 8
    },
    {
      "scan_id": 176,
      "test_id": 2
    },
    {
      "scan_id": 371,
      "test_id": 10
    },
    {
      "scan_id": 331,
      "test_id": 6
    },
    {
      "scan_id": 108,
      "test_id": 2
    },
    {
      "scan_id": 52,
      "test_id": 7
    },
    {
      "scan_id": 286,
      "test_id": 2
    },
    {
      "scan_id": 609,
      "test_id": 4
    },
    {
      "scan_id": 535,
      "test_id": 10
    },
    {
      "scan_id": 102,
      "test_id": 2
    },
    {
      "scan_id": 608,
      "test_id": 4
    },
    {
      "scan_id": 183,
      "test_id": 2
    },
    {
      "scan_id": 699,
      "test_id": 8
    },
    {
      "scan_id": 401,
      "test_id": 6
    },
    {
      "scan_id": 272,
      "test_id": 2
    },
    {
      "scan_id": 133,
      "test_id": 2
    },
    {
      "scan_id": 186,
      "test_id": 2
    },
    {
      "scan_id": 131,
      "test_id": 2
    },
    {
      "scan_id": 706,
      "test_id": 8
    },
    {
      "scan_id": 596,
      "test_id": 4
    },
    {
      "scan_id": 421,
      "test_id": 6
    },
    {
      "scan_id": 132,
      "test_id": 2
    },
    {
      "scan_id": 743,
      "test_id": 8
    },
    {
      "scan_id": 489,
      "test_id": 10
    },
    {
      "scan_id": 336,
      "test_id": 6
    },
    {
      "scan_id": 298,
      "test_id": 2
    },
    {
      "scan_id": 524,
      "test_id": 10
    },
    {
      "scan_id": 569,
      "test_id": 4
    },
    {
      "scan_id": 280,
      "test_id": 2
    },
    {
      "scan_id": 154,
      "test_id": 2
    },
    {
      "scan_id": 654,
      "test_id": 4
    },
    {
      "scan_id": 678,
      "test_id": 8
    },
    {
      "scan_id": 111,
      "test_id": 2
    },
    {
      "scan_id": 170,
      "test_id": 2
    },
    {
      "scan_id": 361,
      "test_id": 10
    },
    {
      "scan_id": 139,
      "test_id": 2
    },
    {
      "scan_id": 20,
      "test_id": 7
    },
    {
      "scan_id": 545,
      "test_id": 10
    },
    {
      "scan_id": 624,
      "test_id": 4
    },
    {
      "scan_id": 197,
      "test_id": 2
    },
    {
      "scan_id": 640,
      "test_id": 4
    },
    {
      "scan_id": 359,
      "test_id": 10
    },
    {
      "scan_id": 418,
      "test_id": 6
    },
    {
      "scan_id": 573,
      "test_id": 4
    },
    {
      "scan_id": 698,
      "test_id": 8
    },
    {
      "scan_id": 575,
      "test_id": 4
    },
    {
      "scan_id": 632,
      "test_id": 4
    },
    {
      "scan_id": 357,
      "test_id": 10
    },
    {
      "scan_id": 219,
      "test_id": 2
    },
    {
      "scan_id": 163,
      "test_id": 2
    },
    {
      "scan_id": 424,
      "test_id": 6
    },
    {
      "scan_id": 563,
      "test_id": 4
    },
    {
      "scan_id": 422,
      "test_id": 6
    },
    {
      "scan_id": 538,
      "test_id": 10
    },
    {
      "scan_id": 511,
      "test_id": 10
    },
    {
      "scan_id": 57,
      "test_id": 7
    },
    {
      "scan_id": 694,
      "test_id": 8
    },
    {
      "scan_id": 392,
      "test_id": 6
    },
    {
      "scan_id": 587,
      "test_id": 4
    },
    {
      "scan_id": 229,
      "test_id": 2
    },
    {
      "scan_id": 547,
      "test_id": 10
    },
    {
      "scan_id": 358,
      "test_id": 10
    },
    {
      "scan_id": 118,
      "test_id": 2
    },
    {
      "scan_id": 539,
      "test_id": 10
    },
    {
      "scan_id": 702,
      "test_id": 8
    },
    {
      "scan_id": 54,
      "test_id": 7
    },
    {
      "scan_id": 447,
      "test_id": 6
    },
    {
      "scan_id": 406,
      "test_id": 6
    },
    {
      "scan_id": 574,
      "test_id": 4
    },
    {
      "scan_id": 414,
      "test_id": 6
    },
    {
      "scan_id": 403,
      "test_id": 6
    },
    {
      "scan_id": 615,
      "test_id": 4
    },
    {
      "scan_id": 461,
      "test_id": 6
    },
    {
      "scan_id": 540,
      "test_id": 10
    },
    {
      "scan_id": 289,
      "test_id": 2
    },
    {
      "scan_id": 248,
      "test_id": 2
    },
    {
      "scan_id": 440,
      "test_id": 6
    },
    {
      "scan_id": 634,
      "test_id": 4
    },
    {
      "scan_id": 501,
      "test_id": 10
    },
    {
      "scan_id": 520,
      "test_id": 10
    },
    {
      "scan_id": 509,
      "test_id": 10
    },
    {
      "scan_id": 63,
      "test_id": 7
    },
    {
      "scan_id": 760,
      "test_id": 8
    },
    {
      "scan_id": 487,
      "test_id": 6
    },
    {
      "scan_id": 65,
      "test_id": 7
    },
    {
      "scan_id": 301,
      "test_id": 2
    },
    {
      "scan_id": 737,
      "test_id": 8
    },
    {
      "scan_id": 69,
      "test_id": 7
    },
    {
      "scan_id": 191,
      "test_id": 2
    },
    {
      "scan_id": 475,
      "test_id": 6
    },
    {
      "scan_id": 533,
      "test_id": 10
    },
    {
      "scan_id": 98,
      "test_id": 2
    },
    {
      "scan_id": 48,
      "test_id": 7
    },
    {
      "scan_id": 302,
      "test_id": 2
    },
    {
      "scan_id": 704,
      "test_id": 8
    },
    {
      "scan_id": 345,
      "test_id": 10
    },
    {
      "scan_id": 445,
      "test_id": 6
    },
    {
      "scan_id": 703,
      "test_id": 8
    },
    {
      "scan_id": 99,
      "test_id": 2
    },
    {
      "scan_id": 188,
      "test_id": 2
    },
    {
      "scan_id": 145,
      "test_id": 2
    },
    {
      "scan_id": 753,
      "test_id": 8
    },
    {
      "scan_id": 181,
      "test_id": 2
    },
    {
      "scan_id": 378,
      "test_id": 6
    },
    {
      "scan_id": 187,
      "test_id": 2
    },
    {
      "scan_id": 269,
      "test_id": 2
    },
    {
      "scan_id": 43,
      "test_id": 7
    },
    {
      "scan_id": 259,
      "test_id": 2
    },
    {
      "scan_id": 168,
      "test_id": 2
    },
    {
      "scan_id": 493,
      "test_id": 10
    },
    {
      "scan_id": 572,
      "test_id": 4
    },
    {
      "scan_id": 713,
      "test_id": 8
    },
    {
      "scan_id": 434,
      "test_id": 6
    },
    {
      "scan_id": 109,
      "test_id": 2
    },
    {
      "scan_id": 530,
      "test_id": 10
    },
    {
      "scan_id": 729,
      "test_id": 8
    },
    {
      "scan_id": 761,
      "test_id": 8
    },
    {
      "scan_id": 647,
      "test_id": 4
    },
    {
      "scan_id": 739,
      "test_id": 8
    },
    {
      "scan_id": 367,
      "test_id": 10
    },
    {
      "scan_id": 714,
      "test_id": 8
    },
    {
      "scan_id": 652,
      "test_id": 4
    },
    {
      "scan_id": 393,
      "test_id": 6
    },
    {
      "scan_id": 100,
      "test_id": 2
    },
    {
      "scan_id": 646,
      "test_id": 4
    },
    {
      "scan_id": 686,
      "test_id": 8
    },
    {
      "scan_id": 410,
      "test_id": 6
    },
    {
      "scan_id": 79,
      "test_id": 7
    },
    {
      "scan_id": 598,
      "test_id": 4
    },
    {
      "scan_id": 508,
      "test_id": 10
    },
    {
      "scan_id": 267,
      "test_id": 2
    },
    {
      "scan_id": 451,
      "test_id": 6
    },
    {
      "scan_id": 479,
      "test_id": 6
    },
    {
      "scan_id": 382,
      "test_id": 6
    },
    {
      "scan_id": 438,
      "test_id": 6
    },
    {
      "scan_id": 653,
      "test_id": 4
    },
    {
      "scan_id": 312,
      "test_id": 6
    },
    {
      "scan_id": 26,
      "test_id": 7
    },
    {
      "scan_id": 720,
      "test_id": 8
    },
    {
      "scan_id": 651,
      "test_id": 4
    },
    {
      "scan_id": 224,
      "test_id": 2
    },
    {
      "scan_id": 560,
      "test_id": 4
    },
    {
      "scan_id": 716,
      "test_id": 8
    },
    {
      "scan_id": 366,
      "test_id": 10
    },
    {
      "scan_id": 173,
      "test_id": 2
    },
    {
      "scan_id": 625,
      "test_id": 4
    },
    {
      "scan_id": 467,
      "test_id": 6
    },
    {
      "scan_id": 306,
      "test_id": 2
    },
    {
      "scan_id": 230,
      "test_id": 2
    },
    {
      "scan_id": 581,
      "test_id": 4
    },
    {
      "scan_id": 439,
      "test_id": 6
    },
    {
      "scan_id": 41,
      "test_id": 7
    },
    {
      "scan_id": 746,
      "test_id": 8
    },
    {
      "scan_id": 257,
      "test_id": 2
    },
    {
      "scan_id": 265,
      "test_id": 2
    },
    {
      "scan_id": 505,
      "test_id": 10
    },
    {
      "scan_id": 655,
      "test_id": 4
    },
    {
      "scan_id": 718,
      "test_id": 8
    },
    {
      "scan_id": 381,
      "test_id": 6
    },
    {
      "scan_id": 455,
      "test_id": 6
    },
    {
      "scan_id": 194,
      "test_id": 2
    },
    {
      "scan_id": 251,
      "test_id": 2
    },
    {
      "scan_id": 570,
      "test_id": 4
    },
    {
      "scan_id": 513,
      "test_id": 10
    },
    {
      "scan_id": 49,
      "test_id": 7
    },
    {
      "scan_id": 193,
      "test_id": 2
    },
    {
      "scan_id": 565,
      "test_id": 4
    },
    {
      "scan_id": 724,
      "test_id": 8
    },
    {
      "scan_id": 313,
      "test_id": 6
    },
    {
      "scan_id": 687,
      "test_id": 8
    },
    {
      "scan_id": 332,
      "test_id": 6
    },
    {
      "scan_id": 365,
      "test_id": 10
    },
    {
      "scan_id": 607,
      "test_id": 4
    },
    {
      "scan_id": 597,
      "test_id": 4
    },
    {
      "scan_id": 521,
      "test_id": 10
    },
    {
      "scan_id": 491,
      "test_id": 10
    },
    {
      "scan_id": 323,
      "test_id": 6
    },
    {
      "scan_id": 658,
      "test_id": 4
    },
    {
      "scan_id": 663,
      "test_id": 8
    },
    {
      "scan_id": 21,
      "test_id": 7
    },
    {
      "scan_id": 209,
      "test_id": 2
    },
    {
      "scan_id": 217,
      "test_id": 2
    },
    {
      "scan_id": 166,
      "test_id": 2
    },
    {
      "scan_id": 711,
      "test_id": 8
    },
    {
      "scan_id": 577,
      "test_id": 4
    },
    {
      "scan_id": 423,
      "test_id": 6
    },
    {
      "scan_id": 637,
      "test_id": 4
    },
    {
      "scan_id": 328,
      "test_id": 6
    },
    {
      "scan_id": 74,
      "test_id": 7
    },
    {
      "scan_id": 579,
      "test_id": 4
    },
    {
      "scan_id": 398,
      "test_id": 6
    },
    {
      "scan_id": 732,
      "test_id": 8
    },
    {
      "scan_id": 645,
      "test_id": 4
    },
    {
      "scan_id": 754,
      "test_id": 8
    },
    {
      "scan_id": 582,
      "test_id": 4
    },
    {
      "scan_id": 666,
      "test_id": 8
    },
    {
      "scan_id": 106,
      "test_id": 2
    },
    {
      "scan_id": 353,
      "test_id": 10
    },
    {
      "scan_id": 735,
      "test_id": 8
    },
    {
      "scan_id": 211,
      "test_id": 2
    },
    {
      "scan_id": 485,
      "test_id": 6
    },
    {
      "scan_id": 354,
      "test_id": 10
    },
    {
      "scan_id": 314,
      "test_id": 6
    },
    {
      "scan_id": 293,
      "test_id": 2
    },
    {
      "scan_id": 664,
      "test_id": 8
    },
    {
      "scan_id": 290,
      "test_id": 2
    },
    {
      "scan_id": 480,
      "test_id": 6
    },
    {
      "scan_id": 199,
      "test_id": 2
    },
    {
      "scan_id": 76,
      "test_id": 7
    },
    {
      "scan_id": 159,
      "test_id": 2
    },
    {
      "scan_id": 745,
      "test_id": 8
    },
    {
      "scan_id": 56,
      "test_id": 7
    },
    {
      "scan_id": 564,
      "test_id": 4
    },
    {
      "scan_id": 748,
      "test_id": 8
    },
    {
      "scan_id": 182,
      "test_id": 2
    },
    {
      "scan_id": 218,
      "test_id": 2
    },
    {
      "scan_id": 77,
      "test_id": 7
    },
    {
      "scan_id": 385,
      "test_id": 6
    },
    {
      "scan_id": 709,
      "test_id": 8
    },
    {
      "scan_id": 409,
      "test_id": 6
    },
    {
      "scan_id": 436,
      "test_id": 6
    },
    {
      "scan_id": 503,
      "test_id": 10
    },
    {
      "scan_id": 237,
      "test_id": 2
    },
    {
      "scan_id": 627,
      "test_id": 4
    },
    {
      "scan_id": 356,
      "test_id": 10
    },
    {
      "scan_id": 529,
      "test_id": 10
    },
    {
      "scan_id": 700,
      "test_id": 8
    },
    {
      "scan_id": 449,
      "test_id": 6
    },
    {
      "scan_id": 556,
      "test_id": 10
    },
    {
      "scan_id": 19,
      "test_id": 7
    },
    {
      "scan_id": 578,
      "test_id": 4
    },
    {
      "scan_id": 404,
      "test_id": 6
    },
    {
      "scan_id": 299,
      "test_id": 2
    },
    {
      "scan_id": 165,
      "test_id": 2
    },
    {
      "scan_id": 352,
      "test_id": 10
    },
    {
      "scan_id": 279,
      "test_id": 2
    },
    {
      "scan_id": 667,
      "test_id": 8
    },
    {
      "scan_id": 268,
      "test_id": 2
    },
    {
      "scan_id": 553,
      "test_id": 10
    },
    {
      "scan_id": 425,
      "test_id": 6
    },
    {
      "scan_id": 430,
      "test_id": 6
    },
    {
      "scan_id": 339,
      "test_id": 10
    },
    {
      "scan_id": 82,
      "test_id": 7
    },
    {
      "scan_id": 228,
      "test_id": 2
    },
    {
      "scan_id": 707,
      "test_id": 8
    },
    {
      "scan_id": 462,
      "test_id": 6
    },
    {
      "scan_id": 162,
      "test_id": 2
    },
    {
      "scan_id": 61,
      "test_id": 7
    },
    {
      "scan_id": 589,
      "test_id": 4
    },
    {
      "scan_id": 586,
      "test_id": 4
    },
    {
      "scan_id": 453,
      "test_id": 6
    },
    {
      "scan_id": 318,
      "test_id": 6
    },
    {
      "scan_id": 639,
      "test_id": 4
    },
    {
      "scan_id": 136,
      "test_id": 2
    },
    {
      "scan_id": 364,
      "test_id": 10
    },
    {
      "scan_id": 395,
      "test_id": 6
    },
    {
      "scan_id": 576,
      "test_id": 4
    },
    {
      "scan_id": 316,
      "test_id": 6
    },
    {
      "scan_id": 262,
      "test_id": 2
    },
    {
      "scan_id": 86,
      "test_id": 7
    },
    {
      "scan_id": 140,
      "test_id": 2
    },
    {
      "scan_id": 460,
      "test_id": 6
    },
    {
      "scan_id": 64,
      "test_id": 7
    },
    {
      "scan_id": 561,
      "test_id": 4
    },
    {
      "scan_id": 225,
      "test_id": 2
    },
    {
      "scan_id": 33,
      "test_id": 7
    },
    {
      "scan_id": 258,
      "test_id": 2
    },
    {
      "scan_id": 616,
      "test_id": 4
    },
    {
      "scan_id": 78,
      "test_id": 7
    },
    {
      "scan_id": 519,
      "test_id": 10
    },
    {
      "scan_id": 473,
      "test_id": 6
    },
    {
      "scan_id": 593,
      "test_id": 4
    },
    {
      "scan_id": 155,
      "test_id": 2
    },
    {
      "scan_id": 68,
      "test_id": 7
    },
    {
      "scan_id": 252,
      "test_id": 2
    },
    {
      "scan_id": 239,
      "test_id": 2
    },
    {
      "scan_id": 523,
      "test_id": 10
    },
    {
      "scan_id": 327,
      "test_id": 6
    },
    {
      "scan_id": 120,
      "test_id": 2
    },
    {
      "scan_id": 543,
      "test_id": 10
    },
    {
      "scan_id": 350,
      "test_id": 10
    },
    {
      "scan_id": 205,
      "test_id": 2
    },
    {
      "scan_id": 157,
      "test_id": 2
    },
    {
      "scan_id": 500,
      "test_id": 10
    },
    {
      "scan_id": 158,
      "test_id": 2
    },
    {
      "scan_id": 329,
      "test_id": 6
    },
    {
      "scan_id": 472,
      "test_id": 6
    },
    {
      "scan_id": 93,
      "test_id": 2
    },
    {
      "scan_id": 478,
      "test_id": 6
    },
    {
      "scan_id": 592,
      "test_id": 4
    },
    {
      "scan_id": 135,
      "test_id": 2
    },
    {
      "scan_id": 123,
      "test_id": 2
    },
    {
      "scan_id": 504,
      "test_id": 10
    },
    {
      "scan_id": 747,
      "test_id": 8
    },
    {
      "scan_id": 315,
      "test_id": 6
    },
    {
      "scan_id": 240,
      "test_id": 2
    },
    {
      "scan_id": 227,
      "test_id": 2
    },
    {
      "scan_id": 730,
      "test_id": 8
    },
    {
      "scan_id": 24,
      "test_id": 7
    },
    {
      "scan_id": 83,
      "test_id": 7
    },
    {
      "scan_id": 638,
      "test_id": 4
    },
    {
      "scan_id": 736,
      "test_id": 8
    },
    {
      "scan_id": 689,
      "test_id": 8
    },
    {
      "scan_id": 375,
      "test_id": 6
    },
    {
      "scan_id": 656,
      "test_id": 4
    },
    {
      "scan_id": 288,
      "test_id": 2
    },
    {
      "scan_id": 297,
      "test_id": 2
    },
    {
      "scan_id": 349,
      "test_id": 10
    },
    {
      "scan_id": 417,
      "test_id": 6
    },
    {
      "scan_id": 300,
      "test_id": 2
    },
    {
      "scan_id": 325,
      "test_id": 6
    },
    {
      "scan_id": 546,
      "test_id": 10
    },
    {
      "scan_id": 32,
      "test_id": 7
    },
    {
      "scan_id": 416,
      "test_id": 6
    },
    {
      "scan_id": 216,
      "test_id": 2
    },
    {
      "scan_id": 37,
      "test_id": 7
    },
    {
      "scan_id": 749,
      "test_id": 8
    },
    {
      "scan_id": 690,
      "test_id": 8
    },
    {
      "scan_id": 223,
      "test_id": 2
    },
    {
      "scan_id": 105,
      "test_id": 2
    },
    {
      "scan_id": 263,
      "test_id": 2
    },
    {
      "scan_id": 618,
      "test_id": 4
    },
    {
      "scan_id": 631,
      "test_id": 4
    },
    {
      "scan_id": 457,
      "test_id": 6
    },
    {
      "scan_id": 412,
      "test_id": 6
    },
    {
      "scan_id": 554,
      "test_id": 10
    },
    {
      "scan_id": 502,
      "test_id": 10
    },
    {
      "scan_id": 526,
      "test_id": 10
    },
    {
      "scan_id": 351,
      "test_id": 10
    },
    {
      "scan_id": 55,
      "test_id": 7
    },
    {
      "scan_id": 384,
      "test_id": 6
    },
    {
      "scan_id": 675,
      "test_id": 8
    },
    {
      "scan_id": 580,
      "test_id": 4
    },
    {
      "scan_id": 58,
      "test_id": 7
    },
    {
      "scan_id": 495,
      "test_id": 10
    },
    {
      "scan_id": 464,
      "test_id": 6
    },
    {
      "scan_id": 134,
      "test_id": 2
    },
    {
      "scan_id": 243,
      "test_id": 2
    },
    {
      "scan_id": 308,
      "test_id": 2
    },
    {
      "scan_id": 633,
      "test_id": 4
    },
    {
      "scan_id": 368,
      "test_id": 10
    },
    {
      "scan_id": 499,
      "test_id": 10
    },
    {
      "scan_id": 234,
      "test_id": 2
    },
    {
      "scan_id": 355,
      "test_id": 10
    },
    {
      "scan_id": 179,
      "test_id": 2
    },
    {
      "scan_id": 662,
      "test_id": 8
    },
    {
      "scan_id": 379,
      "test_id": 6
    },
    {
      "scan_id": 172,
      "test_id": 2
    },
    {
      "scan_id": 723,
      "test_id": 8
    },
    {
      "scan_id": 125,
      "test_id": 2
    },
    {
      "scan_id": 274,
      "test_id": 2
    },
    {
      "scan_id": 45,
      "test_id": 7
    },
    {
      "scan_id": 303,
      "test_id": 2
    },
    {
      "scan_id": 270,
      "test_id": 2
    },
    {
      "scan_id": 317,
      "test_id": 6
    },
    {
      "scan_id": 516,
      "test_id": 10
    },
    {
      "scan_id": 34,
      "test_id": 7
    },
    {
      "scan_id": 201,
      "test_id": 2
    },
    {
      "scan_id": 470,
      "test_id": 6
    },
    {
      "scan_id": 320,
      "test_id": 6
    },
    {
      "scan_id": 281,
      "test_id": 2
    },
    {
      "scan_id": 600,
      "test_id": 4
    },
    {
      "scan_id": 126,
      "test_id": 2
    },
    {
      "scan_id": 681,
      "test_id": 8
    },
    {
      "scan_id": 250,
      "test_id": 2
    },
    {
      "scan_id": 177,
      "test_id": 2
    },
    {
      "scan_id": 122,
      "test_id": 2
    },
    {
      "scan_id": 85,
      "test_id": 7
    },
    {
      "scan_id": 273,
      "test_id": 2
    },
    {
      "scan_id": 210,
      "test_id": 2
    },
    {
      "scan_id": 117,
      "test_id": 2
    },
    {
      "scan_id": 492,
      "test_id": 10
    },
    {
      "scan_id": 441,
      "test_id": 6
    },
    {
      "scan_id": 541,
      "test_id": 10
    },
    {
      "scan_id": 683,
      "test_id": 8
    },
    {
      "scan_id": 649,
      "test_id": 4
    },
    {
      "scan_id": 612,
      "test_id": 4
    },
    {
      "scan_id": 213,
      "test_id": 2
    },
    {
      "scan_id": 103,
      "test_id": 2
    },
    {
      "scan_id": 641,
      "test_id": 4
    },
    {
      "scan_id": 73,
      "test_id": 7
    },
    {
      "scan_id": 94,
      "test_id": 2
    },
    {
      "scan_id": 60,
      "test_id": 7
    },
    {
      "scan_id": 144,
      "test_id": 2
    },
    {
      "scan_id": 337,
      "test_id": 10
    },
    {
      "scan_id": 363,
      "test_id": 10
    },
    {
      "scan_id": 688,
      "test_id": 8
    },
    {
      "scan_id": 151,
      "test_id": 2
    },
    {
      "scan_id": 342,
      "test_id": 10
    },
    {
      "scan_id": 150,
      "test_id": 2
    },
    {
      "scan_id": 160,
      "test_id": 2
    },
    {
      "scan_id": 599,
      "test_id": 4
    },
    {
      "scan_id": 568,
      "test_id": 4
    },
    {
      "scan_id": 184,
      "test_id": 2
    },
    {
      "scan_id": 752,
      "test_id": 8
    },
    {
      "scan_id": 628,
      "test_id": 4
    },
    {
      "scan_id": 387,
      "test_id": 6
    },
    {
      "scan_id": 468,
      "test_id": 6
    },
    {
      "scan_id": 512,
      "test_id": 10
    },
    {
      "scan_id": 38,
      "test_id": 7
    },
    {
      "scan_id": 481,
      "test_id": 6
    },
    {
      "scan_id": 294,
      "test_id": 2
    },
    {
      "scan_id": 285,
      "test_id": 2
    },
    {
      "scan_id": 442,
      "test_id": 6
    },
    {
      "scan_id": 719,
      "test_id": 8
    },
    {
      "scan_id": 275,
      "test_id": 2
    },
    {
      "scan_id": 116,
      "test_id": 2
    },
    {
      "scan_id": 458,
      "test_id": 6
    },
    {
      "scan_id": 283,
      "test_id": 2
    },
    {
      "scan_id": 552,
      "test_id": 10
    },
    {
      "scan_id": 399,
      "test_id": 6
    },
    {
      "scan_id": 484,
      "test_id": 6
    },
    {
      "scan_id": 291,
      "test_id": 2
    },
    {
      "scan_id": 757,
      "test_id": 8
    },
    {
      "scan_id": 266,
      "test_id": 2
    },
    {
      "scan_id": 192,
      "test_id": 2
    },
    {
      "scan_id": 59,
      "test_id": 7
    },
    {
      "scan_id": 143,
      "test_id": 2
    },
    {
      "scan_id": 497,
      "test_id": 10
    },
    {
      "scan_id": 29,
      "test_id": 7
    },
    {
      "scan_id": 87,
      "test_id": 7
    },
    {
      "scan_id": 750,
      "test_id": 8
    },
    {
      "scan_id": 515,
      "test_id": 10
    },
    {
      "scan_id": 644,
      "test_id": 4
    },
    {
      "scan_id": 212,
      "test_id": 2
    },
    {
      "scan_id": 167,
      "test_id": 2
    },
    {
      "scan_id": 88,
      "test_id": 2
    },
    {
      "scan_id": 413,
      "test_id": 6
    },
    {
      "scan_id": 756,
      "test_id": 8
    },
    {
      "scan_id": 623,
      "test_id": 4
    },
    {
      "scan_id": 71,
      "test_id": 7
    },
    {
      "scan_id": 710,
      "test_id": 8
    },
    {
      "scan_id": 510,
      "test_id": 10
    },
    {
      "scan_id": 178,
      "test_id": 2
    },
    {
      "scan_id": 148,
      "test_id": 2
    },
    {
      "scan_id": 534,
      "test_id": 10
    },
    {
      "scan_id": 427,
      "test_id": 6
    },
    {
      "scan_id": 622,
      "test_id": 4
    },
    {
      "scan_id": 557,
      "test_id": 10
    },
    {
      "scan_id": 614,
      "test_id": 4
    },
    {
      "scan_id": 127,
      "test_id": 2
    },
    {
      "scan_id": 245,
      "test_id": 2
    },
    {
      "scan_id": 408,
      "test_id": 6
    },
    {
      "scan_id": 435,
      "test_id": 6
    },
    {
      "scan_id": 200,
      "test_id": 2
    },
    {
      "scan_id": 701,
      "test_id": 8
    },
    {
      "scan_id": 330,
      "test_id": 6
    },
    {
      "scan_id": 220,
      "test_id": 2
    },
    {
      "scan_id": 685,
      "test_id": 8
    },
    {
      "scan_id": 75,
      "test_id": 7
    },
    {
      "scan_id": 507,
      "test_id": 10
    },
    {
      "scan_id": 47,
      "test_id": 7
    },
    {
      "scan_id": 602,
      "test_id": 4
    },
    {
      "scan_id": 391,
      "test_id": 6
    },
    {
      "scan_id": 321,
      "test_id": 6
    },
    {
      "scan_id": 670,
      "test_id": 8
    },
    {
      "scan_id": 156,
      "test_id": 2
    },
    {
      "scan_id": 691,
      "test_id": 8
    },
    {
      "scan_id": 604,
      "test_id": 4
    },
    {
      "scan_id": 277,
      "test_id": 2
    },
    {
      "scan_id": 648,
      "test_id": 4
    },
    {
      "scan_id": 459,
      "test_id": 6
    },
    {
      "scan_id": 255,
      "test_id": 2
    },
    {
      "scan_id": 389,
      "test_id": 6
    },
    {
      "scan_id": 333,
      "test_id": 6
    },
    {
      "scan_id": 692,
      "test_id": 8
    },
    {
      "scan_id": 669,
      "test_id": 8
    },
    {
      "scan_id": 96,
      "test_id": 2
    },
    {
      "scan_id": 454,
      "test_id": 6
    },
    {
      "scan_id": 114,
      "test_id": 2
    },
    {
      "scan_id": 326,
      "test_id": 6
    },
    {
      "scan_id": 260,
      "test_id": 2
    },
    {
      "scan_id": 249,
      "test_id": 2
    },
    {
      "scan_id": 256,
      "test_id": 2
    },
    {
      "scan_id": 726,
      "test_id": 8
    },
    {
      "scan_id": 189,
      "test_id": 2
    },
    {
      "scan_id": 90,
      "test_id": 2
    },
    {
      "scan_id": 390,
      "test_id": 6
    },
    {
      "scan_id": 432,
      "test_id": 6
    },
    {
      "scan_id": 407,
      "test_id": 6
    },
    {
      "scan_id": 532,
      "test_id": 10
    },
    {
      "scan_id": 671,
      "test_id": 8
    },
    {
      "scan_id": 605,
      "test_id": 4
    },
    {
      "scan_id": 677,
      "test_id": 8
    },
    {
      "scan_id": 97,
      "test_id": 2
    },
    {
      "scan_id": 27,
      "test_id": 7
    },
    {
      "scan_id": 463,
      "test_id": 6
    },
    {
      "scan_id": 636,
      "test_id": 4
    },
    {
      "scan_id": 465,
      "test_id": 6
    },
    {
      "scan_id": 629,
      "test_id": 4
    },
    {
      "scan_id": 734,
      "test_id": 8
    },
    {
      "scan_id": 264,
      "test_id": 2
    },
    {
      "scan_id": 309,
      "test_id": 6
    },
    {
      "scan_id": 562,
      "test_id": 4
    },
    {
      "scan_id": 680,
      "test_id": 8
    },
    {
      "scan_id": 271,
      "test_id": 2
    },
    {
      "scan_id": 128,
      "test_id": 2
    },
    {
      "scan_id": 619,
      "test_id": 4
    },
    {
      "scan_id": 452,
      "test_id": 6
    },
    {
      "scan_id": 642,
      "test_id": 4
    },
    {
      "scan_id": 254,
      "test_id": 2
    },
    {
      "scan_id": 53,
      "test_id": 7
    },
    {
      "scan_id": 722,
      "test_id": 8
    },
    {
      "scan_id": 233,
      "test_id": 2
    },
    {
      "scan_id": 676,
      "test_id": 8
    },
    {
      "scan_id": 522,
      "test_id": 10
    },
    {
      "scan_id": 731,
      "test_id": 8
    }
  ]