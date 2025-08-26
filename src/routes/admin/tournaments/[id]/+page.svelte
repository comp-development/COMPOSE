<script>
	import { page } from "$app/stores";
	import Button from "$lib/components/Button.svelte";
	import ModalButton from "$lib/components/ModalButton.svelte";
	import Loading from "../../../../lib/components/Loading.svelte";
	import toast from "svelte-french-toast";
	import JSZip from "jszip";
	import {
		archiveTournament,
		unarchiveTournament,
		getTournamentInfo,
		getTournamentTests,
		getTestProblems,
		getProblems,
		getImages,
		downloadImagesFromPath,
	} from "$lib/supabase";
	import { handleError } from "$lib/handleError.ts";

	let tournamentId = $page.params.id;
	let tournament;
	let tests = [];
	let loading = false;

	async function getTournament() {
		try {
			loading = true;
			tournament = await getTournamentInfo(tournamentId);
			loading = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getTests() {
		try {
			loading = true;
			tests = await getTournamentTests(tournamentId);
			loading = false;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	async function getBucketPaths(path) {
		try {
			const data = await getImages(path);
			let ans = [];
			for (let i = 0; i < data.length; i++) {
				if (data[i].id != null) {
					if (path === "") {
						ans.push(data[i].name);
					} else {
						ans.push(path + "/" + data[i].name);
					}
				} else {
					let x;
					if (path === "") {
						x = await getBucketPaths(data[i].name);
					} else {
						x = await getBucketPaths(path + "/" + data[i].name);
					}
					for (let j = 0; j < x.length; j++) {
						ans.push(x[j]);
					}
				}
			}
			return ans;
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	function changeImageFilepaths(str) {
		return str.replace(/(.*\\image.*\{)(\/)(.*\})/, "$1images_folder/$3");
	}

	async function downloadTournament() {
		try {
			let zip = new JSZip();
			let full_problems = await getProblems();
			let problemFolder = zip.folder("Problems");
			for (const x of full_problems) {
				let s = "";
				s +=
					"\\documentclass{article}\n\\usepackage{Miscellaneous/MustangMath}\n\n\\begin{filecontents*} {Problem.tex}\n";
				s += "%<*Tag>" + x.front_id + "%</Tag>\n\n";
				s += "%<*Author>" + x.full_name + "%</Author>\n\n";
				s +=
					"%<*Problem>" +
					changeImageFilepaths(x.problem_latex) +
					"%</Problem>\n\n";
				let finalAnsLatex = changeImageFilepaths(x.answer_latex).trim(); // stripping $ from both sides of answer latex because Yuuki said so
				if (finalAnsLatex.substring(0, 1) === "$") {
					finalAnsLatex = finalAnsLatex.substring(1);
				}
				if (finalAnsLatex.substring(finalAnsLatex.length - 1) === "$") {
					finalAnsLatex = finalAnsLatex.substring(0, finalAnsLatex.length - 1);
				}
				s += "%<*Answer>" + finalAnsLatex + "%</Answer>\n\n";
				s +=
					"%<*Solution>" +
					changeImageFilepaths(x.solution_latex) +
					"%</Solution>\n";
				s += "\\end{filecontents*}\n\n\\begin{document}\n";
				s += "    \\large\n";
				s +=
					"    \\textbf{\\ExecuteMetaData[Problem.tex]{Tag}}\\ExecuteMetaData[Problem.tex]{Problem}\\\\\\\\ \n";
				s +=
					"    \\textit{Written by:} \\textit{\\ExecuteMetaData[Problem.tex]{Author}}\\\\[0.5cm]\n";
				s +=
					"    \\textbf{Answer: } $\\boxed{\\ExecuteMetaData[Problem.tex]{Answer}}$\\\\\\\\ \n";
				s += "    \\ExecuteMetaData[Problem.tex]{Solution}\n";
				s += "\\end{document}";
				problemFolder.file(x.front_id + ".tex", s);
			}

			let testOverallFolder = zip.folder("Tests");

			for (const test of tests) {
				let testFolder = testOverallFolder.folder(test.test_name);
				let problemList = "\\def\\List{";

				let testProblems = await getTestProblems(test.id);
				for (const problem of testProblems) {
					problemList += problem.full_problems.front_id + ",";
				}

				if (problemList.charAt(problemList.length - 1) == ",") {
					problemList = problemList.substring(0, problemList.length - 1);
				}

				problemList += "}";
				testFolder.file("ProblemList.tex", problemList);
				let problemTex =
					"\\documentclass{article}\n\\usepackage{Miscellaneous/MustangMath}\n\n\\begin{document}\n\\input{Tests/" +
					test.test_name +
					"/ProblemList.tex}\n\\large\n\\begin{enumerate}\n    \\foreach \\p [count=\\i] in \\List{\n        \\item \\ProblemBlurb{\\p}\n    }\n\\end{enumerate}\n\\newpage\n\\end{document}";
				testFolder.file("Problems.tex", problemTex);
				let solutionTex =
					"\\documentclass{article}\n\\usepackage{Miscellaneous/MustangMath}\n\n\\begin{document}\n\\input{Tests/" +
					test.test_name +
					"/ProblemList.tex}\n\\large\n\\begin{enumerate}\n    \\foreach \\p [count=\\i] in \\List{\n        \\item \\SolutionBlurb{\\p}\n    }\n\\end{enumerate}\n\\newpage\n\\end{document}\n";
				testFolder.file("Solutions.tex", solutionTex);
				let answerTex =
					"\\documentclass{article}\n\\usepackage{Miscellaneous/MustangMath}\n\n\\begin{document}\n\\input{Tests/" +
					test.test_name +
					"/ProblemList.tex}\n\\large\n\\begin{enumerate}\n    \\foreach \\p [count=\\i] in \\List{\n        \\item \\UnboxedAnswer{\\p}\n    }\n\\end{enumerate}\n\\newpage\n\\end{document}\n";
				testFolder.file("Answers.tex", answerTex);
			}

			let miscellaneousFolder = zip.folder("Miscellaneous");
			let tcm =
				"\\ProvidesPackage{MustangMath}\n\\usepackage[utf8]{inputenc}\n\\usepackage{geometry} {}\n\\usepackage{amsmath,amssymb,currfile,filecontents,graphicx,enumitem,catchfilebetweentags,fancyhdr,gensymb}\n\\graphicspath{{images_folder/}}\n\\usepackage{mathtools}\n\\usepackage{etoolbox}\n\\usepackage[export]{adjustbox}\n\\usepackage{pgffor}\n\\usepackage{tabularx}\n\\usepackage{ifthen}\n\n\\usepackage{tikz}\n\\usetikzlibrary{math}\n\n\\geometry{\n left = 1in,\n right = 1in,\n top = 0.8in,\n bottom = 0.8in\n }\n\n\\newenvironment*{dummyenv}{}{}\n\n%\\usepackage[dvipsnames]{xcolor}\n\\definecolor{mygray}{gray}{0.9}\n\n\n\\setlength{\\parindent}{0pt}\n\\setlength{\\parskip}{12pt}\n\\usepackage{enumitem}\n\\setenumerate{parsep=10pt}\n\\usepackage{etoolbox}\n\\makeatletter\n\\patchcmd{\\CatchFBT@Fin@l}{\\endlinechar\\m@ne}{}\n  {}{\\typeout{Unsuccessful patch!}}\n\\makeatother\n\n\\pagestyle{fancy}\n\\fancyhf{}\n\\chead{" +
				tournament.tournament_name +
				"}\n\\cfoot{\\copyright\\ 2023 Mustang Math}\n\n\\newcommand{\\Tag}[1]{\\textbf{\\ExecuteMetaData[Problems/#1.tex]{Tag}}}\n\\newcommand{\\Problem}[1]{\\ExecuteMetaData[Problems/#1.tex]{Problem}}\n\n\\newcommand{\\Author}[1]{\\textit{Written by: \\ExecuteMetaData[Problems/#1.tex]{Author}}}\n\\newcommand{\\Answer}[1]{$\\boxed{\\ExecuteMetaData[Problems/#1.tex]{Answer}}$}\n\\newcommand{\\UnboxedAnswer}[1]{$\\ExecuteMetaData[Problems/#1.tex]{Answer}$}\n\\newcommand{\\AnswerBlurb}[1]{$\\ExecuteMetaData[Problems/#1.tex]{Answer}$}\n\n\\newcommand{\\Solution}[1]{\\ExecuteMetaData[Problems/#1.tex]{Solution}}\n\n%\\newcommand{\\ProblemBlurb}[1]{\\Tag{#1}\\Problem{#1}}\n\\newcommand{\\ProblemBlurb}[1]{\\Problem{#1}}\n\\newcommand{\\SolutionBlurb}[1]{ \\Tag{#1}\\Problem{#1}\\\\\\\\ \\Author{#1}\\\\[0.5cm] \\textbf{Answer: } \\Answer{#1}\\\\\\\\ \\Solution{#1} }\n";
			const macros = {
				"\\ans": ["[1]", "\\boxed{#1}"],
				"\\Abs": ["[1]", "\\left\\lVert #1 \\right\\rVert"],
				"\\ang": ["[1]", "\\left \\langle #1 \\right \\rangle"],
				"\\set": ["[1]", "\\left\\{#1\\right\\}"],
				"\\paren": ["[1]", "\\left(#1\\right)"],
				"\\floor": ["[1]", "\\left\\lfloor #1 \\right\\rfloor"],
				"\\ceil": ["[1]", "\\left\\lceil #1 \\right\\rceil"],
				"\\VEC": ["[1]", "\\overrightarrow{#1}"],
				"\\Mod": ["[1]", "\\enspace(\\text{mod}\\ #1)"],
				"\\image": [
					"[2][center,height=4cm]",
					"\\begin{center}\n\t\\includegraphics[#1]{#2}\n\\end{center}",
				],
			};
			for (const x of Object.keys(macros)) {
				tcm +=
					"\\newcommand{" + x + "}" + macros[x][0] + "{" + macros[x][1] + "}\n";
			}
			miscellaneousFolder.file("MustangMath.sty", tcm);

			let image_paths = await getBucketPaths("");
			for (const x of image_paths) {
				const imageX = await downloadImagesFromPath(x);
				zip.file("images_folder/" + x, imageX);
			}

			zip.generateAsync({ type: "blob" }).then(
				function (blob) {
					// 1) generate the zip file
					saveAs(blob, tournament.tournament_name + ".zip"); // 2) trigger the download
				},
				function (err) {
					toast.error(err.message);
				}
			);
		} catch (error) {
			handleError(error);
			toast.error(error.message);
		}
	}

	getTournament();
	getTests();
</script>

{#if loading}
	<Loading />
{:else}
	<br />
	<h1>{tournament?.tournament_name}</h1>
	<h3>{tournament?.tournament_date}</h3>
	<Button action={downloadTournament} title="Download ZIP File" />
	<br />
	<br />
	{#if tests.length == 0}
		<p>This tournament has no tests.</p>
	{:else}
		{#each tests as test, i}
			<div class="miniBox">
				<h5>Test {i + 1}</h5>
				<p><strong>Name:</strong> {test.test_name}</p>
				<p><strong>Description:</strong> {test.test_description}</p>
				<div style="margin: 5px;">
					<Button href={"/admin/tests/" + test.id} title="Edit" />
				</div>
			</div>
		{/each}
	{/if}
	<br /><ModalButton
		runHeader="Archive Tournament"
		onSubmit={async () => {
			await archiveTournament(tournamentId);
		}}
	/>
	<br /><ModalButton
		runHeader="Unarchive Tournament"
		onSubmit={async () => {
			await unarchiveTournament(tournamentId);
		}}
	/>
{/if}
<br />
<br />
