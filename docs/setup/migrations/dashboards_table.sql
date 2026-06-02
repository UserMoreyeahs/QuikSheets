-- Advanced Dashboards — P2 #32
-- Idempotent: safe to run multiple times.
--
-- The `dashboards` table stores one row per dashboard.
-- All widgets are stored as JSONB in `widgets_json` (no separate widget table).
-- Access control mirrors the workbooks pattern:
--   - workbook owners can always read/write
--   - workbook_members (any role) can read; editors can write
--
-- RLS policies use the `workbook_members` table that already exists.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dashboards (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID    NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL DEFAULT 'Untitled Dashboard',
  widgets_json JSONB  NOT NULL DEFAULT '[]'::jsonb,
  created_by  UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast "all dashboards for a workbook" lookups
CREATE INDEX IF NOT EXISTS dashboards_workbook_id_idx
  ON public.dashboards (workbook_id);

-- Auto-update updated_at on every row update
-- (reuses the trigger function already defined in schema.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'dashboards_updated_at'
      AND tgrelid = 'public.dashboards'::regclass
  ) THEN
    CREATE TRIGGER dashboards_updated_at
      BEFORE UPDATE ON public.dashboards
      FOR EACH ROW EXECUTE FUNCTION quiksheets_set_updated_at();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- Drop any previously created policies so this script is idempotent.
DROP POLICY IF EXISTS "Dashboards: workbook owner read" ON public.dashboards;
DROP POLICY IF EXISTS "Dashboards: workbook owner write" ON public.dashboards;
DROP POLICY IF EXISTS "Dashboards: workbook member read" ON public.dashboards;
DROP POLICY IF EXISTS "Dashboards: workbook editor write" ON public.dashboards;

-- Owners can read all dashboards for their workbooks.
CREATE POLICY "Dashboards: workbook owner read"
  ON public.dashboards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workbooks w
      WHERE w.id = dashboards.workbook_id
        AND w.owner_id = auth.uid()
    )
  );

-- Owners can insert / update / delete dashboards.
CREATE POLICY "Dashboards: workbook owner write"
  ON public.dashboards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workbooks w
      WHERE w.id = dashboards.workbook_id
        AND w.owner_id = auth.uid()
    )
  );

-- Workbook members (any role) can read dashboards.
CREATE POLICY "Dashboards: workbook member read"
  ON public.dashboards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workbook_members wm
      WHERE wm.workbook_id = dashboards.workbook_id
        AND wm.user_id = auth.uid()
    )
  );

-- Editor-role members can insert / update dashboards (not delete).
CREATE POLICY "Dashboards: workbook editor write"
  ON public.dashboards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workbook_members wm
      WHERE wm.workbook_id = dashboards.workbook_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'editor'
    )
  );

CREATE POLICY "Dashboards: workbook editor update"
  ON public.dashboards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workbook_members wm
      WHERE wm.workbook_id = dashboards.workbook_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'editor'
    )
  );
