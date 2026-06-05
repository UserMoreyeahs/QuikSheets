-- 0014 — pin search_path on functions flagged by the Supabase security advisor
-- (lint 0011_function_search_path_mutable). Applied to the live DB via MCP.
--
-- A SECURITY DEFINER function with a mutable search_path can be hijacked by a
-- caller manipulating search_path to resolve an unqualified object to an
-- attacker-controlled one. Pinning to `public` closes that. The two trigger
-- functions are SECURITY INVOKER (lower risk) but pinned too to clear the lint.
--
-- NOT addressed here (intentionally): the advisor's "Public/Signed-in can
-- execute SECURITY DEFINER function" warnings on is_workbook_member/owner,
-- is_workspace_member/owner, quiksheets_bootstrap_user. Its suggested fix
-- (revoke EXECUTE) would BREAK RLS — those helpers are called *by* the RLS
-- policies, evaluated as the querying role, so the role must retain EXECUTE.
-- They return only membership booleans (low disclosure risk); accepted.
--
-- Idempotent: re-running ALTER ... SET is a no-op.

alter function public.is_workbook_member(p_workbook_id uuid) set search_path = public;
alter function public.is_workbook_owner(p_workbook_id uuid)  set search_path = public;
alter function public.quiksheets_set_updated_at()            set search_path = public;
alter function public.row_visibility_rules_set_updated_at()  set search_path = public;
