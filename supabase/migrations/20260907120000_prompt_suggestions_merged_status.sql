-- Supports the "consolidate all pending prompt suggestions into one" feature:
-- a new meta-suggestion row is created from N pending category='prompt'
-- suggestions, and those N originals are marked 'merged' (a new terminal
-- status) rather than staying pending or being deleted — merged_from_ids on
-- the new row documents the reverse relationship for auditing.
alter table public.tomer_prompt_suggestions drop constraint tomer_prompt_suggestions_status_check;
alter table public.tomer_prompt_suggestions add constraint tomer_prompt_suggestions_status_check
  check (status in ('pending', 'approved', 'rejected', 'published', 'failed_regression', 'merged'));

alter table public.tomer_prompt_suggestions add column merged_from_ids uuid[];

comment on column public.tomer_prompt_suggestions.merged_from_ids is
  'Populated only on a suggestion created by the "consolidate" action: the ids of the pending prompt-category suggestions it was merged from. Null for a normal, non-merged suggestion.';
