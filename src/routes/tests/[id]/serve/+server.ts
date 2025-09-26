
import { supabase } from '$lib/supabaseClient';
import { json, error } from '@sveltejs/kit';


export async function GET({ params }) {
  const testId = Number(params.id);
  if (!Number.isFinite(testId)) {
    throw error(400, 'Invalid test_id');
  }

  // 1) Fetch the test
  const { data: test, error: testErr } = await supabase
    .from('tests')
    .select('id, test_name, test_description, tournament_id')
    .eq('id', testId)
    .single();

  if (testErr || !test) {
    throw error(404, `Test ${testId} not found`);
  }

  // 2) Fetch test_problems for the test
  const { data: tps, error: tpErr } = await supabase
    .from('test_problems')
    .select('problem_id, problem_number')
    .eq('test_id', testId)
    .order('problem_number', { ascending: true });

  if (tpErr) {
    throw error(500, tpErr.message);
  }

  // 3) Fetch problems referenced by those test_problems
  const problemIds = (tps ?? []).map((tp) => tp.problem_id);
  let problems: any[] = [];
  if (problemIds.length) {
    const { data: probs, error: probsErr } = await supabase
      .from('problems')
      .select('id, problem_latex, answer_latex, solution_latex')
      .in('id', problemIds);

    if (probsErr) {
      throw error(500, probsErr.message);
    }
    problems = probs ?? [];
  }

  // NOTE: COMP importer importer does `problem_number + 1` on import.
  // COMPOSE usually stores problem numbers 1-based, so we export 0-based here.
  // If `test_problems.problem_number` is already 0-based, remove the `- 1` below.
  const test_problems = (tps ?? []).map((tp) => ({
    test_id: test.id,
    problem_id: tp.problem_id,
    problem_number: Math.max(0, (tp.problem_number ?? 1) - 1),
    problem_weights: 0
  }));

  // Minimal test shape the importer expects
  const tests = [
    {
      id: test.id,
      test_name: test.test_name,
      test_description: test.test_description ?? '',
      is_team: false,      
      tournament_id: test.tournament_id,
      bounding_boxes: '{}'
    }
  ];

  //TODO: Maybe make it so it can export and import problem images in the future? May not be possible through
  const problem_images: any[] = [];

  // Final payload
  const payload = {
    tests,
    test_problems,
    problems: problems.map((p) => ({
      id: p.id,
      problem_latex: p.problem_latex ?? '',
      answer_latex: p.answer_latex ?? '',
      solution_latex: p.solution_latex ?? ''
    })),
    problem_images
  };

  return json(payload, {
    headers: {
      // lets the browser download as a file named compose-export-<id>.json
      'Content-Disposition': `attachment; filename="compose-export-${test.id}.json"`
    }
  });
}