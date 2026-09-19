-- Phase 2 RLS fix: allow soft-delete updates while keeping clinic scoping.
drop policy if exists customers_select_member on public.customers;
drop policy if exists pets_select_member on public.pets;

create policy customers_select_member on public.customers
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy pets_select_member on public.pets
  for select to authenticated
  using (public.is_clinic_member(clinic_id));
