# PIMS Foundation Alignment

Phase 0 aligns the PIMS product specification in `NOA_VET_SYSTEM_SPEC.md` with
the entities and architecture that already exist in this repository.

This document is documentation-only. It does not introduce code changes,
database migrations, schema changes, environment variable changes, or Phase 1
implementation work.

## Entity Mapping

| PIMS spec term | Existing codebase term | Notes |
| --- | --- | --- |
| `owners` | `customers` | The existing customer record represents the pet owner/client. Do not create a parallel `owners` table. |
| `staff/users` | `profiles` + `clinic_memberships` | Staff identity and clinic-scoped membership are already modeled through these tables. |
| `phone_calls` | `voice_calls` | Inbound and post-call voice agent records are stored as `voice_calls`. Do not create a parallel `phone_calls` table. |
| `clinical_notes` | `medical_notes` | Clinical note concepts in the spec map to the existing `medical_notes` naming. |

## Backend Architecture

The application continues to use the existing layered backend architecture:

```text
Route Handlers -> Services -> Repositories -> Supabase
```

API route handlers should remain thin entry points that authenticate, validate,
call services, and return responses. Services should contain application logic.
Repositories should remain the data access boundary for Supabase.

## tRPC

Although `NOA_VET_SYSTEM_SPEC.md` lists tRPC as part of the preferred long-term
stack, Phase 0 does not add tRPC.

The current Route Handlers -> Services -> Repositories -> Supabase pattern
remains the implementation baseline for this phase.

## Explicit Non-Scope

Phase 0 does not include:

- Phase 1 implementation.
- Database migrations.
- Schema changes.
- `.env` changes.
- Renaming existing tables.
- Creating duplicate tables such as `owners` or `phone_calls`.
- Adding a smoke test.
- Any code changes beyond creating this documentation file.
