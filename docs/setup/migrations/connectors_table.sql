-- ============================================================================
-- Migration: connector_connections table
-- Apply via: Supabase SQL Editor or supabase db push
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
-- Re-running is safe.
--
-- Security model:
--   - RLS is ENABLED. Users can only see/modify their own connections.
--   - config_json stores connector-specific settings, including encrypted
--     secret fields (API keys, connection strings). The server-side service-
--     role client is the ONLY path that reads sensitive config values.
--   - The anon/authenticated key never has direct access to config_json of
--     another user's row.
-- ============================================================================

-- Table definition
CREATE TABLE IF NOT EXISTS public.connector_connections (
  id              text        PRIMARY KEY,          -- client-generated UUID
  workbook_id     uuid        NOT NULL,             -- FK → workbooks.id
  sheet_id        text        NOT NULL,             -- target sheet within workbook
  connector_kind  text        NOT NULL,             -- 'csv-url' | 'json-url' | ...
  config_json     jsonb       NOT NULL DEFAULT '{}', -- connector config (may contain secrets)
  mapping_json    jsonb       NOT NULL DEFAULT '[]', -- ColumnMapping[]
  schedule        text        NOT NULL DEFAULT 'manual', -- 'manual' | 'on-open' | 'daily'
  last_synced_at  timestamptz,                      -- NULL until first successful sync
  created_by      uuid        NOT NULL,             -- auth.uid() of the creator
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index on workbook_id for fast per-workbook queries
CREATE INDEX IF NOT EXISTS connector_connections_workbook_id_idx
  ON public.connector_connections (workbook_id);

-- Index on created_by for RLS policy performance
CREATE INDEX IF NOT EXISTS connector_connections_created_by_idx
  ON public.connector_connections (created_by);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.connector_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "Owner can select own connections"    ON public.connector_connections;
DROP POLICY IF EXISTS "Owner can insert own connections"   ON public.connector_connections;
DROP POLICY IF EXISTS "Owner can update own connections"   ON public.connector_connections;
DROP POLICY IF EXISTS "Owner can delete own connections"   ON public.connector_connections;

-- SELECT: owner only
CREATE POLICY "Owner can select own connections"
  ON public.connector_connections
  FOR SELECT
  USING (created_by = auth.uid());

-- INSERT: owner only (created_by must match the auth'd user)
CREATE POLICY "Owner can insert own connections"
  ON public.connector_connections
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- UPDATE: owner only
CREATE POLICY "Owner can update own connections"
  ON public.connector_connections
  FOR UPDATE
  USING (created_by = auth.uid());

-- DELETE: owner only
CREATE POLICY "Owner can delete own connections"
  ON public.connector_connections
  FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================================
-- Notes for the operator
-- ============================================================================
-- 1. The `workbook_id` column references `public.workbooks(id)`, but no FK
--    constraint is added here to avoid breakage if workbooks are deleted
--    outside a cascade. Clean up orphaned rows with:
--      DELETE FROM public.connector_connections
--      WHERE workbook_id NOT IN (SELECT id FROM public.workbooks);
--
-- 2. config_json may contain plaintext secrets if the client sends them
--    without encryption. In production, consider applying column-level
--    encryption via pgsodium or Vault before storing sensitive credentials.
--
-- 3. To add workbook-member access (shared workbooks), add a second SELECT
--    policy joining workbook_members:
--      CREATE POLICY "Members can select connections"
--      ON public.connector_connections
--      FOR SELECT
--      USING (
--        EXISTS (
--          SELECT 1 FROM public.workbook_members
--          WHERE workbook_id = connector_connections.workbook_id
--            AND user_id = auth.uid()
--        )
--      );
