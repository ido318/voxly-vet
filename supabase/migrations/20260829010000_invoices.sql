-- Phase 4 (Figma redesign): invoices — UI-only billing, no payment processing.
-- Line items stored as jsonb (no separate line_items table — simple enough
-- for a manual invoice, and this is explicitly not a payments/pricing engine).

CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'void');

CREATE TABLE public.invoices (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  customer_id     uuid        NOT NULL,
  pet_id          uuid,
  invoice_number  text        NOT NULL,
  status          public.invoice_status NOT NULL DEFAULT 'draft',
  issued_at       timestamptz NOT NULL DEFAULT now(),
  items           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  total           numeric(10, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes           text,
  created_by_user_id uuid     REFERENCES auth.users (id),
  version         int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT invoices_clinic_number_unique UNIQUE (clinic_id, invoice_number),
  CONSTRAINT invoices_customer_clinic_fk
    FOREIGN KEY (customer_id, clinic_id)
    REFERENCES public.customers (id, clinic_id) ON DELETE RESTRICT,
  CONSTRAINT invoices_pet_clinic_fk
    FOREIGN KEY (pet_id, clinic_id)
    REFERENCES public.pets (id, clinic_id) ON DELETE RESTRICT
);

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX invoices_clinic_customer_idx ON public.invoices (clinic_id, customer_id, issued_at DESC);
CREATE INDEX invoices_clinic_pet_idx ON public.invoices (clinic_id, pet_id) WHERE pet_id IS NOT NULL;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select_member ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY invoices_insert_admin ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));

CREATE POLICY invoices_update_admin ON public.invoices
  FOR UPDATE TO authenticated
  USING  (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));
