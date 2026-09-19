-- Phase 2 (partial, opened 2026-09-07): editable price list + payment-link
-- fields on invoices, for the "send payment link after visit" dashboard
-- feature. See CLAUDE.md decision log. Still no gateway webhook / automatic
-- payment-status sync — that stays out of scope for this pass.

CREATE TABLE public.price_list_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  name                text        NOT NULL CHECK (char_length(trim(name)) > 0),
  default_price       numeric(12, 2) NOT NULL CHECK (default_price >= 0),
  visit_type          text,
  active              boolean     NOT NULL DEFAULT true,
  created_by_user_id  uuid        REFERENCES auth.users (id),
  version             int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE TRIGGER price_list_items_set_updated_at
  BEFORE UPDATE ON public.price_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX price_list_items_clinic_active_idx
  ON public.price_list_items (clinic_id, active, name)
  WHERE deleted_at IS NULL;

ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_list_items_select_member ON public.price_list_items
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY price_list_items_insert_admin ON public.price_list_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));

CREATE POLICY price_list_items_update_admin ON public.price_list_items
  FOR UPDATE TO authenticated
  USING  (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));

-- Seed defaults from the existing hardcoded VISIT_PRICE map
-- (agent/src/lib/notifications.ts) for every clinic that already exists.
-- These become editable rows; the agent's own booking-confirmation SMS is
-- untouched and keeps using its own hardcoded map (separate, pre-visit
-- estimate flow vs. actual post-visit billing here).
INSERT INTO public.price_list_items (clinic_id, name, default_price, visit_type)
SELECT c.id, v.name, v.price, v.visit_type
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('checkup',            'בדיקה כללית',        150),
    ('home_visit',         'ביקור בית',           300),
    ('vaccination',        'חיסון',               150),
    ('phone_consultation', 'ייעוץ טלפוני',        200),
    ('neutering',          'עיקור/סירוס',         350),
    ('consultation',       'ייעוץ',               150),
    ('urgent',             'דחוף',                200),
    ('follow_up',          'ביקור חוזר',          150),
    ('other',              'אחר',                 150)
) AS v(visit_type, name, price);

-- invoices: payment-link fields populated once a payment link is generated
-- and sent via the new "send payment link" dashboard action.
ALTER TABLE public.invoices
  ADD COLUMN payment_link_url text,
  ADD COLUMN green_invoice_document_id text,
  ADD COLUMN payment_link_sent_at timestamptz;
