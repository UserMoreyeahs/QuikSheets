-- 0015 — durable, cross-instance rate limiter for the public AI routes.
-- Applied to the live DB via MCP.
--
-- The 8 /api/ai/* routes are public (no auth) and were capped only by an
-- in-memory token bucket (src/lib/rateLimit.ts) — which on Vercel caps PER
-- serverless instance (effective limit = limit × instanceCount, reset on cold
-- start). This fixed-window counter caps GLOBALLY. consumeTokenDurable() calls
-- the RPC via the service-role client and falls back to the in-memory bucket if
-- the service-role isn't configured or the RPC errors (fail-safe).

create table if not exists public.ai_rate_limits (
  bucket_key   text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket_key, window_start)
);

-- RLS on, NO policies: only the service-role (bypasses RLS) touches this.
alter table public.ai_rate_limits enable row level security;

create or replace function public.consume_ai_rate_token(p_key text, p_window timestamptz, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare cur int;
begin
  insert into public.ai_rate_limits(bucket_key, window_start, hits)
  values (p_key, p_window, 1)
  on conflict (bucket_key, window_start)
  do update set hits = public.ai_rate_limits.hits + 1
  returning hits into cur;
  delete from public.ai_rate_limits where bucket_key = p_key and window_start < p_window - interval '1 hour';
  return cur <= p_limit;
end;
$$;

-- Server-only: not exposed via public REST RPC.
revoke all on function public.consume_ai_rate_token(text, timestamptz, int) from public;
grant execute on function public.consume_ai_rate_token(text, timestamptz, int) to service_role;
