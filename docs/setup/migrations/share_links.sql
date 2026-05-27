-- share_links — idempotent migration
-- Run order: after workbooks table and auth.users exist.
-- DO NOT apply manually; the orchestrator runs this against project mrvzwwfnimqufendjfhj.

-- 1. Create the table (no-op if it already exists)
CREATE TABLE IF NOT EXISTS share_links (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  token       text        NOT NULL UNIQUE,
  workbook_id uuid        NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'viewer'
                          CHECK (role IN ('viewer', 'editor')),
  expires_at  timestamptz NULL,
  active      boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Idempotent column additions (safe to re-run)
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS expires_at  timestamptz NULL;
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS active      boolean     NOT NULL DEFAULT true;
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now();

-- 3. Rename is_active → active if the old column exists (safe if already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'share_links'
       AND column_name  = 'is_active'
  ) THEN
    ALTER TABLE share_links RENAME COLUMN is_active TO active;
  END IF;
END $$;

-- 4. RLS
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Public can resolve a token (read a single row) when the link is active and not expired.
-- The /s/[token] page uses the service-role client, so this policy is defence-in-depth.
DROP POLICY IF EXISTS "share_links_resolve" ON share_links;
CREATE POLICY "share_links_resolve"
  ON share_links FOR SELECT
  USING (
    active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Authenticated workbook members (owner role) can read ALL links for their workbook,
-- including revoked/expired ones (for the ShareDialog list).
DROP POLICY IF EXISTS "share_links_owner_read" ON share_links;
CREATE POLICY "share_links_owner_read"
  ON share_links FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workbooks
       WHERE workbooks.id = share_links.workbook_id
         AND workbooks.owner_id = auth.uid()
    )
  );

-- Only the workbook owner can insert share links.
DROP POLICY IF EXISTS "share_links_owner_insert" ON share_links;
CREATE POLICY "share_links_owner_insert"
  ON share_links FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workbooks
       WHERE workbooks.id = share_links.workbook_id
         AND workbooks.owner_id = auth.uid()
    )
  );

-- Only the workbook owner can update (revoke) their links.
DROP POLICY IF EXISTS "share_links_owner_update" ON share_links;
CREATE POLICY "share_links_owner_update"
  ON share_links FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workbooks
       WHERE workbooks.id = share_links.workbook_id
         AND workbooks.owner_id = auth.uid()
    )
  );

-- Index for the hot resolve path
CREATE INDEX IF NOT EXISTS share_links_token_idx ON share_links (token);
CREATE INDEX IF NOT EXISTS share_links_workbook_idx ON share_links (workbook_id);
