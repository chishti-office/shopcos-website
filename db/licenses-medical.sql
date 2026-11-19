-- shopcos admin: Medical edition activation flag on licenses.
-- Run ONCE in Supabase SQL Editor (chishtioffice2@gmail.com project).
-- The admin panel's "💊 Medical" toggle and the software's cloud license
-- sync both read this column. Default false = Medical stays locked until
-- COS activates it for that customer from the admin panel.
alter table public.licenses
  add column if not exists medical boolean not null default false;
