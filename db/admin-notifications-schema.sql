-- Admin notifications table (one-time run in Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anyone to insert (for payment attempt logging)
-- Allow only admin to read (via RLS or service role)
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert notifications"
  ON admin_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated can read notifications"
  ON admin_notifications FOR SELECT
  USING (auth.role() = 'authenticated');
