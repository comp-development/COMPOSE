

-- Enable the vector extension
create extension if not exists vector;

-- Add embedding column to problems table
alter table problems add column if not exists embedding vector(1536);

-- Create a function to generate embeddings
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
  topics_short text,
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
    1 - (p.embedding <=> query_embedding) as similarity,
    p.problem_latex,
    p.solution_latex,
    p.answer_latex,
    p.difficulty,
    p.sub_topics,
    fp.topics,
    fp.topics_short,
    fp.problem_tests,
    fp.front_id,
    fp.full_name,
    p.created_at,
    p.edited_at,
    p.embedding
  from problems p
  join full_problems fp on fp.id = p.id
  where p.embedding is not null
  order by similarity desc
  limit match_count;
end;
$$;

-- TODO: 
-- Create a Supabase trigger that will automatically update the embedding on update, instead
-- of manually regenerating an updated embedding with editProblem.  
-- Similarly, do this on creation of problmes as well. 


