# Quiksheets — Deployment and Operations Guide

## 1. Deployment Targets
- Application: Vercel
- Database/Auth/Storage/Realtime: Supabase hosted project

## 2. Environment Setup
Use `.env.example` as the source of required variables. Validate env vars with Zod at runtime.

## 3. CI Checks
Minimum CI:
- install
- typecheck
- lint
- test
- build

## 4. Deployment Controls
- P2 features behind feature flags
- Experimental AI features behind flags
- Server-only secrets in Vercel
- RLS enabled before public preview

## 5. Observability
Implement:
- structured API logs
- user-visible error messages
- client error boundary
- AI failure logs
- automation run logs
- audit logs for permission changes and accepted AI mutations

## 6. Release Readiness
A release is ready only when:
- P0 acceptance tests pass
- Auth and RLS verified
- env validation works
- build succeeds
- import/export smoke tests pass
- AI preview and rollback flows pass
