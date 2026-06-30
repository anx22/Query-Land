-- Allow the "webhook" delivery channel for report deliveries and schedules.
-- Webhook delivery needs no external provider (the app just POSTs the report JSON to a URL), so it
-- is the zero-setup path to real report delivery alongside email (Resend). PGlite + Neon are both
-- Postgres, so altering the CHECK constraints works in tests, local and prod alike.
ALTER TABLE report_deliveries DROP CONSTRAINT IF EXISTS report_deliveries_channel_check;
ALTER TABLE report_deliveries ADD CONSTRAINT report_deliveries_channel_check CHECK (channel IN ('email', 'slack', 'webhook'));

ALTER TABLE report_schedules DROP CONSTRAINT IF EXISTS report_schedules_channel_check;
ALTER TABLE report_schedules ADD CONSTRAINT report_schedules_channel_check CHECK (channel IN ('email', 'slack', 'webhook'));
