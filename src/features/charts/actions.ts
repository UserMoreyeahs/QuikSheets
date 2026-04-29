'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase/server'
import { assertCanEdit } from '@/lib/permissions'
import type { ChartConfig } from './types'

const configSchema = z.object({
  kind: z.enum(['bar', 'line', 'pie']),
  title: z.string().optional(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  hasHeader: z.boolean(),
  categoryColumn: z.number().int().nonnegative(),
  seriesColumns: z.array(z.number().int().nonnegative()).min(1).max(10),
  legend: z.boolean().optional(),
})

const createSchema = z.object({
  workbookId: z.string().uuid(),
  sheetId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  sourceRange: z.string().min(1).max(40),
  config: configSchema,
})

export async function createChartAction(input: z.input<typeof createSchema>) {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid chart' }

  const ctx = await assertCanEdit(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('charts')
    .insert({
      workbook_id: parsed.data.workbookId,
      sheet_id: parsed.data.sheetId,
      name: parsed.data.name,
      chart_type: parsed.data.config.kind,
      source_range: parsed.data.sourceRange,
      config_json: parsed.data.config,
      created_by: ctx.userId,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false as const, error: error?.message ?? 'Insert failed' }
  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const, id: data.id as string }
}

export async function listChartsAction(workbookId: string, sheetId: string) {
  const supabase = await getServerSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('charts')
    .select('id, name, chart_type, source_range, config_json, created_at')
    .eq('workbook_id', workbookId)
    .eq('sheet_id', sheetId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    chartType: row.chart_type as string,
    sourceRange: row.source_range as string,
    config: row.config_json as ChartConfig,
    createdAt: row.created_at as string,
  }))
}
