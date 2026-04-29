# SheetForge

AI-native spreadsheet workspace built with Next.js, FortuneSheet, Zustand, Supabase, Groq, ECharts, and SheetJS.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the local values.
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npx tsc --noEmit
npx eslint src/ --max-warnings 0
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service role key |
| `AI_PROVIDER` | AI provider label, currently `groq` |
| `AI_BASE_URL` | OpenAI-compatible AI API base URL |
| `AI_API_KEY` | Generic server-only AI API key |
| `GROQ_API_KEY` | Groq server-only API key used by AI routes |
| `AI_MODEL` | Primary AI model |
| `AI_FALLBACK_MODEL` | Fallback AI model |
| `CEREBRAS_BASE_URL` | Optional Cerebras fallback base URL |
| `CEREBRAS_API_KEY` | Optional Cerebras API key |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

## Build Log

Session progress is tracked in `CLAUDE.md` and `SESSION_TRACKER.md`.

## Deployment

The app is configured for Vercel with `vercel.json`.

```bash
npm run build
npx vercel --prod --yes
```

Production deployment currently requires a valid Vercel CLI token or an authenticated `vercel login` session.
