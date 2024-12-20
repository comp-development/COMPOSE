

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."grade" AS ENUM (
    'Incorrect',
    'Correct',
    'Unsure'
);


ALTER TYPE "public"."grade" OWNER TO "postgres";


COMMENT ON TYPE "public"."grade" IS 'assigned grade for a particular answer';



CREATE TYPE "public"."problem_status" AS ENUM (
    'Draft',
    'Idea',
    'Endorsed',
    'On Test',
    'Published',
    'Archived'
);


ALTER TYPE "public"."problem_status" OWNER TO "postgres";


CREATE TYPE "public"."testsolve_status" AS ENUM (
    'Not Started',
    'Testsolving',
    'Reviewing',
    'Complete'
);


ALTER TYPE "public"."testsolve_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."testsolve_status" IS 'status of testsolve';



CREATE OR REPLACE FUNCTION "public"."add_test_problem"("p_problem_id" bigint, "p_test_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    cur_max int;
  BEGIN
    SELECT max(test_problems.problem_number)
    INTO cur_max
    FROM test_problems
    WHERE test_problems.test_id = p_test_id;

    -- prevent null if there are no problems
    cur_max = coalesce(cur_max, -1);

    cur_max = cur_max+1;

    INSERT INTO test_problems (problem_id, test_id, problem_number)
    VALUES (p_problem_id, p_test_id, cur_max);
  END
$$;


ALTER FUNCTION "public"."add_test_problem"("p_problem_id" bigint, "p_test_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_problem_counts_snapshot"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  counts_json jsonb;
begin
  -- Build JSON object from the problem_counts view
  counts_json := (
    select jsonb_object_agg(column_name, column_data) 
    from (
      select 
        'total' as column_name, 
        jsonb_object_agg(category, total) as column_data
      from problem_counts

      union all

      select 
        'draft', 
        jsonb_object_agg(category, draft)
      from problem_counts

      union all

      select 
        'idea', 
        jsonb_object_agg(category, idea)
      from problem_counts

      union all

      select 
        'endorsed', 
        jsonb_object_agg(category, endorsed)
      from problem_counts

      union all

      select 
        'published', 
        jsonb_object_agg(category, published)
      from problem_counts
    ) as subquery
  );

  -- Insert the JSON snapshot into the problem_counts_snapshot table
  insert into public.problem_counts_snapshot (counts, created_at)
  values (counts_json, now());

end;
$$;


ALTER FUNCTION "public"."capture_problem_counts_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_test_problem"("p_problem_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    cur_problem_number int;
    cur_test_id bigint;
  BEGIN
    SELECT problem_number, test_id
    INTO cur_problem_number, cur_test_id
    FROM test_problems
    WHERE problem_id = p_problem_id;

    IF found THEN
      UPDATE test_problems
      SET problem_number = problem_number-1
      WHERE test_id = cur_test_id AND problem_number > cur_problem_number;

      DELETE FROM test_problems
      WHERE problem_id = p_problem_id;
    END IF;
  END
$$;


ALTER FUNCTION "public"."delete_test_problem"("p_problem_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_test_problem"("p_problem_id" bigint, "cur_test_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    cur_problem_number int;
  BEGIN
    SELECT problem_number
    INTO cur_problem_number
    FROM test_problems
    WHERE problem_id = p_problem_id AND test_id = cur_test_id;

    IF found THEN
      UPDATE test_problems
      SET problem_number = problem_number-1
      WHERE test_id = cur_test_id AND problem_number > cur_problem_number;

      DELETE FROM test_problems
      WHERE problem_id = p_problem_id AND test_id = cur_test_id;
    END IF;
  END
$$;


ALTER FUNCTION "public"."delete_test_problem"("p_problem_id" bigint, "cur_test_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_problem_counts_snapshot"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  problem_counts jsonb;
begin
  -- Aggregate the data and build the JSONB object
  problem_counts := (
    select jsonb_object_agg(author_id, author_data) as counts
    from (
      select 
        author_id,
        jsonb_object_agg(status, status_data) as author_data
      from (
        select
          topic_counts.author_id,
          topic_counts.status,
          jsonb_object_agg(topic, topic_count) || 
            jsonb_build_object('Total', problem_count) as status_data
        from (
          select
            fp.author_id,
            fp.status,
            unnest(string_to_array(fp.topics, ', ')) as topic,
            count(*) as topic_count
          from
            public.full_problems fp
          group by
            fp.author_id, fp.status, topic
        ) as topic_counts
        join (
          select 
            author_id, 
            status, 
            count(*) as problem_count
          from 
            public.full_problems
          group by 
            author_id, status
        ) as total_counts
        on topic_counts.author_id = total_counts.author_id
        and topic_counts.status = total_counts.status
        group by
          topic_counts.author_id, topic_counts.status, total_counts.problem_count
      ) as status_counts
      group by author_id
    ) as author_counts
  );

  -- Insert the JSONB object into the 'problem_counts_snapshot' table
  insert into public.problem_counts_snapshot (counts, created_at)
  values (problem_counts, now());
end;
$$;


ALTER FUNCTION "public"."generate_problem_counts_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_testsolves_for_authenticated_user"() RETURNS SETOF bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select testsolve_id
  from testsolvers
  where solver_id = auth.uid()
$$;


ALTER FUNCTION "public"."get_testsolves_for_authenticated_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.users (id)
  values (new.id, null, new.email, null);
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    cur_test_id bigint;
    old_problem_number int;
  BEGIN
    SELECT test_id, problem_number
    INTO cur_test_id, old_problem_number
    FROM test_problems
    WHERE problem_id = p_problem_id;

    IF found THEN
      IF p_new_number > old_problem_number THEN
        UPDATE test_problems
        SET problem_number = problem_number-1
        WHERE test_id = cur_test_id AND problem_number > old_problem_number AND problem_number <= p_new_number;
      ELSE
        UPDATE test_problems
        SET problem_number = problem_number+1
        WHERE test_id = cur_test_id AND problem_number >= p_new_number AND problem_number < old_problem_number;
      END IF;
      

      UPDATE test_problems
      SET problem_number = p_new_number
      WHERE problem_id = p_problem_id;
    END IF;
  END
$$;


ALTER FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer, "cur_test_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    old_problem_number int;
  BEGIN
    SELECT problem_number
    INTO old_problem_number
    FROM test_problems
    WHERE problem_id = p_problem_id AND test_id = cur_test_id;

    IF found THEN
      IF p_new_number > old_problem_number THEN
        UPDATE test_problems
        SET problem_number = problem_number-1
        WHERE test_id = cur_test_id AND problem_number > old_problem_number AND problem_number <= p_new_number;
      ELSE
        UPDATE test_problems
        SET problem_number = problem_number+1
        WHERE test_id = cur_test_id AND problem_number >= p_new_number AND problem_number < old_problem_number;
      END IF;
      
      UPDATE test_problems
      SET problem_number = p_new_number
      WHERE problem_id = p_problem_id AND test_id = cur_test_id;
    END IF;
  END
$$;


ALTER FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer, "cur_test_id" bigint) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."grades" (
    "id" bigint NOT NULL,
    "scan_id" bigint,
    "grader_id" "uuid",
    "grade" "public"."grade",
    "test_problem_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_override" boolean DEFAULT false
);


ALTER TABLE "public"."grades" OWNER TO "postgres";


ALTER TABLE "public"."grades" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."answer_grades_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."problems" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "author_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "problem_latex" "text",
    "answer_latex" "text",
    "solution_latex" "text",
    "difficulty" integer,
    "sub_topics" "text",
    "nickname" "text",
    "comment_latex" "text",
    "edited_at" timestamp with time zone,
    "archived" boolean DEFAULT false NOT NULL,
    "discord_id" "text",
    "status" "public"."problem_status" DEFAULT 'Idea'::"public"."problem_status" NOT NULL
);


ALTER TABLE "public"."problems" OWNER TO "postgres";


COMMENT ON COLUMN "public"."problems"."discord_id" IS 'The thread/channel id of the Discord Channel/Thread for this problem';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "initials" "text",
    "math_comp_background" "text" DEFAULT ''::"text" NOT NULL,
    "amc_score" real,
    "email" "text",
    "discord_id" "text",
    "discord_tokens" "jsonb",
    "discord" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."front_ids" WITH ("security_invoker"='false') AS
 SELECT "problems"."id" AS "problem_id",
    ("users"."initials" || "problems"."id") AS "front_id"
   FROM ("public"."problems"
     LEFT JOIN "public"."users" ON (("users"."id" = "problems"."author_id")));


ALTER TABLE "public"."front_ids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_topics" (
    "id" bigint NOT NULL,
    "topic" "text",
    "topic_short" "text"
);


ALTER TABLE "public"."global_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."problem_feedback" (
    "id" bigint NOT NULL,
    "testsolve_id" bigint,
    "problem_id" bigint,
    "answer" "text",
    "feedback" "text",
    "correct" boolean,
    "resolved" boolean DEFAULT false NOT NULL,
    "solver_id" "uuid",
    "quality" bigint,
    "difficulty" bigint,
    "time_elapsed" bigint DEFAULT '0'::bigint
);

ALTER TABLE ONLY "public"."problem_feedback" REPLICA IDENTITY FULL;


ALTER TABLE "public"."problem_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."problem_topics" (
    "id" bigint NOT NULL,
    "problem_id" bigint,
    "topic_id" bigint
);


ALTER TABLE "public"."problem_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_problems" (
    "relation_id" bigint NOT NULL,
    "problem_id" bigint,
    "test_id" bigint NOT NULL,
    "problem_number" integer,
    "problem_weight" double precision
);


ALTER TABLE "public"."test_problems" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tests" (
    "id" bigint NOT NULL,
    "test_name" "text" NOT NULL,
    "test_description" "text",
    "tournament_id" bigint NOT NULL,
    "test_version" "text" DEFAULT '1.0'::"text",
    "archived" boolean DEFAULT false NOT NULL,
    "is_team" boolean DEFAULT false,
    "bounding_boxes" "json"
);


ALTER TABLE "public"."tests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."full_problems" AS
 SELECT "problems"."id",
    "problems"."created_at",
    "problems"."author_id",
    "problems"."problem_latex",
    "problems"."answer_latex",
    "problems"."solution_latex",
    "problems"."difficulty",
    "problems"."sub_topics",
    "problems"."nickname",
    "problems"."comment_latex",
    "problems"."edited_at",
    "problems"."discord_id",
    "users"."full_name",
    ("users"."initials" || "problems"."id") AS "front_id",
    "topics"."topics",
    "topics"."topics_short",
    COALESCE("feedback_counts"."unresolved_count", (0)::bigint) AS "unresolved_count",
    COALESCE("feedback_counts"."feedback_count", (0)::bigint) AS "feedback_count",
    "problem_test_list"."test_names" AS "problem_tests",
    "problems"."archived",
        CASE
            WHEN (("problems"."archived" = true) AND ("problems"."status" <> 'Published'::"public"."problem_status")) THEN 'Archived'::"public"."problem_status"
            WHEN (("problem_test_list"."test_names" IS NOT NULL) AND ("problem_test_list"."test_names" <> ''::"text") AND ("problems"."status" <> 'Published'::"public"."problem_status")) THEN 'On Test'::"public"."problem_status"
            ELSE "problems"."status"
        END AS "status",
    "average_difficulty"."difficulty" AS "average_difficulty",
    "average_quality"."quality" AS "average_quality",
        CASE
            WHEN ("problems"."status" = 'Published'::"public"."problem_status") THEN 'Complete'::"text"
            WHEN (COALESCE("feedback_counts"."unresolved_count", (0)::bigint) > 0) THEN 'Needs Review'::"text"
            WHEN (("problem_test_list"."test_names" IS NOT NULL) AND ("problem_test_list"."test_names" <> ''::"text")) THEN 'Awaiting Testsolve'::"text"
            WHEN (("problems"."status" = 'Idea'::"public"."problem_status") AND (COALESCE("feedback_counts"."feedback_count", (0)::bigint) >= 2)) THEN 'Awaiting Endorsement'::"text"
            WHEN ("problems"."status" <> ALL (ARRAY['Draft'::"public"."problem_status", 'Published'::"public"."problem_status"])) THEN 'Awaiting Feedback'::"text"
            ELSE NULL::"text"
        END AS "feedback_status"
   FROM (((((("public"."problems"
     LEFT JOIN "public"."users" ON (("users"."id" = "problems"."author_id")))
     LEFT JOIN ( SELECT "problem_topics"."problem_id",
            "string_agg"("global_topics"."topic", ', '::"text") AS "topics",
            "string_agg"("global_topics"."topic_short", ', '::"text") AS "topics_short"
           FROM ("public"."problem_topics"
             JOIN "public"."global_topics" ON (("problem_topics"."topic_id" = "global_topics"."id")))
          GROUP BY "problem_topics"."problem_id") "topics" ON (("problems"."id" = "topics"."problem_id")))
     LEFT JOIN ( SELECT "problem_feedback"."problem_id",
            "count"(
                CASE
                    WHEN (("problem_feedback"."feedback" IS NOT NULL) AND ("problem_feedback"."feedback" <> ''::"text")) THEN 1
                    ELSE NULL::integer
                END) AS "feedback_count",
            "count"(
                CASE
                    WHEN (("problem_feedback"."resolved" IS FALSE) AND ("problem_feedback"."feedback" IS NOT NULL) AND ("problem_feedback"."feedback" <> ''::"text")) THEN 1
                    ELSE NULL::integer
                END) AS "unresolved_count"
           FROM "public"."problem_feedback"
          GROUP BY "problem_feedback"."problem_id") "feedback_counts" ON (("problems"."id" = "feedback_counts"."problem_id")))
     LEFT JOIN ( SELECT "problem_feedback"."problem_id",
            "avg"("problem_feedback"."difficulty") AS "difficulty"
           FROM "public"."problem_feedback"
          GROUP BY "problem_feedback"."problem_id") "average_difficulty" ON (("problems"."id" = "average_difficulty"."problem_id")))
     LEFT JOIN ( SELECT "problem_feedback"."problem_id",
            "avg"("problem_feedback"."quality") AS "quality"
           FROM "public"."problem_feedback"
          GROUP BY "problem_feedback"."problem_id") "average_quality" ON (("problems"."id" = "average_quality"."problem_id")))
     LEFT JOIN ( SELECT "test_problems"."problem_id",
            "string_agg"("tests"."test_name", ', '::"text") AS "test_names"
           FROM ("public"."test_problems"
             JOIN "public"."tests" ON (("test_problems"."test_id" = "tests"."id")))
          GROUP BY "test_problems"."problem_id") "problem_test_list" ON (("problems"."id" = "problem_test_list"."problem_id")));


ALTER TABLE "public"."full_problems" OWNER TO "postgres";


ALTER TABLE "public"."global_topics" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."global_topics_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."grade_tracking" AS
SELECT
    NULL::bigint AS "scan_id",
    NULL::bigint AS "test_id",
    NULL::bigint AS "test_problem_id",
    NULL::bigint AS "claimed_count",
    NULL::bigint AS "graded_count",
    NULL::boolean AS "has_conflict",
    NULL::boolean AS "needs_resolution",
    NULL::boolean AS "grade_finalized",
    NULL::boolean AS "correct";


ALTER TABLE "public"."grade_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guts" (
    "team_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "round_num" bigint,
    "corrects" boolean[],
    "answers" "text"[],
    "id" bigint NOT NULL,
    "incorrects" boolean[]
);


ALTER TABLE "public"."guts" OWNER TO "postgres";


ALTER TABLE "public"."guts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."guts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."guts" ALTER COLUMN "team_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."guts_team_num_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" bigint NOT NULL,
    "cd_org_id" "text" NOT NULL,
    "name" "text",
    "contact_first_name" "text",
    "contact_last_name" "text",
    "contact_email" "text"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


ALTER TABLE "public"."organizations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."organizations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."problem_counts_snapshot" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "counts" "jsonb"
);


