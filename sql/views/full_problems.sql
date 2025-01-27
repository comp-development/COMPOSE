
CREATE OR REPLACE VIEW full_problems WITH (security_invoker) AS
    SELECT
        problems.id,
        problems.created_at,
        problems.author_id,
        problems.problem_latex,
        problems.answer_latex,
        problems.solution_latex,
        problems.difficulty,
        problems.sub_topics,
        problems.nickname,
        problems.comment_latex,
        problems.edited_at,
        problems.embedding,
        users.full_name,
        users.initials || problems.id AS front_id,
        topics.topics,
        topics.topics_short,
        COALESCE(unresolved_count.count, 0) AS unresolved_count,
        problem_test_list.test_names AS problem_tests,
        problems.archived
    FROM
        problems
        LEFT JOIN users ON users.id = problems.author_id

        -- make the topic into a comma separated string
        LEFT JOIN (
        SELECT 
            problem_topics.problem_id, 
            string_agg(global_topics.topic, ', ') AS topics, 
            string_agg(global_topics.topic_short, ', ') AS topics_short
        FROM
            problem_topics
            JOIN global_topics ON problem_topics.topic_id = global_topics.id
        GROUP BY problem_topics.problem_id
        ) AS topics ON problems.id = topics.problem_id

        -- count unresolved problems
        LEFT JOIN (
        SELECT 
            problem_feedback.problem_id,
            COUNT(*) AS count
        FROM problem_feedback
        WHERE
            problem_feedback.resolved IS FALSE AND
            (problem_feedback.feedback = '') IS FALSE
        GROUP BY problem_feedback.problem_id
        ) AS unresolved_count ON problems.id = unresolved_count.problem_id

        -- get tests
        LEFT JOIN (
            SELECT
                test_problems.problem_id,
                string_agg(tests.test_name, ', ') AS test_names
            FROM
                test_problems
                JOIN tests ON test_problems.test_id = tests.id
            GROUP BY test_problems.problem_id
        ) AS problem_test_list ON problems.id = problem_test_list.problem_id;
