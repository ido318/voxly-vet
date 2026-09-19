-- Phase 1: enum additions only.
-- Keep enum additions separate from constraints that use the new values so
-- Postgres can commit the enum changes before they are referenced.

ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'in_visit';