ALTER TABLE "public"."problem_counts_snapshot" OWNER TO "postgres";


ALTER TABLE "public"."problem_counts_snapshot" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."problem_count_snapshot_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."problem_counts" AS
 SELECT
        CASE
            WHEN (("global_topics"."topic" IS NULL) AND (GROUPING("global_topics"."topic") = 0)) THEN 'None'::"text"
            WHEN (GROUPING("global_topics"."topic") = 1) THEN 'Total'::"text"
            ELSE "global_topics"."topic"
        END AS "category",
    "count"(*) AS "total",
    "sum"(
        CASE
            WHEN ("problems"."status" = 'Draft'::"public"."problem_status") THEN 1
            ELSE 0
        END) AS "draft",
    "sum"(
        CASE
            WHEN ("problems"."status" = 'Idea'::"public"."problem_status") THEN 1
            ELSE 0
        END) AS "idea",
    "sum"(
        CASE
            WHEN ("problems"."status" = 'Endorsed'::"public"."problem_status") THEN 1
            ELSE 0
        END) AS "endorsed",
    "sum"(
        CASE
            WHEN ("problems"."status" = 'Published'::"public"."problem_status") THEN 1
            ELSE 0
        END) AS "published"
   FROM (("public"."problems"
     LEFT JOIN "public"."problem_topics" ON (("problems"."id" = "problem_topics"."problem_id")))
     LEFT JOIN "public"."global_topics" ON (("global_topics"."id" = "problem_topics"."topic_id")))
  WHERE ("problems"."archived" = false)
  GROUP BY ROLLUP("global_topics"."topic");


