# local database dev

TODO's
- create automated testing system w/ some kind of browser mockup
- setup CI/CD pipeline
- figure out sync between COMPOSE and DB backwards incompatible updates (scheduled downtimes?)

# Prereqs

requires colima/docker/orbstack, supabase CLI. see https://supabase.com/docs/guides/local-development/cli/getting-started for info on starting supabase.

tested one-time admin setup with colima and orbstack on arm mac. 
tested dev update workflow with orbstack on arm mac on a clean clone.

# Workflows

All of the below require Docker/Colima/OrbStack and Supabase to be running.

```
cd COMPOSE/db
npm ci install
supabase start 
```
See [Supabase docs](https://supabase.com/docs/guides/local-development/cli/getting-started) for more info.

Copy the api url and anon key from the `supabase start` output into your .env. For example with the output
```
 API URL: http://127.0.0.1:54331
...
anon key: ey.rest.of.key
...
```
you would add the below to your .env file.
```
VITE_SUPABASE_URL=http://127.0.0.1:54331
VITE_SUPABASE_ANON_KEY=ey.rest.of.key
```

One-time Admin Setup:
1. download current schema via `supabase login`, `supabase init`, `supabase link`, `supabase db pull`, `supabase db pull --schema auth`, etc. make the start migration as minimal as possible
2. prep seed data: `npx @snaplet/seed init` (choose node-postgres), `npx @snaplet/seed sync`, edit `seed.config.ts` and `seed.ts`
3. run `npx tsx seed.ts > supabase/seed.sql` and `supabase db reset`
4. test against COMPOSE and commit to VCS

Dev+Update Workflow:
1. clone supabase_dev repo / pull latest
2. start supabase. run `supabase db reset` to get remote changes applied locally.
3. fill out seed data with `npx @snaplet/seed sync`, `npx tsx seed.ts > supabase/seed.sql`, `supabase db reset`
4. edit the db via UI (open the studio url in the `supabase status` output) or SQL commands
5. run `supabase db diff --schema public`, put diff in new migration: `supabase migration new migration_name`
6. add new sample seed data to `seed.ts`
7. run `supabase db reset` to test running the migrations and adding seed data
8. test against COMPOSE 
9. TODO: add automated tests (UI mockup for each user action + DB assertions)
10. commit to VCS
11. notify admin

Admin Migration Workflow:
1. get notified, pull latest
2. start supabase. run `supabase db reset`
3. test against COMPOSE
4. maybe add more automated tests or seed data, then commit to VCS
5. run `supabase link --project-ref <project-id>`
6. run `supabase db push --dry-run`
7. confirm with other admins, then run `supabase db push` (execute on latest only)


To stop running the database and other services (and save your battery), quit Docker or run `colima stop` or quit OrbStack.

## DB Seed Data

To add a user account as seed data, bring up the DB locally. Then, start up the project.

Sign up as a new user, then look in the `auth.users` table. Copy the encrypted password, and add a call to the
`create_user` function (see `COMP/seed.ts`). Run `npx tsx seed.ts > supabase/seed.sql` and `supabase db reset`
as described above in the dev+update workflow.


# COMPOSE Dev DB

Use the pre-authenticated email and password pair below to sign in as an admin.
```
admin@gmail.com
admin123
```
Problem Writer:
```
jane@gmail.com
morgan
```

If you ever need to sign out, but the local Supabase API server is down
or restarted, go into your browsers Developer Tools then navigate to
Application > Local Storage > localhost:3000 > sb-127-auth-token
and delete (backspace) that key value pair.
