# Quiksheets

AI-native browser spreadsheet for analysts, founders, finance/operations teams, students, freelancers, and SMB teams. Built with Next.js 15, React 19, TypeScript strict, FortuneSheet (with a Univer adapter path), HyperFormula, Supabase, Groq, ECharts, and SheetJS.

> Legacy files may mention "SheetForge". That name is historical context only — every new file, component, route, database slug, env name, package name, README, and UI string must use **Quiksheets**.

## Documentation

- [`AGENTS.md`](AGENTS.md) — Codex/agent operating contract.
- [`docs/01_PRODUCT_REQUIREMENTS.md`](docs/01_PRODUCT_REQUIREMENTS.md) — P0/P1/P2 scope, acceptance tests.
- [`docs/02_TECH_STACK_AND_DEPENDENCIES.md`](docs/02_TECH_STACK_AND_DEPENDENCIES.md) — verified stack decisions.
- [`docs/03_ARCHITECTURE.md`](docs/03_ARCHITECTURE.md) — adapter interfaces, folder layout, state rules.
- [`docs/04_DATABASE_SCHEMA_AND_RLS.md`](docs/04_DATABASE_SCHEMA_AND_RLS.md) — Postgres schema and RLS plan.
- [`docs/05_TESTING_AND_QUALITY_GATES.md`](docs/05_TESTING_AND_QUALITY_GATES.md) — required test suites.
- [`docs/08_SESSION_ROADMAP.md`](docs/08_SESSION_ROADMAP.md) — original 22-session plan.
- [`docs/09_CODEX_PROMPTS_22_SESSIONS.md`](docs/09_CODEX_PROMPTS_22_SESSIONS.md) — paste-into-Codex prompts.
- [`docs/REMEDIATION_CODEX_PROMPTS.md`](docs/REMEDIATION_CODEX_PROMPTS.md) — R1–R14 bridge plan from legacy SheetForge work to the Quiksheets target.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the values.
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run start        # start production server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (added in R2)
npm run test         # Vitest (added in R2)
npm run test:e2e     # Playwright (added in R2)
```

## Environment Variables

See [`.env.example`](.env.example) for the canonical list. Required at minimum:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service role key |
| `GROQ_API_KEY` | Server-only Groq API key |
| `GROQ_MODEL` | Defaults to `llama-3.3-70b-versatile` |
| `NEXT_PUBLIC_ENGINE` | Spreadsheet engine selector (`fortune` \| `univer`) |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

## Deployment

Configured for Vercel via `vercel.json`. Detailed checklist will land with R14.

## Build Log

Session progress is tracked in `CLAUDE.md` and `SESSION_TRACKER.md`.
