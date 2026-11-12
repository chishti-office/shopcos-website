-- shopcos admin panel upgrade: plan selection + shop name + phone on licenses
-- RUN THIS IN SUPABASE SQL EDITOR (one time, safe to re-run)
-- Adds the columns the admin panel's "Create lifetime license" form saves:
--   plan      — which plan the key was issued for (starter/business/professional/enterprise)
--   shop_name — the customer's shop / brand name
--   phone     — the customer's phone / WhatsApp number
-- (shop_name + phone are the same columns as db/licenses-shop-phone.sql;
--  this file supersedes it — running either one is enough.)

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT '';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS shop_name TEXT DEFAULT '';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
