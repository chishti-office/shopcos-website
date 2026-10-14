-- ============================================================
-- shopcos soft — Team Access Keys schema (Supabase)
-- Run this ONCE in the Supabase SQL editor (project: shopcos-soft)
-- ============================================================
-- Lets shop admins generate login keys for their team:
--   EDT-XXXX-XXXX → editor access (products, stock, rates)
--   SAL-XXXX-XXXX → salesman access (billing only)
-- The desktop software validates these keys on login.

CREATE TABLE IF NOT EXISTS public.access_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_code   TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('editor', 'salesman')),
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_access_keys_user ON public.access_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_access_keys_code ON public.access_keys(key_code);

ALTER TABLE public.access_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own access keys" ON public.access_keys;
CREATE POLICY "Users manage own access keys" ON public.access_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
