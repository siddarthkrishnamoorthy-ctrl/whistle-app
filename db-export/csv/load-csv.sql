-- Load the Whistle core test data from CSV into an EXISTING (migrated) schema.
-- Run from this folder: psql -h <host> -U <user> -d whistle -f load-csv.sql
--
-- FK checks are disabled for the load (session_replication_role = replica) so
-- table order doesn't matter, and the target tables are truncated first so the
-- load is repeatable. TRUNCATE ... CASCADE also clears dependent tables that are
-- NOT part of this CSV set (games, enrolments, invoices, event chat, …) — for
-- the COMPLETE dataset use whistle-demo-db.sql.gz instead.
\set ON_ERROR_STOP on

SET session_replication_role = replica;

TRUNCATE academies, sports, centers, users, plans, classes, clients, semesters,
         drills, lesson_plans, enquiries, interschool_events, fixtures, ratings,
         scrabble_word_lists, scrabble_word_entries, chess_puzzles, scrabble_puzzles
         CASCADE;

\copy academies             FROM 'academies.csv'             WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy sports                FROM 'sports.csv'                WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy centers               FROM 'centers.csv'               WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy users                 FROM 'users.csv'                 WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy plans                 FROM 'plans.csv'                 WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy classes               FROM 'classes.csv'               WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy clients               FROM 'clients.csv'               WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy semesters             FROM 'semesters.csv'             WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy drills                FROM 'drills.csv'                WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy lesson_plans          FROM 'lesson_plans.csv'          WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy enquiries             FROM 'enquiries.csv'             WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy interschool_events    FROM 'interschool_events.csv'    WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy fixtures              FROM 'fixtures.csv'              WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy ratings               FROM 'ratings.csv'               WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy scrabble_word_lists   FROM 'scrabble_word_lists.csv'   WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy scrabble_word_entries FROM 'scrabble_word_entries.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy chess_puzzles         FROM 'chess_puzzles.csv'         WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy scrabble_puzzles      FROM 'scrabble_puzzles.csv'      WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

SET session_replication_role = DEFAULT;

\echo 'CSV load complete.'
