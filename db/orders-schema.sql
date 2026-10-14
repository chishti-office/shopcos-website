-- ============================================================
-- shopcos soft — ORDERS table (professional checkout)
-- Run this in Supabase SQL Editor (project: shopcos-soft)
-- ============================================================

-- 1. Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('starter','business','professional','enterprise')),
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_pkr NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card','crypto','bank','easypaisa','jazzcash')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','activated','rejected')),
  proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);

-- 2. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Users can create their own orders
DROP POLICY IF EXISTS "users insert own orders" ON public.orders;
CREATE POLICY "users insert own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own orders
DROP POLICY IF EXISTS "users read own orders" ON public.orders;
CREATE POLICY "users read own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- Admin (hina) has full access to all orders
DROP POLICY IF EXISTS "admin full access orders" ON public.orders;
CREATE POLICY "admin full access orders" ON public.orders
  FOR ALL USING (auth.jwt() ->> 'email' = 'chishtioffice2@gmail.com');

-- 4. Storage bucket for payment proof screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload their own proof files
DROP POLICY IF EXISTS "users upload proofs" ON storage.objects;
CREATE POLICY "users upload proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can read their own proof files
DROP POLICY IF EXISTS "users read own proofs" ON storage.objects;
CREATE POLICY "users read own proofs" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admin can read all proof files
DROP POLICY IF EXISTS "admin read all proofs" ON storage.objects;
CREATE POLICY "admin read all proofs" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.jwt() ->> 'email' = 'chishtioffice2@gmail.com');

-- 5. Auto-update updated_at
DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE OR REPLACE FUNCTION public.touch_orders_updated()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_orders_updated();
