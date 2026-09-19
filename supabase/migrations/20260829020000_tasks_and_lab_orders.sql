-- Phase 6 (Figma redesign): tasks inbox + laboratory dashboard.
-- Both greenfield - operational records any clinic member can manage
-- (mirrors the visits/medical_notes "member" RLS pattern, not the
-- owner/admin-restricted pattern used for calendar_blocks/invoices).

CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.task_status AS ENUM ('open', 'done');

CREATE TABLE public.tasks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  title         text        NOT NULL CHECK (char_length(trim(title)) > 0),
  description   text,
  priority      public.task_priority NOT NULL DEFAULT 'medium',
  status        public.task_status NOT NULL DEFAULT 'open',
  due_at        timestamptz,
  assignee_user_id uuid      REFERENCES auth.users (id),
  customer_id   uuid,
  pet_id        uuid,
  created_by_user_id uuid    REFERENCES auth.users (id),
  version       int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT tasks_customer_clinic_fk
    FOREIGN KEY (customer_id, clinic_id)
    REFERENCES public.customers (id, clinic_id) ON DELETE RESTRICT,
  CONSTRAINT tasks_pet_clinic_fk
    FOREIGN KEY (pet_id, clinic_id)
    REFERENCES public.pets (id, clinic_id) ON DELETE RESTRICT
);

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tasks_clinic_status_idx ON public.tasks (clinic_id, status, due_at);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_select_member ON public.tasks
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY tasks_insert_member ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_member(clinic_id));

CREATE POLICY tasks_update_member ON public.tasks
  FOR UPDATE TO authenticated
  USING  (public.is_clinic_member(clinic_id))
  WITH CHECK (public.is_clinic_member(clinic_id));

CREATE POLICY tasks_delete_member ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_clinic_member(clinic_id));

-- ─────────────────────────────────────────────────────────────

CREATE TYPE public.lab_order_status AS ENUM ('ordered', 'in_progress', 'completed');

CREATE TABLE public.lab_orders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  customer_id   uuid        NOT NULL,
  pet_id        uuid        NOT NULL,
  visit_id      uuid,
  test_name     text        NOT NULL CHECK (char_length(trim(test_name)) > 0),
  status        public.lab_order_status NOT NULL DEFAULT 'ordered',
  result_text   text,
  flagged       boolean     NOT NULL DEFAULT false,
  ordered_by_user_id uuid   REFERENCES auth.users (id),
  ordered_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  version       int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT lab_orders_customer_clinic_fk
    FOREIGN KEY (customer_id, clinic_id)
    REFERENCES public.customers (id, clinic_id) ON DELETE RESTRICT,
  CONSTRAINT lab_orders_pet_clinic_fk
    FOREIGN KEY (pet_id, clinic_id)
    REFERENCES public.pets (id, clinic_id) ON DELETE RESTRICT,
  CONSTRAINT lab_orders_visit_clinic_fk
    FOREIGN KEY (visit_id, clinic_id)
    REFERENCES public.visits (id, clinic_id) ON DELETE SET NULL
);

CREATE TRIGGER lab_orders_set_updated_at
  BEFORE UPDATE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX lab_orders_clinic_status_idx ON public.lab_orders (clinic_id, status, ordered_at DESC);
CREATE INDEX lab_orders_clinic_pet_idx ON public.lab_orders (clinic_id, pet_id);

ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_orders_select_member ON public.lab_orders
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY lab_orders_insert_member ON public.lab_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_member(clinic_id));

CREATE POLICY lab_orders_update_member ON public.lab_orders
  FOR UPDATE TO authenticated
  USING  (public.is_clinic_member(clinic_id))
  WITH CHECK (public.is_clinic_member(clinic_id));

CREATE POLICY lab_orders_delete_member ON public.lab_orders
  FOR DELETE TO authenticated
  USING (public.is_clinic_member(clinic_id));