ALTER TABLE "public"."problem_counts" OWNER TO "postgres";


ALTER TABLE "public"."problem_topics" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."problem_topics_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."problems" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."problems_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."scans" (
    "id" bigint NOT NULL,
    "test_id" bigint,
    "taker_id" "text",
    "scan_path" "text",
    "page_number" smallint
);


ALTER TABLE "public"."scans" OWNER TO "postgres";


ALTER TABLE "public"."scans" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."scans_scan_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" bigint NOT NULL,
    "settings" "jsonb" NOT NULL
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


ALTER TABLE "public"."settings" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."settings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" bigint NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "cd_student_id" "text" NOT NULL
);


ALTER TABLE "public"."students" OWNER TO "postgres";


ALTER TABLE "public"."students" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."students_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."taker_responses" (
    "id" bigint NOT NULL,
    "scan_id" bigint,
    "problem_index" integer
);


ALTER TABLE "public"."taker_responses" OWNER TO "postgres";


ALTER TABLE "public"."taker_responses" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."taker_answers_taker_answer_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."team_students" (
    "team_id" bigint NOT NULL,
    "student_id" bigint NOT NULL,
    "student_num" "text"
);


ALTER TABLE "public"."team_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" bigint NOT NULL,
    "cd_team_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "tournament_id" bigint NOT NULL,
    "number" "text"
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


