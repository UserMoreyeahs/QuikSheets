'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/env'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const emailSchema = z.object({
  email: z.string().email(),
})

const resetSchema = z.object({
  password: z.string().min(8),
})

export interface AuthResult {
  ok: boolean
  error?: string
}

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { ok: false, error: 'Enter a valid email and a password of at least 8 characters.' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false, error: 'Authentication is not configured.' }

  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { ok: false, error: error.message }
  redirect('/dashboard')
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { ok: false, error: 'Enter a valid email and a password of at least 8 characters.' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false, error: 'Authentication is not configured.' }

  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/confirm` },
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOutAction(): Promise<void> {
  const supabase = await getServerSupabase()
  if (supabase) await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordResetAction(formData: FormData): Promise<AuthResult> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { ok: false, error: 'Enter a valid email.' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false, error: 'Authentication is not configured.' }

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/reset`,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function completePasswordResetAction(formData: FormData): Promise<AuthResult> {
  const parsed = resetSchema.safeParse({ password: formData.get('password') })
  if (!parsed.success) return { ok: false, error: 'Password must be at least 8 characters.' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false, error: 'Authentication is not configured.' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { ok: false, error: error.message }
  redirect('/dashboard')
}
