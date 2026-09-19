# Voxly Vet — Veterinary Clinic Management System + AI Receptionist

A complete practice-management system for a veterinary clinic, with a Hebrew AI voice agent built into it. The clinic team runs the day from the dashboard; the AI agent answers the phone, works against the same database in real time, and hands off to a human when it matters.

[![CI](https://github.com/ido318/voxly-vet/actions/workflows/ci.yml/badge.svg)](https://github.com/ido318/voxly-vet/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

## The problem

A small clinic runs on phone calls, a paper-ish calendar and the vet's memory. Calls get missed while the vet is in the treatment room. Bookings, reminders, invoices and follow-ups are manual. Urgent cases wait in the same queue as "is my dog's vaccine due?".

## What I built

I mapped the clinic's day end-to-end — intake call → booking → arrival → visit → treatment notes → billing → follow-up — and built one system that covers it, then put an AI agent on the phone line that operates inside that same system.

### 1. Clinic management system (the dashboard)

| Area | What it does |
|---|---|
| **Today** | Live view of today's appointments, arrivals, open escalations and pending tasks |
| **Clients & pets** | Customer 360: pets, visit history, contact log, tags, duplicate detection |
| **Calendar & appointments** | Booking with approval flow, check-in, overlap protection, calendar blocks, waitlist |
| **Visit workspace** | Anamnesis → exam → vitals → SOAP notes (typed or voice-dictated + AI-structured) → prescriptions → charges → close |
| **Medical records** | Timeline per pet, problem list, locked notes with addendums, AI patient summary |
| **Vaccinations** | Schedule per pet, automatic SMS reminders via background jobs |
| **Lab orders, tasks & follow-ups** | Ordered from the visit, tracked to completion |
| **Billing** | Price list, visit charges, invoices with atomic numbering, payment links (Green Invoice), payment tracking |
| **Inventory** | Stock with atomic adjustments and transaction log |
| **Messaging** | Editable Hebrew SMS templates, manual messages from the client card, client-facing visit summary page |
| **Calls & escalations** | Every AI call with transcript and summary; escalations queue with full context |
| **Settings / provider admin** | Clinic settings, price list editor, QA review of AI calls, prompt-improvement suggestions with approval |

RTL-first, Hebrew, built for staff who live in it all day.

### 2. AI receptionist (the voice agent)

Answers the clinic's real phone number in Hebrew (ElevenLabs Conversational AI + Twilio) and uses the system's data and rules through authenticated tools:

- Identifies the caller, looks up customer and pets
- Checks availability and **books / reschedules appointments** under the clinic's rules (visit types, durations, booking window, approval-required visits)
- **Quotes prices** from the live price list
- Sends **SMS confirmations** and queues reminders
- Runs triage on red-flag symptoms and **escalates urgent cases** to the vet with context; can hand off a live call
- Every call is stored, summarized and visible in the dashboard the moment it ends

The agent never bypasses the system: same database, same validation, same RLS.

### 3. Learning loop

Calls are analyzed automatically; the system proposes prompt improvements, a human approves or rejects, and approved changes are consolidated and synced to the agent — with regression tests.

## Architecture

```text
                        ┌────────────────────────────────────────┐
  Caller ──► Twilio ──► │ ElevenLabs agent (Hebrew)               │
                        │  tools: lookup · availability · book ·  │
                        │  reschedule · price quote · escalate    │
                        └───────────────┬────────────────────────┘
                                        │ HTTPS (bearer auth)
                                        ▼
                        ┌────────────────────────────────────────┐
                        │ agent/  Node.js + Hono (Fly.io)         │
                        │  tool endpoints · call-ended webhook ·  │
                        │  SMS jobs · vaccination reminders ·     │
                        │  triage · call analysis                 │
                        └───────────────┬────────────────────────┘
                                        │
                                        ▼
                        ┌────────────────────────────────────────┐
                        │ Supabase / PostgreSQL                   │
                        │  50+ migrations · RLS per clinic ·      │
                        │  RPCs for atomic ops · storage buckets  │
                        └───────────────┬────────────────────────┘
                                        │
                                        ▼
                        ┌────────────────────────────────────────┐
                        │ app/  Next.js 16 dashboard (Vercel)     │
                        │  clinic operations · billing · records  │
                        └────────────────────────────────────────┘
```

## Tech stack

| Area | Technologies |
|---|---|
| Dashboard | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Voice agent service | Node.js 22, Hono, ElevenLabs Conversational AI, Twilio |
| Data | Supabase, PostgreSQL, RLS, RPCs, pg_cron |
| AI | ElevenLabs, OpenAI (visit summaries, SOAP structuring, call analysis) |
| Integrations | Twilio SMS, Green Invoice (invoices & payment links) |
| Testing | Vitest, Testing Library, integration tests against local Supabase — 960+ tests |
| Deployment | Fly.io (agent), Vercel (dashboard), GitHub Actions CI |

## Repository structure

```text
agent/            Voice-agent service — tools, webhooks, jobs, triage, learning loop
app/              Clinic dashboard — pages, API routes, services, repositories, validators
packages/shared/  Shared package — visit types, pricing, phone, SMS templates
supabase/         Migrations, cron jobs, local config
docs/             Development notes, RLS matrix, architecture
```

## Run locally

Prerequisites: Node.js ≥ 20, Supabase CLI, Twilio and ElevenLabs accounts (agent only).

```bash
git clone https://github.com/ido318/voxly-vet.git
cd voxly-vet
npm install

cd supabase && supabase start && cd ..

cd app
cp .env.example .env.local     # fill in from `supabase status`
npm run seed:all               # demo clinic + dev user
npm run dev                    # http://localhost:3001

# voice agent (separate terminal)
cd agent
cp .env.example .env
npm run dev
```

```bash
npm run test:all
npm run typecheck:all
npm run lint:all
npm run build:all
```

## Engineering notes

- **Service / repository layering** in the dashboard: API routes → validators → services → repositories, with an actor context and audit log on every privileged action.
- **Atomic operations in the database** — RPCs for opening a visit from an appointment, invoice numbering, inventory adjustments; overlap conflicts surface as 409s.
- **Security by default** — RLS per clinic, sanitized redirects, CSP and security headers, private recording buckets, bearer-authenticated agent tools.
- **Idempotent background jobs** — bounded SMS batches with rate limiting and idempotency keys.
- **Human-in-the-loop AI** — AI drafts (SOAP notes, summaries, prompt changes) are artifacts that require explicit approval.

Operational details live in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Status

In production, used daily by a clinic. This public repository is an anonymized snapshot: client details, phone numbers, credentials and data are intentionally kept out.

## Author

Ido Amsalem — [GitHub](https://github.com/ido318) · [LinkedIn](https://www.linkedin.com/in/idoam)