ALTER TABLE "public"."teams" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."teams_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."test_coordinators" (
    "relation_id" bigint NOT NULL,
    "coordinator_id" "uuid",
    "test_id" bigint
);


ALTER TABLE "public"."test_coordinators" OWNER TO "postgres";


ALTER TABLE "public"."test_coordinators" ALTER COLUMN "relation_id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."test_coordinators_relation_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."test_feedback_questions" (
    "id" bigint NOT NULL,
    "test_id" bigint NOT NULL,
    "question" "text"
);


ALTER TABLE "public"."test_feedback_questions" OWNER TO "postgres";


ALTER TABLE "public"."test_feedback_questions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."test_feedback_questions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."test_problem_grader_tracking" AS
SELECT
    NULL::bigint AS "test_problem_id",
    NULL::bigint AS "test_id",
    NULL::bigint AS "num_graders";


ALTER TABLE "public"."test_problem_grader_tracking" OWNER TO "postgres";


ALTER TABLE "public"."test_problems" ALTER COLUMN "relation_id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."test_problems_relation_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."test_tracking" AS
 SELECT "gt"."test_id",
    "count"(
        CASE
            WHEN ("gt"."graded_count" < 2) THEN 1
            ELSE NULL::integer
        END) AS "available_responses",
    "count"(*) AS "total_responses",
    "count"("s"."id") AS "scan_count"
   FROM ("public"."grade_tracking" "gt"
     LEFT JOIN "public"."scans" "s" ON (("gt"."test_id" = "s"."test_id")))
  GROUP BY "gt"."test_id";


ALTER TABLE "public"."test_tracking" OWNER TO "postgres";


ALTER TABLE "public"."tests" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tests_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."problem_feedback" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."testsolve_answers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."testsolve_feedback_answers" (
    "id" bigint NOT NULL,
    "testsolve_id" bigint NOT NULL,
    "feedback_question" bigint NOT NULL,
    "answer" "text"
);


ALTER TABLE "public"."testsolve_feedback_answers" OWNER TO "postgres";


ALTER TABLE "public"."testsolve_feedback_answers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."testsolve_feedback_answers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."testsolvers" (
    "id" bigint NOT NULL,
    "testsolve_id" bigint,
    "solver_id" "uuid"
);


ALTER TABLE "public"."testsolvers" OWNER TO "postgres";


ALTER TABLE "public"."testsolvers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."testsolvers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."testsolves" (
    "id" bigint NOT NULL,
    "test_id" bigint NOT NULL,
    "start_time" timestamp with time zone,
    "time_elapsed" bigint,
    "test_version" "text",
    "status" "public"."testsolve_status" DEFAULT 'Not Started'::"public"."testsolve_status"
);


ALTER TABLE "public"."testsolves" OWNER TO "postgres";


ALTER TABLE "public"."testsolves" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."testsolves_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tournament_students" (
    "tournament_id" bigint NOT NULL,
    "student_id" bigint NOT NULL,
    "org_id" bigint NOT NULL
);


ALTER TABLE "public"."tournament_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_tests" (
    "tournament_id" bigint NOT NULL,
    "test_id" bigint NOT NULL
);


ALTER TABLE "public"."tournament_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" bigint NOT NULL,
    "tournament_name" "text" NOT NULL,
    "tournament_date" "date",
    "archived" boolean DEFAULT false NOT NULL,
    "cd_tournament_id" "text"
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


ALTER TABLE "public"."tournaments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tournaments_id_seq1"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tournaments_orgs" (
    "tournament_id" bigint NOT NULL,
    "org_id" bigint NOT NULL,
    "join_code" "text"
);


ALTER TABLE "public"."tournaments_orgs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" integer
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_stats" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "discord_id",
    NULL::"text" AS "name",
    NULL::bigint AS "problem_count",
    NULL::numeric AS "unresolved_count";


