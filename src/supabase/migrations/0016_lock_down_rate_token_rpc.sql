-- 0016 — fully lock down consume_ai_rate_token (applied to live DB via MCP).
--
-- 0015 did `revoke all ... from public`, but Supabase explicitly grants
-- anon/authenticated EXECUTE on public functions (separate from the PUBLIC
-- grant), so the security advisor still flagged the RPC as anon-callable. This
-- RPC is only ever called by the SERVER via the service-role client
-- (rateLimit.consumeTokenDurable) and is NOT referenced by any RLS policy
-- (unlike is_workbook_member/owner, which must stay executable by the querying
-- role), so revoking anon/authenticated is safe and breaks nothing.

revoke all on function public.consume_ai_rate_token(text, timestamptz, int) from anon, authenticated;
