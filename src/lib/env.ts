/**
 * Server-side env validation. Throws at boot if required values are missing.
 *
 * Do NOT import this file from client modules — it reads SUPABASE_SERVICE_ROLE_KEY
 * and GROQ_API_KEY which must never reach the browser bundle. Use env.client.ts
 * for the safe public subset.
 */
import { z } from 'zod'

const trimmedString = z.string().trim().min(1)
const optionalString = z.string().trim().optional().default('')
const booleanFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal('')])
  .optional()
  .default('false')
  .transform((v) => v === 'true' || v === '1')

const serverSchema = z.object({
  // App
  APP_URL: trimmedString.optional().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Supabase (server-only)
  SUPABASE_SERVICE_ROLE_KEY: optionalString,

  // Groq (server-only)
  GROQ_API_KEY: optionalString,
  GROQ_MODEL: trimmedString.optional().default('llama-3.3-70b-versatile'),

  // AI controls
  AI_RATE_LIMIT_PER_USER: z
    .string()
    .optional()
    .default('50')
    .transform((v) => Number.parseInt(v, 10) || 50),
  AI_TIMEOUT_MS: z
    .string()
    .optional()
    .default('30000')
    .transform((v) => Number.parseInt(v, 10) || 30_000),

  // Integration providers — set to 'real' (or any non-'mock' string)
  // to use the real adapter; otherwise the MockProvider is returned
  // and the action no-ops successfully (useful for dev / CI).
  EMAIL_PROVIDER: trimmedString.optional().default('mock'),
  SLACK_PROVIDER: trimmedString.optional().default('mock'),
  TEAMS_PROVIDER: trimmedString.optional().default('mock'),
  WHATSAPP_PROVIDER: trimmedString.optional().default('mock'),
  TASK_PROVIDER: trimmedString.optional().default('mock'),

  // Real provider credentials. Reading these is gated by the provider
  // selection above. Missing values cause the provider to return a clear
  // "not configured" error rather than crashing or silently dropping.
  RESEND_API_KEY: optionalString,
  RESEND_FROM: optionalString,
  SLACK_WEBHOOK_URL: optionalString,
  TEAMS_WEBHOOK_URL: optionalString,
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_WHATSAPP_FROM: optionalString,
})

const publicSchema = z.object({
  NEXT_PUBLIC_APP_NAME: trimmedString.optional().default('Quiksheets'),
  NEXT_PUBLIC_APP_URL: trimmedString.optional().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  NEXT_PUBLIC_ENGINE: z.enum(['fortune', 'univer']).optional().default('fortune'),

  // Feature flags
  NEXT_PUBLIC_FF_PIVOT: booleanFlag,
  NEXT_PUBLIC_FF_DASHBOARDS: booleanFlag,
  NEXT_PUBLIC_FF_MACROS: booleanFlag,
  NEXT_PUBLIC_FF_CONNECTORS: booleanFlag,
  NEXT_PUBLIC_FF_ROW_RLS: booleanFlag,
  NEXT_PUBLIC_FF_FORECAST: booleanFlag,
  NEXT_PUBLIC_REALTIME_CRDT: booleanFlag,
  NEXT_PUBLIC_FEATURE_UNIVER_PRO: booleanFlag,
})

function readPublicEnv() {
  // Supabase recently renamed NEXT_PUBLIC_SUPABASE_ANON_KEY to
  // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Accept either; prefer the new name.
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return publicSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublicKey,
    NEXT_PUBLIC_ENGINE: process.env.NEXT_PUBLIC_ENGINE,
    NEXT_PUBLIC_FF_PIVOT: process.env.NEXT_PUBLIC_FF_PIVOT,
    NEXT_PUBLIC_FF_DASHBOARDS: process.env.NEXT_PUBLIC_FF_DASHBOARDS,
    NEXT_PUBLIC_FF_MACROS: process.env.NEXT_PUBLIC_FF_MACROS,
    NEXT_PUBLIC_FF_CONNECTORS: process.env.NEXT_PUBLIC_FF_CONNECTORS,
    NEXT_PUBLIC_FF_ROW_RLS: process.env.NEXT_PUBLIC_FF_ROW_RLS,
    NEXT_PUBLIC_FF_FORECAST: process.env.NEXT_PUBLIC_FF_FORECAST,
    NEXT_PUBLIC_REALTIME_CRDT: process.env.NEXT_PUBLIC_REALTIME_CRDT,
    NEXT_PUBLIC_FEATURE_UNIVER_PRO: process.env.NEXT_PUBLIC_FEATURE_UNIVER_PRO,
  })
}

function readServerEnv() {
  return serverSchema.parse({
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    AI_RATE_LIMIT_PER_USER: process.env.AI_RATE_LIMIT_PER_USER,
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    SLACK_PROVIDER: process.env.SLACK_PROVIDER,
    TEAMS_PROVIDER: process.env.TEAMS_PROVIDER,
    WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER,
    TASK_PROVIDER: process.env.TASK_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    TEAMS_WEBHOOK_URL: process.env.TEAMS_WEBHOOK_URL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
  })
}

export type ServerEnv = z.infer<typeof serverSchema>
export type PublicEnv = z.infer<typeof publicSchema>

export const publicEnv: PublicEnv = readPublicEnv()
export const serverEnv: ServerEnv = readServerEnv()
