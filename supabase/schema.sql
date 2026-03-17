-- ============================================================
-- Thesis Tracker — Supabase Schema
-- Run this in your Supabase project → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── Supervisors ──────────────────────────────────────────────
create table if not exists supervisors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  department  text,
  created_at  timestamptz default now()
);

-- ── Students ─────────────────────────────────────────────────
create table if not exists students (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            text not null unique,
  student_id       text,
  program          text,
  thesis_title     text,
  supervisor_id    uuid references supervisors(id) on delete set null,
  enrollment_year  int default extract(year from now()),
  token            text unique default gen_random_uuid()::text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── Student Milestones ───────────────────────────────────────
create table if not exists student_milestones (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  milestone_id text not null,   -- matches MILESTONES[].id in JS
  status       text not null default 'pending'
                check (status in ('pending','in_progress','completed','overdue')),
  due_date     date,
  completed_at timestamptz,
  notes        text,
  updated_at   timestamptz default now(),
  unique (student_id, milestone_id)
);

-- ── Email Log ────────────────────────────────────────────────
create table if not exists email_log (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid references students(id) on delete cascade,
  recipient_type  text default 'student',   -- 'student' | 'supervisor'
  subject         text,
  template        text,
  milestone_id    text,
  sent_at         timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────
-- For a coordinator-only dashboard, simplest approach is to
-- allow anon reads/writes (protected by obscurity of the URL).
-- For production, add auth and restrict to authenticated users.

alter table supervisors       enable row level security;
alter table students          enable row level security;
alter table student_milestones enable row level security;
alter table email_log         enable row level security;

-- Allow full access for anon key (dashboard usage without auth)
create policy "anon full access supervisors"
  on supervisors for all using (true) with check (true);

create policy "anon full access students"
  on students for all using (true) with check (true);

create policy "anon full access milestones"
  on student_milestones for all using (true) with check (true);

create policy "anon full access email_log"
  on email_log for all using (true) with check (true);

-- ── Updated_at trigger ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger students_updated_at
  before update on students
  for each row execute function update_updated_at();

create trigger milestones_updated_at
  before update on student_milestones
  for each row execute function update_updated_at();

-- ── Sample data (optional — delete before production) ────────
-- insert into supervisors (name, email, department) values
--   ('Dr. Ahmed Al-Mansouri', 'a.almansouri@university.edu', 'Computer Science'),
--   ('Prof. Sara Hassan', 's.hassan@university.edu', 'Information Systems');
