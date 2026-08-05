# How to run these 3 SQL files

I couldn't apply these directly — the Supabase connection I have is
read-only from my side, so these need to be run through the Supabase
dashboard, which you already have full access to.

## Steps

1. Go to your Supabase project dashboard → **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `01_function_search_path_and_admin_login.sql`, copy the entire
   contents, paste into the SQL Editor, click **Run**. Confirm it says
   "Success. No rows returned" with no red error box.
4. New query again. Repeat step 3 with `02_rls_performance_wrap_auth_uid.sql`.
5. New query again. Repeat step 3 with `03_missing_fk_indexes.sql`.

Run them in that order (1, then 2, then 3) and one at a time, not all
pasted together — if anything ever needs troubleshooting, it's much
easier to tell which file caused it.

## What to expect

All three are wrapped in `BEGIN ... COMMIT`, so each file either fully
applies or does nothing at all — there's no way to end up half-changed.
None of them touch table data, only function configuration, RLS policy
definitions (rewritten to be functionally identical, just faster), and
new indexes.

## After running

I'd suggest clicking through a few things afterward, same as you've been
doing: search results (Discover), a vendor profile, adding/editing a
product or service, and the partner dashboard's close/restore account
buttons if you have a test partner account — these are the areas the
RLS changes touch most directly.

If anything looks wrong after running these, tell me exactly what broke
and I can read back the current policy/function state from the database
to see what happened — I can't undo it myself since I can't write to the
database, but I can diagnose it and give you the exact rollback SQL.
