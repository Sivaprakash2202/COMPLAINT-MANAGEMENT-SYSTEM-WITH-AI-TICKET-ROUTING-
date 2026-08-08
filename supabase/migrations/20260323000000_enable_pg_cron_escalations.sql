-- Enable the pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the check-escalations edge function to run every hour.
-- IMPORTANT: Replace 'YOUR_PROJECT_URL' and 'YOUR_SERVICE_ROLE_KEY' with your actual Supabase project URL and Service Role Key.
-- e.g., 'https://xyz.supabase.co/functions/v1/check-escalations'

SELECT cron.schedule(
  'invoke-check-escalations',
  '0 * * * *', -- Every hour at minute 0
  $$
    SELECT net.http_post(
      url := 'YOUR_PROJECT_URL/functions/v1/check-escalations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);
