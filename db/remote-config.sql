-- shopcos: remote config — the COS admin creates configs from the website
-- admin panel (shopcos.shop/admin → "📢 Remote Config"); the configs land
-- here and the shopcos software polls this table every 5 minutes with the
-- public anon key (when online) and applies them automatically.
-- Configs are matched per shop: license_key NULL means global (all shops),
-- otherwise the config applies only to the shop with that license key.
-- Run once in the Supabase SQL editor (project: shopcos-soft).

create table if not exists public.remote_config (
  id uuid primary key default gen_random_uuid(),
  license_key text,
  config_key text not null,
  config_value jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.remote_config enable row level security;

-- software (anon key): read only ACTIVE configs
drop policy if exists "remote_config_anon_select" on public.remote_config;
create policy "remote_config_anon_select" on public.remote_config
  for select to anon using (active = true);

-- COS admin (chishtioffice2@gmail.com): read + manage ALL configs
drop policy if exists "remote_config_admin_select" on public.remote_config;
create policy "remote_config_admin_select" on public.remote_config
  for select to authenticated using ((auth.jwt() ->> 'email') = 'chishtioffice2@gmail.com');
drop policy if exists "remote_config_admin_insert" on public.remote_config;
create policy "remote_config_admin_insert" on public.remote_config
  for insert to authenticated with check ((auth.jwt() ->> 'email') = 'chishtioffice2@gmail.com');
drop policy if exists "remote_config_admin_update" on public.remote_config;
create policy "remote_config_admin_update" on public.remote_config
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'chishtioffice2@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'chishtioffice2@gmail.com');
drop policy if exists "remote_config_admin_delete" on public.remote_config;
create policy "remote_config_admin_delete" on public.remote_config
  for delete to authenticated using ((auth.jwt() ->> 'email') = 'chishtioffice2@gmail.com');
