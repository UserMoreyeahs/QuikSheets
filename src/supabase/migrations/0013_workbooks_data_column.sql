-- 0013 — workbooks.data: restore the denormalized cell-data column the app uses.
--
-- BUG (found by scripts/check-schema-drift.mjs during the Stage 6 schema-truth
-- pass): the LIVE `workbooks` table has no `data` column, but src/lib/sheetApi.ts
-- persists the workbook's entire cell grid through workbooks.data:
--     .update({ name, data })            (owner + editor save paths)
--     .insert({ name, data, owner_id })  (create path)
--     .select('id, name, data, updated_at')   (load path)
-- With the column absent, every cloud save/load of cell data returned Postgres
-- 42703 ("column workbooks.data does not exist"); saveService then silently fell
-- back to localStorage. Net effect: CLOUD workbooks never actually persisted
-- their cells to Supabase — data lived only in the browser that made the edit,
-- and never synced across devices or collaborators. (Demo/local workbooks were
-- unaffected because they use localStorage by design.)
--
-- The schema had been normalized toward a separate `cells` table, but the
-- application code is the source of truth and uses the denormalized JSONB blob.
-- Add the column so cloud cell-data persistence works as the code intends.
--
-- Idempotent. After applying, `npm run db:check-drift` passes clean.

alter table public.workbooks
  add column if not exists data jsonb;
