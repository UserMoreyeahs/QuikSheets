import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

const PROTECTED_PREFIXES = ['/dashboard', '/sheet', '/workbook']
const PUBLIC_PREFIXES = ['/login', '/signup', '/reset', '/confirm', '/unauthorized', '/forms', '/s', '/api']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Match on a path BOUNDARY, not a bare prefix. A bare startsWith made the
  // public '/s' (share-token route) swallow '/sheet/*' — so EVERY sheet route
  // bypassed the auth gate. `=== p || startsWith(p + '/')` keeps '/s/<token>'
  // public while '/sheet/<id>' stays protected.
  const onPathBoundary = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  const isProtected = PROTECTED_PREFIXES.some(onPathBoundary)
  if (!isProtected) return NextResponse.next()
  // Skip if any public prefix matches first
  if (PUBLIC_PREFIXES.some(onPathBoundary)) return NextResponse.next()

  // If Supabase isn't configured, fall through (the legacy localStorage path
  // still works and the app should not be locked out in dev).
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            if (options) response.cookies.set(name, value, options)
            else response.cookies.set(name, value)
          })
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user) {
    // Distinguish "no session" from "Supabase momentarily unreachable".
    // getUser() returns { user: null } WITHOUT throwing on a network blip
    // (AuthRetryableFetchError). Redirecting on that logs out a user who
    // holds a valid cookie — the reported "Failed to fetch → kicked to
    // /login after a restart/blip". FAIL OPEN on transient/server errors;
    // only redirect on a genuine null user with no error. (The page's own
    // client auth still guards data access, so this isn't a security hole.)
    const status = (error as { status?: number } | null)?.status
    const transient =
      !!error &&
      (error.name === 'AuthRetryableFetchError' ||
        status === 0 ||
        (typeof status === 'number' && status >= 500))
    if (transient) return response

    const loginUrl = new URL('/login', request.url)
    // Only ever round-trip a same-origin path. A protocol-relative value
    // like "//evil.com" is a valid pathname but turns the post-login
    // redirect into an open redirect (phishing). Single leading slash only.
    const safeNext =
      pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/dashboard'
    loginUrl.searchParams.set('next', safeNext)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
}
