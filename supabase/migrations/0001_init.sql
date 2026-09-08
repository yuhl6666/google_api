-- Side-job-to-succession matching platform: initial schema.
--
-- Design notes:
-- - Table/column names are snake_case (Postgres convention); the JSONB blob
--   columns (score_breakdown, reviews, continuation_intent, phase_entered_at)
--   keep the same camelCase shape the frontend already uses, so the API
--   layer only has to translate at the edges.
-- - talents/companies use the Supabase Auth user id as their primary key
--   (one profile per auth user), same as the previous Firestore design.
-- - There is no backend server: the frontend computes scores client-side
--   (see frontend/src/calc) and writes the result directly here. Row Level
--   Security policies + a couple of guard triggers are what stands in for
--   the old Cloud Functions validation layer.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- profiles: which role (talent | company) each auth user registered as.
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('talent', 'company')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: select own" on profiles
  for select to authenticated
  using (auth.uid() = id);

create policy "profiles: insert own" on profiles
  for insert to authenticated
  with check (auth.uid() = id);
-- No update/delete policy: role is immutable once set.

-- ---------------------------------------------------------------------
-- talents
-- ---------------------------------------------------------------------
create table talents (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  skills text[] not null default '{}',
  interested_industries text[] not null default '{}',
  weekly_available_hours numeric not null default 0,
  work_style text not null check (work_style in ('remote', 'onsite', 'both')),
  relocatable boolean not null default false,
  prefecture text not null,
  succession_interest_level smallint not null check (succession_interest_level between 1 and 5),
  funding_capacity numeric not null default 0,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table talents enable row level security;

create policy "talents: select all" on talents
  for select to authenticated
  using (true); -- companies need to browse talents

create policy "talents: insert own" on talents
  for insert to authenticated
  with check (
    auth.uid() = id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'talent')
  );

