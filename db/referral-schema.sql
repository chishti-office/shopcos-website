-- ============================================================
-- shopcos soft — Referral system (Invite & Earn)
-- Run this ONCE in the Supabase SQL editor (project: shopcos-soft)
-- Model (decided by hina, 2026-11-03):
--   * Invited friend gets 10% OFF his first paid plan at checkout
--   * Referrer gets Rs 2,000 per PAID sale (order activated in admin)
--   * Free-trial signups earn NO reward (anti-fraud)
--   * A user cannot refer himself; one referral per new user
-- Safe to re-run.
-- ============================================================

-- 1) Invite code + who referred this user, stored on the license row
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_referral_code
  ON public.licenses (referral_code) WHERE referral_code IS NOT NULL;

-- 2) Referral tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_code    TEXT NOT NULL,
  referrer_email   TEXT,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email   TEXT,
  status           TEXT NOT NULL DEFAULT 'signed_up'
                     CHECK (status IN ('signed_up','paid','rewarded','rejected')),
  reward_pkr       NUMERIC(12,2) NOT NULL DEFAULT 2000,
  discount_percent NUMERIC(5,2)  NOT NULL DEFAULT 10,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at          TIMESTAMPTZ,
  rewarded_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status   ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referrer can see the people he invited
DROP POLICY IF EXISTS "referrer reads own referrals" ON public.referrals;
CREATE POLICY "referrer reads own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id);

-- The invited user can see his own referral row (checkout checks his 10% OFF)
DROP POLICY IF EXISTS "referred reads own referral" ON public.referrals;
CREATE POLICY "referred reads own referral" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referred_user_id);

-- Admin (COS official email) full access — view list + mark rewards paid
DROP POLICY IF EXISTS "admin full access referrals" ON public.referrals;
CREATE POLICY "admin full access referrals" ON public.referrals
  FOR ALL
  USING (auth.jwt() ->> 'email' = 'chishtioffice2@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'chishtioffice2@gmail.com');

-- NOTE: no public INSERT/UPDATE policy on purpose.
-- Rows are created/updated only through the SECURITY DEFINER functions
-- below, so nobody can fake a referral or a reward from the browser.

-- 3) Get (or create) the signed-in user's own invite code
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_code TEXT;
  v_try  INT := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT referral_code INTO v_code FROM public.licenses WHERE user_id = v_uid LIMIT 1;
  IF v_code IS NOT NULL AND v_code <> '' THEN RETURN v_code; END IF;

  -- No license row yet (trial not started) — nothing to attach the code to
  IF NOT EXISTS (SELECT 1 FROM public.licenses WHERE user_id = v_uid) THEN
    RETURN NULL;
  END IF;

  LOOP
    v_try := v_try + 1;
    v_code := 'SHOP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    BEGIN
      UPDATE public.licenses SET referral_code = v_code WHERE user_id = v_uid;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_try > 10 THEN RETURN NULL; END IF;
    END;
  END LOOP;
END;
$$;

-- 4) Claim a referral: the invited user calls this once after signup.
--    Returns: 'ok' | 'invalid' | 'self' | 'already' | 'noauth'
CREATE OR REPLACE FUNCTION public.claim_referral(p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_code     TEXT := upper(trim(coalesce(p_code, '')));
  v_ref_id   UUID;
  v_ref_mail TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN 'noauth'; END IF;
  IF v_code = '' THEN RETURN 'invalid'; END IF;

  -- One referral per user, ever
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = v_uid) THEN
    RETURN 'already';
  END IF;

  SELECT user_id, email INTO v_ref_id, v_ref_mail
  FROM public.licenses WHERE referral_code = v_code LIMIT 1;

  IF v_ref_id IS NULL THEN RETURN 'invalid'; END IF;
  IF v_ref_id = v_uid THEN RETURN 'self'; END IF;

  INSERT INTO public.referrals
    (referrer_user_id, referrer_code, referrer_email, referred_user_id, referred_email)
  VALUES
    (v_ref_id, v_code, v_ref_mail, v_uid,
     (SELECT email FROM public.licenses WHERE user_id = v_uid LIMIT 1));

  UPDATE public.licenses SET referred_by_code = v_code WHERE user_id = v_uid;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(TEXT) TO authenticated;

-- 5) Reward unlock: when an order is marked paid/activated in the admin
--    panel, the referral flips to 'paid' (= Rs 2,000 owed to the referrer).
--    Admin then pays it (Easypaisa/JazzCash) and marks it 'rewarded'.
CREATE OR REPLACE FUNCTION public.referrals_on_order_activated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paid','activated')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('paid','activated')) THEN
    UPDATE public.referrals
       SET status = 'paid', paid_at = NOW()
     WHERE referred_user_id = NEW.user_id
       AND status = 'signed_up';
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger only if the orders table exists (it is created by
-- db/orders-schema.sql). If orders is missing, this block is skipped
-- instead of failing the whole script — run orders-schema.sql first,
-- then re-run this file and the trigger will be created.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_referrals_order_activated ON public.orders';
    EXECUTE 'CREATE TRIGGER trg_referrals_order_activated
               AFTER UPDATE ON public.orders
               FOR EACH ROW EXECUTE FUNCTION public.referrals_on_order_activated()';
  END IF;
END $$;
