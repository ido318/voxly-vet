# RLS Policy Matrix

## Implemented in Phases 1-2

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | own row | via auth trigger | own row | — |
| `clinics` | clinic members | service/bootstrap only | owner/admin | — |
| `clinic_memberships` | own + clinic admin | clinic admin | clinic admin | clinic admin |
| `audit_logs` | clinic members | service role only | — | — |
| `ai_events` | clinic members | service role only | — | — |
| `customers` | clinic members | clinic members | clinic members | clinic members |
| `pets` | clinic members | clinic members | clinic members | clinic members |
| `appointments` | clinic members | clinic members | clinic members | clinic members |
| `visits` | clinic members | clinic members | clinic members | clinic members |

Phase 5 adds `ai_visit_summary`, `ai_summary_generated_at`, `ai_summary_accepted_by_user_id` on `visits` (same RLS). AI generate/accept is restricted in services to `owner`, `admin`, `veterinarian`.
| `medical_notes` | clinic members | clinic members | clinic members | clinic members |
| `vaccinations` | clinic members | clinic members | clinic members | clinic members |
| `prescriptions` | clinic members | clinic members | clinic members | clinic members |
| `voice_calls` | clinic members | service role only | service role only | — |

Phase 6: Twilio inbound webhooks write via service role; dashboard reads via authenticated RLS. Customer matching uses `customers.phone`.

## Notes

- Soft delete is implemented via `deleted_at` update in service/repository layer.
- Medical soft delete additionally requires elevated role (`owner`, `admin`, `veterinarian`) in services — not only RLS.
- Customer/pet reads filter out `deleted_at` rows in repository queries.
- Cross-clinic pet/customer mismatch is blocked by DB composite FK and service-layer validation.

## Planned for future phases (not implemented)

| Table | SELECT | INSERT/UPDATE | Notes |
|-------|--------|---------------|-------|
| `invoices` / `payments` | clinic members | admin/service | audit required |
| `documents` | clinic members | service | visit packages later |

All future tables must include `clinic_id` and use `is_clinic_member(clinic_id)` or role helpers.
