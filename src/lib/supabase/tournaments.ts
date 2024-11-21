import { supabase } from "../supabaseClient";
import { unarchiveTest, archiveTest } from "./tests";

export interface TournamentRequest {
	tournament_name: string;
	tournament_date?: string;
}

export interface TournamentEditRequest {
	tournament_name?: string;
	tournament_date?: string;
}

/**
 * Fetches the tournament info of all tournaments from the database
 *
 * @param customSelect optional, string
 * @returns List of all tournaments from database
 */
export async function getAllTournaments(customSelect = "*") {
	let { data, error } = await supabase.from("tournaments").select(customSelect);
	if (error) throw error;
	return data;
}

/**
 * Fetches the tournament info of all tournaments from database, ordered by customOrder
 *
 * @param customOrder string
 * @param customSelect optional, string
 * @returns Ordered list of all tournaments
 */
export async function getAllTournamentsOrder(
	customOrder: string,
	customSelect = "*"
) {
	let { data, error } = await supabase
		.from("tournaments")
		.select(customSelect)
		.order(customOrder);
	if (error) throw error;
	return data;
}

/**
 * Fetches the tournament info of all tournaments from the database
 *
 * @param customSelect optional, string
 * @returns List of all tournaments from database
 */
export async function getAllTournamentsUnarchived(customSelect = "*") {
	let { data, error } = await supabase
		.from("tournaments")
		.select(customSelect)
		.eq("archived", false);
	if (error) throw error;
	return data;
}

/**
 * Returns tournament info object given tournament id
 *
 * @param tournament_id number
 * @param customSelect optional, string
 * @returns tournament info from database
 */
export async function getTournamentInfo(
	tournament_id: number,
	customSelect = "*"
) {
	let { data, error } = await supabase
		.from("tournaments")
		.select(customSelect)
		.eq("id", tournament_id)
		.single();
	if (error) throw error;
	return data;
}

/**
 * Returns test info objects associated with a tournament, given its tournament id
 *
 * @param tournament_id number
 * @returns list of test info objects
 */
export async function getTournamentTests(
	tournament_id: number,
	customSelect: string = "*" // optional
) {
	let { data, error } = await supabase
		.from("tests")
		.select(customSelect)
		.eq("tournament_id", tournament_id);
	if (error) throw error;
	return data;
}

/**
 * Returns everything about a tournament given its id: info and tests
 *
 * @param tournament_id number
 * @returns tournament object
 */
export async function getTournament(tournament_id: number) {
	let tournament = await getTournamentInfo(tournament_id);
	tournament.tests = await getTournamentTests(tournament_id);
	return tournament;
}

/**
 * Creates a tournament given the name and date in an object
 *
 * @param tournament object
 * @returns tournament object in database, including id
 */
export async function createTournament(tournament: TournamentRequest) {
	const { data, error } = await supabase
		.from("tournaments")
		.insert([tournament])
		.select();
	if (error) throw error;
	return data;
}

/**
 * Edits a tournament given the updated info and tournament id
 *
 * @param tournament object
 * @param tournament_id number
 * @returns tournament object in database
 */
export async function editTournament(
	tournament: TournamentEditRequest,
	tournament_id: number
) {
	const { data, error } = await supabase
		.from("tournaments")
		.update(tournament)
		.eq("id", tournament_id)
		.select();
	if (error) throw error;
	return data;
}

/**
 * Archives the tournament, all tests, and all problems associated with the tournament id. Returns nothing.
 *
 * @param tournament_id number
 */
export async function archiveTournament(tournament_id: number) {
	const { error: error1 } = await supabase
		.from("tournaments")
		.update({ archived: true })
		.eq("id", tournament_id);
	if (error1) throw error1;

	const { error: error2 } = await supabase
		.from("tests")
		.update({ archived: true })
		.eq("tournament_id", tournament_id);
	if (error2) throw error2;

	let tests = await getTournamentTests(tournament_id);
	for (let i of tests) {
		archiveTest(i.id);
	}
}

/**
 * Archives the tournament, all tests, and all problems associated with the tournament id. Returns nothing.
 *
 * @param tournament_id number
 */
export async function unarchiveTournament(tournament_id: number) {
	const { error: error1 } = await supabase
		.from("tournaments")
		.update({ archived: false })
		.eq("id", tournament_id);
	if (error1) throw error1;

	const { error: error2 } = await supabase
		.from("tests")
		.update({ archived: false })
		.eq("tournament_id", tournament_id);
	if (error2) throw error2;

	let tests = await getTournamentTests(tournament_id);
	for (let i of tests) {
		unarchiveTest(i.id);
	}
}
