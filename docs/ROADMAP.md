# Quiksheets — Forward Roadmap

> Practical, prioritized next steps after the hardening + architecture-audit work
> (June 2026). Phases are ordered by *necessity*, not ambition: Phase 0 blocks
> launch; Phase 1 makes launch safe; Phases 2–4 are graduated investments you fund
> only as goals/scale demand. Nothing in Phase 0–1 is a rewrite.

## Where it stands (one paragraph)

The app is feature-rich and the core editing surface (cells, 50+ formulas,
formatting, charts, pivots, import/export, conditional formatting, AI assists) is
real and now smoke-tested. The remaining risk is **not** features — it's two
ship-blockers (cloud cell persistence + open AI endpoints) and a layer of
architectural/scale debt that's documented and sequenced, not urgent. Already
shipped this cycle: observable persistence fallbacks (logging), a schema
source-of-truth + drift guard, CI, the cross-workbook leak fix, the font-size
fix, and the workbook-switch/save-conflict fixes.

## The decisions that fork everything (decide these first)

1. **Launch target?**
   - *Private beta / single-user demo* → Phase 0 item #1 only, ship today.
   - *Public, multi-user* → all of Phase 0 + Phase 1 (~1 week).
2. **Is real-time collaboration a v1 requirement?**
   - *No* (v1 is single-editor) → just message it honestly; no code blocker.
   - *Yes* (Google-Sheets-style) → that's Phase 3 (off-blob + cell-merge); weeks, design-first.
3. **Expected sheet size?**
   - *Typical (≤ ~10–20k cells)* → the JSON-blob persistence is fine; defer Phase 3.
   - *Large (50k+ cells)* → prioritize the off-blob migration (Phase 3).
4. **Architecture intent?**
   - *Stay on FortuneSheet* (recommended — it works) → keep the engine seam as cleanup.
   - *Pursue the Univer target in AGENTS.md* → a large rewrite; only worth it with a concrete driver (it currently buys nothing the product needs).

**Recommended default:** ship a **private beta** now (Phase 0 #1), complete **Phase 1** within a week for a public launch, treat collaboration as **single-editor v1**, keep **FortuneSheet**, and fund Phase 2–3 as real usage data arrives.

---

## Phase 0 — Ship-blockers (this week)

| # | Action | Why | Owner | Effort |
|---|---|---|---|---|
| 1 | **Apply migration `0013`** (`alter table public.workbooks add column if not exists data jsonb;`) on the canonical project `mrvzwwfnimqufendjfhj` via the dashboard SQL editor | Cloud workbooks don't persist cell data without it (silent localStorage fallback). **Hard blocker.** | **You** (I can't reach the real DB — MCP is bound to the stray project; REST can't run DDL) | 2 min |
| 2 | **Authenticate the 8 `/api/ai/*` routes** + attach the session token in the client calls | They're open to the internet today; anyone can burn your Groq quota. | Me | ~½ day |
| 3 | **Rotate the leaked secrets**: the Supabase DB password and the Google OAuth client secret were exposed in plaintext during this work. Rotate both; never commit live secrets. | Credential hygiene before going public. | You | ~30 min |

After #1, run `npm run db:check-drift` — it should go green, confirming cloud saves work.

## Phase 1 — Launch hardening (week 1–2; do before a public launch)

| # | Action | Why |
|---|---|---|
| 4 | **Make the persistence fallback visible in the UI** — a sticky "Not syncing to cloud" banner when a logged-in user's save lands in localStorage (the logging exists; promote a *config* failure to a user-facing warning). | This class of outage (forms/dashboards/workbooks.data) has hidden 4× because "DB rejected" and "offline" look identical. Make it loud. |
| 5 | **CI-applied migrations** — `0013` sat unapplied because applying is manual. Add a deploy step (Supabase CLI `db push`, or a checked gate) so migrations can't lag the code. | The *process* fix that prevents the whole "silently on localStorage" class. |
| 6 | **Error monitoring** (Sentry or similar) on client + API routes. | You currently find bugs only when a user reports them. |
| 7 | **Delete / archive the stray Supabase project** `anfvgmlgsthhdhwncxzt` and re-point the MCP at the canonical project. | It's a footgun — the MCP keeps targeting the empty one. |
| 8 | **Decide + message collaboration semantics** (single-editor v1, or commit to Phase 3). | Sets user expectations honestly; avoids "my edits vanished" reports. |

## Phase 2 — Stabilize & maintainability (weeks; fund if this codebase has a long future)

From `docs/ARCHITECTURE_REFACTOR_PLAN.md` — all behavior-preserving, test-gated, one PR at a time:

- **Stage 5** — collapse the 11 near-identical `*Api.ts` persistence modules into one repo factory (`makeWorkbookRepo`); ~700–800 LOC removed, one place to own fallback semantics.
- **Stage 7** — split the 1,132-LOC `sheetStore` into slices; delete the dead `workbook`/undo/redo machinery (~100 LOC of misleading code).
- **Stage 8** — break up the god files (page 1,514 / grid 1,128 / ribbon 1,098) + a ribbon command registry (replaces the 62-field prop-drilled handler object).

## Phase 3 — Scale (only when usage/size demands it)

- **Off-blob persistence** — the whole-workbook JSON blob rewrites megabytes per 2s autosave and caps you around ~50k cells. The normalized `cells` table already exists (unused). Migrate via flagged dual-write → backfill → shadow-read → flip. Reversible per step.
- **Stage 4 typing performance** — collapse the per-keystroke clone/stringify/diff on the grid hot path (the riskiest perf work; its own session).
- **Real-time collaboration** — only meaningful after off-blob; needs cell-level merge (not the current last-writer-wins 409).

## Phase 4 — Product / feature parity

- **Triage the ~75 "coming soon" ribbon stubs** — decide per feature: build, or cut and remove the button. They're hidden in prod today, but the volume signals scope that outran delivery.
- **Deferred MVP items**: T020 Automation (UI + trigger firing), comments @-mention notifications, persisting CF rules / typed columns fully to Supabase.
- **Excel/Sheets parity gaps** worth closing early: empty-cell formatting feedback (improved by the font-size row-grow fix), and any control users actually reach.

---

## What I'd do, in order

1. **You:** paste `0013` → I confirm green. *(unblocks cloud persistence)*
2. **Me:** AI-route auth + durable rate limit. *(closes the cost/abuse hole)*
3. **You:** rotate the two leaked secrets.
4. **Me:** the visible "not syncing" banner (Phase 1 #4) — cheap, high-trust.
5. Then pick: **launch** (private→public) and fund Phase 2 as a steady background track, or go straight at Phase 3 if scale is the immediate goal.

The encouraging part: every blocker is small and well-understood, and the foundation (TS rigor, feature folders, CI, drift guard, optimistic concurrency, the fixes landed this cycle) is solid. This is a *finish-the-seams* situation, not a rebuild.
