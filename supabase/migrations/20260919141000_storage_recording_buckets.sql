-- Idempotent creation of private recording buckets.
-- Policies were already registered in 20260612000017 (call-recordings) and
-- 20260901224417 (soap-recordings); those policies key off bucket_id and
-- remain valid once the buckets exist.

insert into storage.buckets (id, name, public, file_size_limit)
select 'call-recordings', 'call-recordings', false, 52428800
where not exists (select 1 from storage.buckets where id = 'call-recordings');

insert into storage.buckets (id, name, public, file_size_limit)
select 'soap-recordings', 'soap-recordings', false, 52428800
where not exists (select 1 from storage.buckets where id = 'soap-recordings');
