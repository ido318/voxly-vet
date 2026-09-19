-- pg_cron jobs for the cloud project. Run in the Supabase SQL editor after
-- replacing the two placeholders. Safe to re-run: each job is unscheduled first.
--
-- WHY THIS FILE EXISTS
-- The jobs were originally created by hand from a snippet that called
-- extensions.http_post(). That function does not exist in this project — pg_net
-- installs into the `net` schema — so every run since setup failed with:
--
--   ERROR: function extensions.http_post(url => unknown, headers => jsonb,
--          body => unknown) does not exist
--
-- pg_cron records the failure in cron.job_run_details and moves on, so the jobs
-- looked "active" while nothing ever ran: scheduled SMS (morning reminder,
-- arrival reminder, post-visit follow-up) piled up in notifications_log with
-- status 'pending', vaccination reminders never went out, and the weekly prompt
-- analysis never ran. Only the booking confirmation worked, because the agent
-- sends that one in-process rather than through the queue.
--
-- ON A BACKLOG: the processor now closes out any pending row whose scheduled_for
-- passed more than 12 hours ago, marking it 'skipped' rather than sending it (see
-- EXPIRY_MS in agent/src/services/notification.processor.ts). That guard exists
-- precisely for this script: enabling the jobs on a project that accumulated a
-- backlog while they were broken must not blast clients with morning reminders
-- for appointments that are already in the past. To see what would be closed out
-- before enabling:
--   select type, count(*) from public.notifications_log
--   where status = 'pending' and scheduled_for < now() - interval '12 hours'
--   group by type;
--
-- Check the jobs are actually working, rather than merely scheduled:
--   select jobid, status, return_message, start_time
--   from cron.job_run_details order by start_time desc limit 10;

-- Placeholders:
--   <AGENT_PUBLIC_URL>   e.g. https://your-agent.fly.dev  (no trailing slash)
--   <JOBS_BEARER_TOKEN>  agent/.env JOBS_BEARER_TOKEN

select cron.unschedule('process-sms-notifications')
where exists (select 1 from cron.job where jobname = 'process-sms-notifications');

select cron.schedule(
  'process-sms-notifications',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := '<AGENT_PUBLIC_URL>/jobs/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <JOBS_BEARER_TOKEN>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

select cron.unschedule('send-vaccination-reminders')
where exists (select 1 from cron.job where jobname = 'send-vaccination-reminders');

select cron.schedule(
  'send-vaccination-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := '<AGENT_PUBLIC_URL>/jobs/send-vaccination-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <JOBS_BEARER_TOKEN>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

select cron.unschedule('analyze-tomer-conversations')
where exists (select 1 from cron.job where jobname = 'analyze-tomer-conversations');

select cron.schedule(
  'analyze-tomer-conversations',
  '0 6 * * 0',
  $$
  select net.http_post(
    url     := '<AGENT_PUBLIC_URL>/jobs/analyze-conversations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <JOBS_BEARER_TOKEN>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb,
    -- 5 minutes, not pg_net's 5s default: /jobs/analyze-conversations awaits the
    -- full Claude pass over the week's flagged calls before it responds. Measured
    -- at ~4.5 minutes on 2026-09-18 (19 flagged calls, 38 groups). With a short
    -- timeout pg_net records "Timeout of N ms reached" while pg_cron still logs
    -- the job as 'succeeded' — the job looks healthy and its result is invisible.
    timeout_milliseconds := 300000
  );
  $$
);