ALTER TABLE "public"."user_stats" OWNER TO "postgres";


ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "answer_grades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_topics"
    ADD CONSTRAINT "global_topics_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guts"
    ADD CONSTRAINT "guts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guts"
    ADD CONSTRAINT "guts_team_id_round_num_unique" UNIQUE ("team_id", "round_num");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_cd_org_id_key" UNIQUE ("cd_org_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."problem_counts_snapshot"
    ADD CONSTRAINT "problem_count_snapshot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."problem_topics"
    ADD CONSTRAINT "problem_topics_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."problems"
    ADD CONSTRAINT "problems_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scans"
    ADD CONSTRAINT "scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_cd_student_id_key" UNIQUE ("cd_student_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taker_responses"
    ADD CONSTRAINT "taker_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_students"
    ADD CONSTRAINT "team_students_pkey" PRIMARY KEY ("team_id", "student_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_cd_team_id_key" UNIQUE ("cd_team_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_coordinators"
    ADD CONSTRAINT "test_coordinators_pkey1" PRIMARY KEY ("relation_id");



ALTER TABLE ONLY "public"."test_feedback_questions"
    ADD CONSTRAINT "test_feedback_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_problems"
    ADD CONSTRAINT "test_problems_pkey1" PRIMARY KEY ("relation_id");



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."problem_feedback"
    ADD CONSTRAINT "testsolve_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testsolve_feedback_answers"
    ADD CONSTRAINT "testsolve_feedback_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testsolvers"
    ADD CONSTRAINT "testsolvers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testsolves"
    ADD CONSTRAINT "testsolves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_students"
    ADD CONSTRAINT "tournament_students_pkey" PRIMARY KEY ("tournament_id", "student_id");



ALTER TABLE ONLY "public"."tournament_tests"
    ADD CONSTRAINT "tournament_tests_pkey" PRIMARY KEY ("tournament_id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_cd_tournament_id_key" UNIQUE ("cd_tournament_id");



ALTER TABLE ONLY "public"."tournaments_orgs"
    ADD CONSTRAINT "tournaments_orgs_pkey" PRIMARY KEY ("tournament_id", "org_id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testsolve_feedback_answers"
    ADD CONSTRAINT "unique_feedback_answer" UNIQUE ("testsolve_id", "feedback_question");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "unique_grader_scan_test_problem" UNIQUE ("grader_id", "scan_id", "test_problem_id");



ALTER TABLE ONLY "public"."scans"
    ADD CONSTRAINT "unique_scans" UNIQUE ("test_id", "taker_id", "page_number");



ALTER TABLE ONLY "public"."problem_feedback"
    ADD CONSTRAINT "unique_testsolve_problem" UNIQUE ("testsolve_id", "problem_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey1" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_discord_id_key" UNIQUE ("discord_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_discord_key" UNIQUE ("discord");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE VIEW "public"."grade_tracking" AS
 SELECT "s"."id" AS "scan_id",
    "s"."test_id",
    "tp"."relation_id" AS "test_problem_id",
    "count"("g"."id") AS "claimed_count",
    "count"("g"."grade") AS "graded_count",
        CASE
            WHEN (("count"(DISTINCT "g"."grade") > 1) AND ("max"(("g"."is_override")::integer) = 0)) THEN true
            ELSE false
        END AS "has_conflict",
        CASE
            WHEN (("max"(("g"."is_override")::integer) = 0) AND ((("count"(DISTINCT "g"."grade") = 1) AND ("count"("g"."grade") > 1) AND ("min"("g"."grade") = 'Unsure'::"public"."grade")) OR ("count"(DISTINCT "g"."grade") > 1))) THEN true
            ELSE false
        END AS "needs_resolution",
        CASE
            WHEN ((NOT (("max"(("g"."is_override")::integer) = 0) AND ((("count"(DISTINCT "g"."grade") = 1) AND ("count"("g"."grade") > 1) AND ("min"("g"."grade") = 'Unsure'::"public"."grade")) OR ("count"(DISTINCT "g"."grade") > 1)))) AND (("count"("g"."grade") >= 2) OR "bool_or"("g"."is_override"))) THEN true
            ELSE false
        END AS "grade_finalized",
        CASE
            WHEN "bool_and"(("g"."grade" = 'Correct'::"public"."grade")) THEN true
            WHEN "bool_or"((("g"."grade" = 'Correct'::"public"."grade") AND ("g"."is_override" = true))) THEN true
            ELSE false
        END AS "correct"
   FROM (("public"."scans" "s"
     JOIN "public"."test_problems" "tp" ON (("s"."test_id" = "tp"."test_id")))
     LEFT JOIN "public"."grades" "g" ON ((("g"."scan_id" = "s"."id") AND ("g"."test_problem_id" = "tp"."relation_id"))))
  GROUP BY "s"."id", "tp"."relation_id"
  ORDER BY "tp"."relation_id";



CREATE OR REPLACE VIEW "public"."test_problem_grader_tracking" AS
 SELECT "tp"."relation_id" AS "test_problem_id",
    "tp"."test_id",
    COALESCE("count"(DISTINCT "g"."grader_id"), (0)::bigint) AS "num_graders"
   FROM (("public"."test_problems" "tp"
     LEFT JOIN "public"."scans" "s" ON (("tp"."test_id" = "s"."test_id")))
     LEFT JOIN "public"."grades" "g" ON ((("s"."id" = "g"."scan_id") AND ("tp"."relation_id" = "g"."test_problem_id"))))
  GROUP BY "tp"."relation_id";



CREATE OR REPLACE VIEW "public"."user_stats" AS
 SELECT "users"."id",
    "users"."discord_id",
    "users"."full_name" AS "name",
    "count"(*) AS "problem_count",
    "sum"("full_problems"."unresolved_count") AS "unresolved_count"
   FROM ("public"."full_problems"
     LEFT JOIN "public"."users" ON (("users"."id" = "full_problems"."author_id")))
  GROUP BY "users"."id";



ALTER TABLE ONLY "public"."problem_feedback"
    ADD CONSTRAINT "problem_feedback_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."problem_feedback"
    ADD CONSTRAINT "problem_feedback_solver_id_fkey" FOREIGN KEY ("solver_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."problem_feedback"
    ADD CONSTRAINT "problem_feedback_testsolve_id_fkey" FOREIGN KEY ("testsolve_id") REFERENCES "public"."testsolves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."problem_topics"
    ADD CONSTRAINT "problem_topics_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."problem_topics"
    ADD CONSTRAINT "problem_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."global_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."problems"
    ADD CONSTRAINT "problems_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "public_grades_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "public_grades_test_problem_id_fkey" FOREIGN KEY ("test_problem_id") REFERENCES "public"."test_problems"("relation_id");



ALTER TABLE ONLY "public"."guts"
    ADD CONSTRAINT "public_guts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "public_response_grades_grader_id_fkey" FOREIGN KEY ("grader_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."scans"
    ADD CONSTRAINT "public_scans_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id");



ALTER TABLE ONLY "public"."taker_responses"
    ADD CONSTRAINT "public_taker_answers_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id");



ALTER TABLE ONLY "public"."team_students"
    ADD CONSTRAINT "team_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_students"
    ADD CONSTRAINT "team_students_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_coordinators"
    ADD CONSTRAINT "test_coordinators_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_coordinators"
    ADD CONSTRAINT "test_coordinators_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_feedback_questions"
    ADD CONSTRAINT "test_feedback_questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_problems"
    ADD CONSTRAINT "test_problems_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_problems"
    ADD CONSTRAINT "test_problems_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testsolve_feedback_answers"
    ADD CONSTRAINT "testsolve_feedback_answers_feedback_question_fkey" FOREIGN KEY ("feedback_question") REFERENCES "public"."test_feedback_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testsolve_feedback_answers"
    ADD CONSTRAINT "testsolve_feedback_answers_testsolve_id_fkey" FOREIGN KEY ("testsolve_id") REFERENCES "public"."testsolves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testsolvers"
    ADD CONSTRAINT "testsolvers_solver_id_fkey" FOREIGN KEY ("solver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testsolvers"
    ADD CONSTRAINT "testsolvers_testsolve_id_fkey" FOREIGN KEY ("testsolve_id") REFERENCES "public"."testsolves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testsolves"
    ADD CONSTRAINT "testsolves_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_students"
    ADD CONSTRAINT "tournament_students_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_students"
    ADD CONSTRAINT "tournament_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_students"
    ADD CONSTRAINT "tournament_students_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_tests"
    ADD CONSTRAINT "tournament_tests_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_tests"
    ADD CONSTRAINT "tournament_tests_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments_orgs"
    ADD CONSTRAINT "tournaments_orgs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments_orgs"
    ADD CONSTRAINT "tournaments_orgs_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can add new user roles" ON "public"."user_roles" FOR INSERT WITH CHECK ((( SELECT "user_roles_1"."role"
   FROM "public"."user_roles" "user_roles_1"
  WHERE ("user_roles_1"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can delete user roles" ON "public"."user_roles" FOR DELETE USING ((( SELECT "user_roles_1"."role"
   FROM "public"."user_roles" "user_roles_1"
  WHERE ("user_roles_1"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."global_topics" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."problems" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."test_coordinators" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."test_feedback_questions" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."test_problems" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."tests" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."testsolve_feedback_answers" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."tournaments" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything" ON "public"."users" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything." ON "public"."problem_feedback" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can do anything." ON "public"."testsolves" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 40));



CREATE POLICY "Admins can update user roles that aren't their own" ON "public"."user_roles" FOR UPDATE USING (((( SELECT "user_roles_1"."role"
   FROM "public"."user_roles" "user_roles_1"
  WHERE ("user_roles_1"."user_id" = "auth"."uid"())) >= 40) AND ("auth"."uid"() <> "user_id"))) WITH CHECK (((( SELECT "user_roles_1"."role"
   FROM "public"."user_roles" "user_roles_1"
  WHERE ("user_roles_1"."user_id" = "auth"."uid"())) >= 40) AND ("auth"."uid"() <> "user_id")));



CREATE POLICY "Allow testsolvers to edit their testsolves" ON "public"."testsolves" USING (("id" IN ( SELECT "testsolvers"."testsolve_id"
   FROM "public"."testsolvers"
  WHERE ("testsolvers"."solver_id" = "auth"."uid"())))) WITH CHECK (("id" IN ( SELECT "testsolvers"."testsolve_id"
   FROM "public"."testsolvers"
  WHERE ("testsolvers"."solver_id" = "auth"."uid"()))));



CREATE POLICY "Enable read access for all" ON "public"."user_roles" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."test_feedback_questions" FOR SELECT USING (true);



CREATE POLICY "Only Problem Contributors and higher can see" ON "public"."global_topics" FOR SELECT USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 20));



CREATE POLICY "PW can do anything" ON "public"."testsolvers" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "PW can read" ON "public"."testsolve_feedback_answers" FOR SELECT USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Contributors can do anything with their own problems" ON "public"."problems" USING ((("auth"."uid"() = "author_id") AND (( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 20))) WITH CHECK ((("auth"."uid"() = "author_id") AND (( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 20)));



CREATE POLICY "Problem Contributors can see and edit their own problem topics" ON "public"."problem_topics" USING ((("auth"."uid"() = ( SELECT "problems"."author_id"
   FROM "public"."problems"
  WHERE ("problems"."id" = "problem_topics"."problem_id"))) AND (( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 20))) WITH CHECK ((("auth"."uid"() = ( SELECT "problems"."author_id"
   FROM "public"."problems"
  WHERE ("problems"."id" = "problem_topics"."problem_id"))) AND (( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 20)));



CREATE POLICY "Problem Writers and higher can do anything" ON "public"."problem_topics" USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Writers can add feedback" ON "public"."problem_feedback" FOR INSERT WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Writers can insert anything" ON "public"."problems" FOR INSERT WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Writers can see Test Coordinators" ON "public"."test_coordinators" FOR SELECT USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Writers can see all test problems" ON "public"."test_problems" FOR SELECT USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Writers can see all tests" ON "public"."tests" FOR SELECT USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Writers can select anything" ON "public"."problems" FOR SELECT USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Writers can update anything" ON "public"."problems" FOR UPDATE USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem Writers can view tournaments" ON "public"."tournaments" FOR SELECT USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem contributors can see feedback on their own problems." ON "public"."problem_feedback" FOR SELECT USING ((( SELECT "problems"."author_id"
   FROM "public"."problems"
  WHERE ("problems"."id" = "problem_feedback"."problem_id")) = "auth"."uid"()));



CREATE POLICY "Problem contributors can update answers (so they can resolve)" ON "public"."problem_feedback" FOR UPDATE USING ((( SELECT "problems"."author_id"
   FROM "public"."problems"
  WHERE ("problems"."id" = "problem_feedback"."problem_id")) = "auth"."uid"())) WITH CHECK ((( SELECT "problems"."author_id"
   FROM "public"."problems"
  WHERE ("problems"."id" = "problem_feedback"."problem_id")) = "auth"."uid"()));



CREATE POLICY "Problem writers can see all feedback." ON "public"."problem_feedback" FOR SELECT USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Problem writers can update answers (so they can resolve)" ON "public"."problem_feedback" FOR UPDATE USING ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30)) WITH CHECK ((( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())) >= 30));



CREATE POLICY "Read access for all" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Test Coordinators can do anything for their tests" ON "public"."testsolves" USING ((EXISTS ( SELECT "test_coordinators"."relation_id",
    "test_coordinators"."coordinator_id",
    "test_coordinators"."test_id"
   FROM "public"."test_coordinators"
  WHERE (("test_coordinators"."coordinator_id" = "auth"."uid"()) AND ("test_coordinators"."test_id" = "testsolves"."test_id"))))) WITH CHECK ((EXISTS ( SELECT "test_coordinators"."relation_id",
    "test_coordinators"."coordinator_id",
    "test_coordinators"."test_id"
   FROM "public"."test_coordinators"
  WHERE (("test_coordinators"."coordinator_id" = "auth"."uid"()) AND ("test_coordinators"."test_id" = "testsolves"."test_id")))));



CREATE POLICY "Test Coordinators can do anything to their own tests" ON "public"."tests" USING ((EXISTS ( SELECT 1
   FROM "public"."test_coordinators"
  WHERE (("test_coordinators"."coordinator_id" = "auth"."uid"()) AND ("test_coordinators"."test_id" = "tests"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_coordinators"
  WHERE (("test_coordinators"."coordinator_id" = "auth"."uid"()) AND ("test_coordinators"."test_id" = "tests"."id")))));



CREATE POLICY "Test Coordinators can do anything with their own test" ON "public"."test_feedback_questions" USING ((EXISTS ( SELECT 1
   FROM "public"."test_coordinators"
  WHERE (("test_coordinators"."coordinator_id" = "auth"."uid"()) AND ("test_coordinators"."test_id" = "test_feedback_questions"."test_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_coordinators"
  WHERE (("test_coordinators"."coordinator_id" = "auth"."uid"()) AND ("test_coordinators"."test_id" = "test_feedback_questions"."test_id")))));



CREATE POLICY "Test Coordinators can do anything with their own tests" ON "public"."test_problems" USING ((EXISTS ( SELECT 1
   FROM "public"."test_coordinators"
  WHERE (("test_coordinators"."coordinator_id" = "auth"."uid"()) AND ("test_coordinators"."test_id" = "test_problems"."test_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_coordinators"
  WHERE (("test_coordinators"."coordinator_id" = "auth"."uid"()) AND ("test_coordinators"."test_id" = "test_problems"."test_id")))));



CREATE POLICY "Test coordinators can see feedback on their test." ON "public"."problem_feedback" FOR SELECT USING ((EXISTS ( SELECT "test_coordinators"."relation_id",
    "test_coordinators"."coordinator_id",
    "test_coordinators"."test_id"
   FROM "public"."test_coordinators"
  WHERE ("test_coordinators"."test_id" = ( SELECT "testsolves"."test_id"
           FROM "public"."testsolves"
          WHERE ("testsolves"."id" = "problem_feedback"."testsolve_id"))))));



CREATE POLICY "Test coordinators can update answers (so they can resolve)" ON "public"."problem_feedback" FOR UPDATE USING ((EXISTS ( SELECT "test_coordinators"."relation_id",
    "test_coordinators"."coordinator_id",
    "test_coordinators"."test_id"
   FROM "public"."test_coordinators"
  WHERE ("test_coordinators"."test_id" = ( SELECT "testsolves"."test_id"
           FROM "public"."testsolves"
          WHERE ("testsolves"."id" = "problem_feedback"."testsolve_id")))))) WITH CHECK ((EXISTS ( SELECT "test_coordinators"."relation_id",
    "test_coordinators"."coordinator_id",
    "test_coordinators"."test_id"
   FROM "public"."test_coordinators"
  WHERE ("test_coordinators"."test_id" = ( SELECT "testsolves"."test_id"
           FROM "public"."testsolves"
          WHERE ("testsolves"."id" = "problem_feedback"."testsolve_id"))))));



CREATE POLICY "Testsolvers can access problems on assigned tests" ON "public"."problems" FOR SELECT USING (("id" IN ( SELECT "test_problems"."problem_id"
   FROM "public"."test_problems"
  WHERE ("test_problems"."test_id" IN ( SELECT "testsolves"."test_id"
           FROM ("public"."testsolves"
             JOIN "public"."testsolvers" ON (("testsolves"."id" = "testsolvers"."testsolve_id")))
          WHERE ("testsolvers"."solver_id" = "auth"."uid"()))))));



CREATE POLICY "Testsolvers can do anything for assigned testsolves" ON "public"."problem_feedback" USING (("testsolve_id" IN ( SELECT "testsolves"."id"
   FROM ("public"."testsolvers"
     JOIN "public"."testsolves" ON (("testsolvers"."testsolve_id" = "testsolves"."id")))
  WHERE ("testsolvers"."solver_id" = "auth"."uid"())))) WITH CHECK (("testsolve_id" IN ( SELECT "testsolves"."id"
   FROM ("public"."testsolvers"
     JOIN "public"."testsolves" ON (("testsolvers"."testsolve_id" = "testsolves"."id")))
  WHERE ("testsolvers"."solver_id" = "auth"."uid"()))));



CREATE POLICY "Testsolvers can do anything with their own testsolves" ON "public"."testsolve_feedback_answers" USING ((EXISTS ( SELECT 1
   FROM ("public"."testsolves"
     JOIN "public"."testsolvers" ON (("testsolvers"."testsolve_id" = "testsolves"."id")))
  WHERE (("testsolves"."id" = "testsolve_feedback_answers"."testsolve_id") AND ("testsolvers"."solver_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."testsolves"
     JOIN "public"."testsolvers" ON (("testsolvers"."testsolve_id" = "testsolves"."id")))
  WHERE (("testsolves"."id" = "testsolve_feedback_answers"."testsolve_id") AND ("testsolvers"."solver_id" = "auth"."uid"())))));



CREATE POLICY "Testsolvers can see tests they are assigned to" ON "public"."tests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."testsolvers"
     JOIN "public"."testsolves" ON (("testsolvers"."testsolve_id" = "testsolves"."id")))
  WHERE (("testsolvers"."solver_id" = "auth"."uid"()) AND ("testsolves"."test_id" = "tests"."id")))));



CREATE POLICY "Testsolvers can view anyone assigned to their testsolves" ON "public"."testsolvers" FOR SELECT USING (("testsolve_id" IN ( SELECT "public"."get_testsolves_for_authenticated_user"() AS "get_testsolves_for_authenticated_user")));



CREATE POLICY "Testsolvers can view assigned test problems" ON "public"."test_problems" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."testsolvers"
     JOIN "public"."testsolves" ON (("testsolvers"."testsolve_id" = "testsolves"."id")))
  WHERE (("testsolves"."test_id" = "test_problems"."test_id") AND ("testsolvers"."solver_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own profiles" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profiles" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."global_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."problem_counts_snapshot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."problem_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."problem_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."problems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_coordinators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_feedback_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_problems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testsolve_feedback_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testsolvers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testsolves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."problem_feedback";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."testsolve_feedback_answers";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





















































































































































































































GRANT ALL ON FUNCTION "public"."add_test_problem"("p_problem_id" bigint, "p_test_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."add_test_problem"("p_problem_id" bigint, "p_test_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_test_problem"("p_problem_id" bigint, "p_test_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_problem_counts_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_problem_counts_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_problem_counts_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_test_problem"("p_problem_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_test_problem"("p_problem_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_test_problem"("p_problem_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_test_problem"("p_problem_id" bigint, "cur_test_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_test_problem"("p_problem_id" bigint, "cur_test_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_test_problem"("p_problem_id" bigint, "cur_test_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_problem_counts_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_problem_counts_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_problem_counts_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_testsolves_for_authenticated_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_testsolves_for_authenticated_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_testsolves_for_authenticated_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer, "cur_test_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer, "cur_test_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_test_problem"("p_problem_id" bigint, "p_new_number" integer, "cur_test_id" bigint) TO "service_role";



























GRANT ALL ON TABLE "public"."grades" TO "anon";
GRANT ALL ON TABLE "public"."grades" TO "authenticated";
GRANT ALL ON TABLE "public"."grades" TO "service_role";



GRANT ALL ON SEQUENCE "public"."answer_grades_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."answer_grades_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."answer_grades_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."problems" TO "anon";
GRANT ALL ON TABLE "public"."problems" TO "authenticated";
GRANT ALL ON TABLE "public"."problems" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."front_ids" TO "anon";
GRANT ALL ON TABLE "public"."front_ids" TO "authenticated";
GRANT ALL ON TABLE "public"."front_ids" TO "service_role";



GRANT ALL ON TABLE "public"."global_topics" TO "anon";
GRANT ALL ON TABLE "public"."global_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."global_topics" TO "service_role";



GRANT ALL ON TABLE "public"."problem_feedback" TO "anon";
GRANT ALL ON TABLE "public"."problem_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."problem_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."problem_topics" TO "anon";
GRANT ALL ON TABLE "public"."problem_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."problem_topics" TO "service_role";



GRANT ALL ON TABLE "public"."test_problems" TO "anon";
GRANT ALL ON TABLE "public"."test_problems" TO "authenticated";
GRANT ALL ON TABLE "public"."test_problems" TO "service_role";



GRANT ALL ON TABLE "public"."tests" TO "anon";
GRANT ALL ON TABLE "public"."tests" TO "authenticated";
GRANT ALL ON TABLE "public"."tests" TO "service_role";



GRANT ALL ON TABLE "public"."full_problems" TO "anon";
GRANT ALL ON TABLE "public"."full_problems" TO "authenticated";
GRANT ALL ON TABLE "public"."full_problems" TO "service_role";



GRANT ALL ON SEQUENCE "public"."global_topics_id_seq1" TO "anon";
GRANT ALL ON SEQUENCE "public"."global_topics_id_seq1" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."global_topics_id_seq1" TO "service_role";



GRANT ALL ON TABLE "public"."grade_tracking" TO "anon";
GRANT ALL ON TABLE "public"."grade_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."grade_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."guts" TO "anon";
GRANT ALL ON TABLE "public"."guts" TO "authenticated";
GRANT ALL ON TABLE "public"."guts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."guts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."guts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."guts_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."guts_team_num_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."guts_team_num_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."guts_team_num_seq" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."organizations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."organizations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."organizations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."problem_counts_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."problem_counts_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."problem_counts_snapshot" TO "service_role";



GRANT ALL ON SEQUENCE "public"."problem_count_snapshot_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."problem_count_snapshot_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."problem_count_snapshot_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."problem_counts" TO "anon";
GRANT ALL ON TABLE "public"."problem_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."problem_counts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."problem_topics_id_seq1" TO "anon";
GRANT ALL ON SEQUENCE "public"."problem_topics_id_seq1" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."problem_topics_id_seq1" TO "service_role";



GRANT ALL ON SEQUENCE "public"."problems_id_seq1" TO "anon";
GRANT ALL ON SEQUENCE "public"."problems_id_seq1" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."problems_id_seq1" TO "service_role";



GRANT ALL ON TABLE "public"."scans" TO "anon";
GRANT ALL ON TABLE "public"."scans" TO "authenticated";
GRANT ALL ON TABLE "public"."scans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."scans_scan_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."scans_scan_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."scans_scan_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."settings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."settings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON SEQUENCE "public"."students_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."students_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."students_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."taker_responses" TO "anon";
GRANT ALL ON TABLE "public"."taker_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."taker_responses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."taker_answers_taker_answer_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."taker_answers_taker_answer_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."taker_answers_taker_answer_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."team_students" TO "anon";
GRANT ALL ON TABLE "public"."team_students" TO "authenticated";
GRANT ALL ON TABLE "public"."team_students" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."test_coordinators" TO "anon";
GRANT ALL ON TABLE "public"."test_coordinators" TO "authenticated";
GRANT ALL ON TABLE "public"."test_coordinators" TO "service_role";



GRANT ALL ON SEQUENCE "public"."test_coordinators_relation_id_seq1" TO "anon";
GRANT ALL ON SEQUENCE "public"."test_coordinators_relation_id_seq1" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."test_coordinators_relation_id_seq1" TO "service_role";



GRANT ALL ON TABLE "public"."test_feedback_questions" TO "anon";
GRANT ALL ON TABLE "public"."test_feedback_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."test_feedback_questions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."test_feedback_questions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."test_feedback_questions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."test_feedback_questions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."test_problem_grader_tracking" TO "anon";
GRANT ALL ON TABLE "public"."test_problem_grader_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."test_problem_grader_tracking" TO "service_role";



GRANT ALL ON SEQUENCE "public"."test_problems_relation_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."test_problems_relation_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."test_problems_relation_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."test_tracking" TO "anon";
GRANT ALL ON TABLE "public"."test_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."test_tracking" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tests_id_seq1" TO "anon";
GRANT ALL ON SEQUENCE "public"."tests_id_seq1" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tests_id_seq1" TO "service_role";



GRANT ALL ON SEQUENCE "public"."testsolve_answers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."testsolve_answers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."testsolve_answers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."testsolve_feedback_answers" TO "anon";
GRANT ALL ON TABLE "public"."testsolve_feedback_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."testsolve_feedback_answers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."testsolve_feedback_answers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."testsolve_feedback_answers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."testsolve_feedback_answers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."testsolvers" TO "anon";
GRANT ALL ON TABLE "public"."testsolvers" TO "authenticated";
GRANT ALL ON TABLE "public"."testsolvers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."testsolvers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."testsolvers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."testsolvers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."testsolves" TO "anon";
GRANT ALL ON TABLE "public"."testsolves" TO "authenticated";
GRANT ALL ON TABLE "public"."testsolves" TO "service_role";



GRANT ALL ON SEQUENCE "public"."testsolves_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."testsolves_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."testsolves_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_students" TO "anon";
GRANT ALL ON TABLE "public"."tournament_students" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_students" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_tests" TO "anon";
GRANT ALL ON TABLE "public"."tournament_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_tests" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournaments_id_seq1" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournaments_id_seq1" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournaments_id_seq1" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments_orgs" TO "anon";
GRANT ALL ON TABLE "public"."tournaments_orgs" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments_orgs" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
