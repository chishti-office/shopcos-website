-- shopcos: activation requests — the client picks a category (general/medical)
-- and a plan inside the software (Settings → Plan request, or POST
-- /api/activation/request); the request lands here and the COS admin approves
-- or rejects it from the admin panel (Activation Requests section).
-- Approval writes the license (plan + medical flag) for that email; the
-- software's normal license sync then unlocks the right portion on the
-- client's next refresh.
-- Run once in the Supabase SQL editor (project: shopcos-soft).
-- NOTE: this supersedes db/plan-requests.sql (same flow, renamed table).

create table if not exists public.activation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  shop_name text,
  phone text,
  category text not null check (category in ('general', 'medical')),
  plan text not null check (plan in ('starter', 'business', 'professional', 'enterprise')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.activation_requests enable row level security;

-- clients: create + read only their OWN requests
drop policy if exists "activation_requests_insert_own" on public.activation_requests;
create policy "activation_requests_insert_own" on public.activation_requests
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "activation_requests_select_own" on public.activation_requests;
create policy "activation_requests_select_own" on public.activation_requests
  for select to authenticated using (auth.uid() = user_id);

-- COS admin (chishtioffice2@gmail.com): read + decide ALL requests
drop policy if exists "activation_requests_admin_select" on public.activation_requests;
create policy "activation_requests_admin_select" on public.activation_requests
  for select to authenticated using ((auth.jwt() ->> 'email') = 'chishtioffice2@gmail.com');
drop policy if exists "activation_requests_admin_update" on public.activation_requests;
create policy "activation_requests_admin_update" on public.activation_requests
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'chishtioffice2@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'chishtioffice2@gmail.com');
