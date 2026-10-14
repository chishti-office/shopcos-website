-- ============================================================
-- shopcos soft — User Profile schema (Supabase)
-- Run this in the Supabase SQL editor (project: shopcos-soft)
-- ============================================================

-- 1. Profiles table: business profile per user
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  owner_name    TEXT,
  mobile        TEXT,
  logo_url      TEXT,
  preferred_currency TEXT DEFAULT 'USD',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing installs (safe to run multiple times)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 2. Storage bucket for business logos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
CREATE POLICY "Public read logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Users can upload own logo" ON storage.objects;
CREATE POLICY "Users can upload own logo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own logo" ON storage.objects;
CREATE POLICY "Users can update own logo" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own logo" ON storage.objects;
CREATE POLICY "Users can delete own logo" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_profile_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_updated ON public.profiles;
CREATE TRIGGER trg_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_updated();
