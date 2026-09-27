-- Remote collection of finished human-vs-AI playtest battles.
--
-- Written only by the /api/playtest serverless function with a server-side
-- secret key, through submit_playtest(). Row-level security is enabled with no
-- policies, so the public anon/authenticated roles can neither read nor write.
-- No requester data (IP, headers, cookies, account) is stored.

create extension if not exists pgcrypto;

create table if not exists public.playtest_submissions (
  id                   uuid primary key default gen_random_uuid(),
  submission_id        uuid not null unique,
  revision             integer not null check (revision >= 1),
  battle_id            text not null check (battle_id ~ '^[-a-zA-Z0-9]{1,80}$'),
  created_at           timestamptz not null,
  received_at          timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  policy_id            text not null check (policy_id in ('v1.1-20m', 'v1.1-50m', 'v1.1-100m')),
  schema_version       text not null,
  research_log_version integer not null,
  result               text not null check (result in ('human_win', 'ai_win', 'tie')),
  turn_count           integer not null check (turn_count >= 0),
  flagged_turn_count   integer not null check (flagged_turn_count >= 0),
  has_feedback         boolean not null,
  app_commit           text,
  -- The complete finalized ResearchLog, unmodified.
  payload              jsonb not null
);

create index if not exists playtest_submissions_received_at_idx on public.playtest_submissions (received_at);
create index if not exists playtest_submissions_policy_id_idx on public.playtest_submissions (policy_id);
create index if not exists playtest_submissions_battle_id_idx on public.playtest_submissions (battle_id);

alter table public.playtest_submissions enable row level security;
revoke all on table public.playtest_submissions from anon, authenticated;
-- Explicit rather than relying on Supabase's default grants: the collector writes
-- through submit_playtest() and the export script reads with the secret key.
grant select, insert, update on table public.playtest_submissions to service_role;

-- Idempotent submit. The same (submission_id, revision) is a no-op duplicate; a
-- higher revision of the same battle (feedback or a flag added after the battle
-- ended) replaces the stored log in place; a submission_id reused for another
-- battle is a conflict. Returns 'inserted' | 'updated' | 'duplicate' | 'conflict'.
create or replace function public.submit_playtest(
  p_submission_id uuid, p_revision integer, p_battle_id text, p_created_at timestamptz,
  p_policy_id text, p_schema_version text, p_research_log_version integer, p_result text,
  p_turn_count integer, p_flagged_turn_count integer, p_has_feedback boolean,
  p_app_commit text, p_payload jsonb
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_battle text;
begin
  insert into public.playtest_submissions (
    submission_id, revision, battle_id, created_at, policy_id, schema_version, research_log_version,
    result, turn_count, flagged_turn_count, has_feedback, app_commit, payload
  ) values (
    p_submission_id, p_revision, p_battle_id, p_created_at, p_policy_id, p_schema_version, p_research_log_version,
    p_result, p_turn_count, p_flagged_turn_count, p_has_feedback, p_app_commit, p_payload
  ) on conflict (submission_id) do nothing;
  if found then return 'inserted'; end if;

  select battle_id into existing_battle from public.playtest_submissions where submission_id = p_submission_id;
  if existing_battle is distinct from p_battle_id then return 'conflict'; end if;

  update public.playtest_submissions set
    revision = p_revision, created_at = p_created_at, policy_id = p_policy_id, schema_version = p_schema_version,
    research_log_version = p_research_log_version, result = p_result, turn_count = p_turn_count,
    flagged_turn_count = p_flagged_turn_count, has_feedback = p_has_feedback, app_commit = p_app_commit,
    payload = p_payload, updated_at = now()
  where submission_id = p_submission_id and revision < p_revision;
  if found then return 'updated'; end if;
  return 'duplicate';
end;
$$;

revoke all on function public.submit_playtest(uuid, integer, text, timestamptz, text, text, integer, text, integer, integer, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_playtest(uuid, integer, text, timestamptz, text, text, integer, text, integer, integer, boolean, text, jsonb) to service_role;
