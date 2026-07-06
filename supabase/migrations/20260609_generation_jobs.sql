-- Generation jobs table for async processing
-- OpenAI image edits can take 60-180s, exceeding serverless limits.
-- We use EdgeRuntime.waitUntil() to process in background and store results here.

create table if not exists public.generation_jobs (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'pending'
                check (status in ('pending', 'processing', 'completed', 'failed')),
  model_id    text,
  style_id    uuid references public.styles(id) on delete set null,
  result_url  text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row-level security: anyone can read their own job by ID (no auth needed — job ID is the secret)
alter table public.generation_jobs enable row level security;

create policy "Anyone can read job by id"
  on public.generation_jobs for select
  using (true);

-- Service role can do everything (edge function uses service key)
create policy "Service role full access"
  on public.generation_jobs for all
  using (true)
  with check (true);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists generation_jobs_updated_at on public.generation_jobs;
create trigger generation_jobs_updated_at
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();

-- Index for fast status polling
create index if not exists generation_jobs_status_idx on public.generation_jobs(status);
