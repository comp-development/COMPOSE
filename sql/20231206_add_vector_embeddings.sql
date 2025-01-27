-- Check if we have any embeddings
select id, embedding is not null as has_embedding 
from problems 
limit 5;

-- Check a specific embedding if it exists
select id, embedding[1:5] as embedding_sample
from problems
where embedding is not null
limit 1;

-- Enable the vector extension
create extension if not exists vector;
create extension if not exists http;

-- Add embedding column to problems table
alter table problems add column if not exists embedding vector(1536);

-- Create a function to generate embeddings
create or replace function generate_problem_embedding(
  problem_latex text,
  solution_latex text,
  answer_latex text,
  comment_latex text,
  difficulty numeric,
  sub_topics text,
  topics text,
  problem_tests text
) returns vector
language plpgsql
as $$
declare
  combined_text text;
  embedding_vector vector(1536);
  response jsonb;
begin
  combined_text := coalesce(problem_latex, '') || ' ' ||
                   coalesce(solution_latex, '') || ' ' ||
                   coalesce(answer_latex, '') || ' ' ||
                   coalesce(comment_latex, '') || ' ' ||
                   coalesce(difficulty::text, '') || ' ' ||
                   coalesce(sub_topics, '') || ' ' ||
                   coalesce(topics, '') || ' ' ||
                   coalesce(problem_tests, '');
  
  -- Use Supabase's OpenAI integration to generate embeddings
  response := net.http_post(
    url := 'https://api.openai.com/v1/embeddings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'input', combined_text,
      'model', 'text-embedding-ada-002'
    )
  );

  -- Parse the response and extract the embedding vector
  embedding_vector := (
    select vector(array_agg(value::float)::vector(1536))
    from jsonb_array_elements(response->'data'->0->'embedding') as value
  );

  return embedding_vector;
end;
$$;

-- Create a function for semantic search
create or replace function search_problems(
  query_embedding vector(1536),
  match_count int default 10
) returns table (
  id bigint,
  similarity float,
  problem_latex text,
  solution_latex text,
  answer_latex text,
  difficulty int,
  sub_topics text,
  topics text,
  problem_tests text,
  front_id text,
  full_name text,
  created_at timestamptz,
  edited_at timestamptz,
  embedding vector(1536)
)
language plpgsql
as $$
begin

  return query
  select
    p.id,
    1 - (p.embedding <=> query_embedding)::float as similarity,
    p.problem_latex,
    p.solution_latex,
    p.answer_latex,
    p.difficulty,
    p.sub_topics,
    fp.topics,
    fp.problem_tests,
    fp.front_id,
    fp.full_name,
    p.created_at,
    p.edited_at,
    p.embedding
  from problems p
  join full_problems fp on fp.id = p.id
  where p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Generate embeddings for a single test problem
do $$
declare
  test_problem record;
begin
  select * into test_problem from full_problems limit 1;
  
  update problems
  set embedding = generate_problem_embedding(
    test_problem.problem_latex,
    test_problem.solution_latex,
    test_problem.answer_latex,
    test_problem.comment_latex,
    test_problem.difficulty,
    test_problem.sub_topics,
    test_problem.topics,
    test_problem.problem_tests
  )
  where id = test_problem.id;
  
  raise notice 'Updated embedding for problem %', test_problem.id;
end;
$$;

-- Create a function to update problem embeddings
create or replace function update_problem_embedding()
returns trigger
language plpgsql
as $$
begin
  -- Get the full problem data from the view
  with problem_data as (
    select
      p.problem_latex,
      p.solution_latex,
      p.answer_latex,
      p.comment_latex,
      p.difficulty,
      p.sub_topics,
      p.topics,
      p.problem_tests
    from full_problems p
    where p.id = NEW.id
  )
  update problems
  set embedding = generate_problem_embedding(
    pd.problem_latex,
    pd.solution_latex,
    pd.answer_latex,
    pd.comment_latex,
    pd.difficulty,
    pd.sub_topics,
    pd.topics,
    pd.problem_tests
  )
  from problem_data pd
  where problems.id = NEW.id;
  
  return NEW;
end;
$$;

-- Create the trigger
drop trigger if exists problem_embedding_trigger on problems;
create trigger problem_embedding_trigger
  after insert or update on problems
  for each row
  execute function update_problem_embedding();