create policy "talents: update own" on talents
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger talents_set_updated_at
  before update on talents
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------
create table companies (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  industry text not null,
  prefecture text not null,
  overview text not null default '',
  financial_health text not null check (financial_health in ('good', 'average', 'needs_improvement')),
  wanted_persona_tags text[] not null default '{}',
  wanted_persona_tag_weights jsonb not null default '{}'::jsonb,
  side_job_acceptable boolean not null default true,
  required_weekly_hours_min numeric not null default 0,
  required_weekly_hours_max numeric not null default 0,
  succession_timeframe text not null check (succession_timeframe in ('immediate', '1-3y', '3-5y', '5y+')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table companies enable row level security;

create policy "companies: select all" on companies
  for select to authenticated
  using (true); -- talents need to browse companies

create policy "companies: insert own" on companies
  for insert to authenticated
  with check (
    auth.uid() = id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'company')
  );

create policy "companies: update own" on companies
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger companies_set_updated_at
  before update on companies
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------
create table matches (
  id uuid primary key default gen_random_uuid(),
  talent_id uuid not null references talents (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  phase smallint not null default 1 check (phase in (1, 2, 3)),
  status text not null default 'active' check (status in ('active', 'declined', 'completed')),
  score_breakdown jsonb not null default '{}'::jsonb,
  reviews jsonb not null default '{}'::jsonb,
  continuation_intent jsonb not null default '{}'::jsonb,
  phase_entered_at jsonb not null default '{}'::jsonb,
  message_count integer not null default 0,
  first_message_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (talent_id, company_id)
);

create index matches_talent_id_idx on matches (talent_id);
create index matches_company_id_idx on matches (company_id);

alter table matches enable row level security;

create policy "matches: select participant" on matches
  for select to authenticated
  using (auth.uid() = talent_id or auth.uid() = company_id);

create policy "matches: insert participant" on matches
  for insert to authenticated
  with check (auth.uid() = talent_id or auth.uid() = company_id);

create policy "matches: update participant" on matches
  for update to authenticated
  using (auth.uid() = talent_id or auth.uid() = company_id)
  with check (auth.uid() = talent_id or auth.uid() = company_id);
-- No delete policy: matches are never removed, only declined/completed.

-- New matches always start clean at phase 1 regardless of what the client
-- sends, so a client can't create itself a fast-track to phase 3.
create or replace function guard_match_insert() returns trigger
  language plpgsql as $$
begin
  new.phase := 1;
  new.status := 'active';
  new.reviews := '{}'::jsonb;
  new.continuation_intent := '{}'::jsonb;
  new.message_count := 0;
  new.first_message_at := null;
  new.last_message_at := null;
  new.phase_entered_at := jsonb_build_object('1', to_jsonb(now()));
  return new;
end;
$$;

create trigger matches_guard_insert
  before insert on matches
  for each row execute function guard_match_insert();

-- Once a match leaves phase 1, only a step-by-step phase advance or a
-- terminal status change is allowed, and each side may only edit the half
-- of the shared JSON fields (reviews / continuation intent) that belongs to
-- them — this is the RLS-era stand-in for what the old Cloud Functions
-- callables validated server-side.
create or replace function guard_match_update() returns trigger
  language plpgsql as $$
begin
  if new.talent_id <> old.talent_id or new.company_id <> old.company_id then
    raise exception 'talent_id/company_id are immutable';
  end if;

  if old.status <> 'active' and new is distinct from old then
    raise exception 'match % is no longer active', old.id;
  end if;

  if new.phase <> old.phase then
    if new.status <> 'active' or new.phase <> old.phase + 1 then
      raise exception 'invalid phase transition % -> %', old.phase, new.phase;
    end if;
  end if;

  if auth.uid() = old.talent_id then
    if (new.reviews ->> 'companyRating') is distinct from (old.reviews ->> 'companyRating')
       or (new.reviews ->> 'companyComment') is distinct from (old.reviews ->> 'companyComment') then
      raise exception 'talent may not modify the company review';
    end if;
    if (new.continuation_intent ->> 'company') is distinct from (old.continuation_intent ->> 'company') then
      raise exception 'talent may not modify the company continuation intent';
    end if;
  elsif auth.uid() = old.company_id then
    if (new.reviews ->> 'talentRating') is distinct from (old.reviews ->> 'talentRating')
       or (new.reviews ->> 'talentComment') is distinct from (old.reviews ->> 'talentComment') then
      raise exception 'company may not modify the talent review';
    end if;
    if (new.continuation_intent ->> 'talent') is distinct from (old.continuation_intent ->> 'talent') then
      raise exception 'company may not modify the talent continuation intent';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger matches_guard_update
  before update on matches
  for each row execute function guard_match_update();

-- ---------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null check (sender_role in ('talent', 'company')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_match_id_created_at_idx on messages (match_id, created_at);

alter table messages enable row level security;

create policy "messages: select participant" on messages
  for select to authenticated
  using (
    exists (
      select 1 from matches m
      where m.id = messages.match_id
        and (m.talent_id = auth.uid() or m.company_id = auth.uid())
    )
  );

create policy "messages: insert participant" on messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from matches m
      where m.id = messages.match_id
        and (m.talent_id = auth.uid() or m.company_id = auth.uid())
        and m.status = 'active'
    )
  );
-- No update/delete policy: messages are an immutable log.

-- Keeps matches.message_count / first_message_at / last_message_at in sync
-- automatically — this used to be a Cloud Function transaction, now it's
-- just a trigger, and it's actually more robust (can't drift out of sync).
create or replace function bump_match_on_message() returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
begin
  update matches
  set message_count = message_count + 1,
      first_message_at = coalesce(first_message_at, new.created_at),
      last_message_at = new.created_at
  where id = new.match_id;
  return new;
end;
$$;

create trigger messages_bump_match
  after insert on messages
  for each row execute function bump_match_on_message();

-- ---------------------------------------------------------------------
-- phase_history
-- ---------------------------------------------------------------------
create table phase_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  from_phase smallint,
  to_phase text not null, -- '1' | '2' | '3' | 'declined' | 'completed'
  reason text not null default '',
  changed_by uuid not null,
  score_at_change numeric not null default 0,
  created_at timestamptz not null default now()
);

create index phase_history_match_id_created_at_idx on phase_history (match_id, created_at);

alter table phase_history enable row level security;

create policy "phase_history: select participant" on phase_history
  for select to authenticated
  using (
    exists (
      select 1 from matches m
      where m.id = phase_history.match_id
        and (m.talent_id = auth.uid() or m.company_id = auth.uid())
    )
  );

create policy "phase_history: insert participant" on phase_history
  for insert to authenticated
  with check (
    changed_by = auth.uid()
    and exists (
      select 1 from matches m
      where m.id = phase_history.match_id
        and (m.talent_id = auth.uid() or m.company_id = auth.uid())
    )
  );
-- No update/delete policy: history is an immutable log.

-- ---------------------------------------------------------------------
-- Table-level grants. RLS policies above restrict *which rows*; these
-- grants restrict *which commands* a role may attempt at all. anon (never
-- signed in) gets nothing — every table requires authentication.
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert on profiles to authenticated;
grant select, insert, update on talents to authenticated;
grant select, insert, update on companies to authenticated;
grant select, insert, update on matches to authenticated;
grant select, insert on messages to authenticated;
grant select, insert on phase_history to authenticated;
