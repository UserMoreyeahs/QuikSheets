/**
 * Client-safe re-export of the public env subset.
 *
 * Anything imported from here is OK in browser bundles. Server-only secrets
 * (SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, etc.) live in env.ts and must
 * never be re-exported here.
 */
export { publicEnv, type PublicEnv } from './env'
