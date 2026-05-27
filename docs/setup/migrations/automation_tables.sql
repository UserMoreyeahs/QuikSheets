-- Idempotent migration: automation tables
-- Apply to project mrvzwwfnimqufendjfhj via Supabase MCP apply_migration.
-- Safe to re-run: all statements use IF NOT EXISTS / DO $$ guards.

-- ────────────────────────────────────────────────────────────────────────────
-- automations
-- Stores one row per user-defined automation rule.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id         uuid NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  name                text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  enabled             boolean NOT NULL DEFAULT true,
  trigger_type        text NOT NULL CHECK (trigger_type IN ('row_created', 'row_updated', 'status_changed')),
  trigger_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_type         text NOT NULL CHECK (action_type IN ('email', 'whatsapp', 'slack', 'teams', 'task')),
  action_config_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Ensure the owner index exists (safe to re-run)
CREATE INDEX IF NOT EXISTS automations_workbook_id_idx ON public.automations (workbook_id);

-- RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

-- Owners can do everything; editors can read + insert; viewers can read.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'Workbook members can read automations'
  ) THEN
    CREATE POLICY "Workbook members can read automations"
      ON public.automations FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.workbook_members wm
          WHERE wm.workbook_id = automations.workbook_id
            AND wm.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.workbooks w
          WHERE w.id = automations.workbook_id
            AND w.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'Editors can create automations'
  ) THEN
    CREATE POLICY "Editors can create automations"
      ON public.automations FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.workbook_members wm
          WHERE wm.workbook_id = automations.workbook_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('editor', 'owner')
        )
        OR
        EXISTS (
          SELECT 1 FROM public.workbooks w
          WHERE w.id = automations.workbook_id
            AND w.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'Editors can update automations'
  ) THEN
    CREATE POLICY "Editors can update automations"
      ON public.automations FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.workbook_members wm
          WHERE wm.workbook_id = automations.workbook_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('editor', 'owner')
        )
        OR
        EXISTS (
          SELECT 1 FROM public.workbooks w
          WHERE w.id = automations.workbook_id
            AND w.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- automation_runs
-- One row per provider execution attempt.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  input_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_runs_automation_id_idx ON public.automation_runs (automation_id);
CREATE INDEX IF NOT EXISTS automation_runs_created_at_idx   ON public.automation_runs (created_at DESC);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automation_runs' AND policyname = 'Workbook members can read runs'
  ) THEN
    CREATE POLICY "Workbook members can read runs"
      ON public.automation_runs FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.automations a
          JOIN public.workbooks w ON w.id = a.workbook_id
          WHERE a.id = automation_runs.automation_id
            AND (
              w.owner_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.workbook_members wm
                WHERE wm.workbook_id = w.id AND wm.user_id = auth.uid()
              )
            )
        )
      );
  END IF;
END $$;

-- Service role bypasses RLS for the dispatcher (INSERT runs from the server).
-- No extra policy needed — service role ignores RLS by default in Supabase.
