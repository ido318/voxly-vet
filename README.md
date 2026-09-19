# Voxly — Hebrew Voice AI Agent & Veterinary Clinic Dashboard

A production full-stack platform for veterinary clinics. An AI phone agent answers incoming calls in Hebrew, identifies the customer and their pets, escalates urgent cases to the vet, and every call is recorded and surfaced in an RTL operations dashboard.

[![CI](https://github.com/ido318/voxly-vet/actions/workflows/ci.yml/badge.svg)](https://github.com/ido318/voxly-vet/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

## The problem

A small veterinary clinic gets dozens of calls a day: appointment requests, "is my dog's vaccine due?", price questions, and the occasional real emergency. The vet is in the treatment room and can't answer; the front desk is overloaded. Calls get missed, and urgent cases wait in the same queue as routine ones.

## The solution

- **Automate the routine** — a Hebrew-speaking AI agent handles the call, with live access to the clinic's data.
- **Escalate what matters** — urgent or sensitive cases are flagged to the vet immediately with full context.
- **Keep the humans in control** — every call, summary and escalation lands in a dashboard the clinic team works from.

## Key features

- Hebrew conversational voice agent on a real Israeli phone number (ElevenLabs + Twilio)
- Live customer & pet lookup during the call
- Escalation workflow to the vet, visible in the dashboard
- Call history with per-call view and pre-visit brief
- Appointments, visits, SOAP notes, inventory, price list and Hebrew SMS reminders
- RTL-first dashboard built for Hebrew-speaking staff
- Row-level security per clinic, private storage buckets for recordings

## Architecture

```text
Caller
  │
  ▼
Twilio (Israeli number)
  │
  ▼
ElevenLabs Conversational AI agent (Hebrew)
  │
  ├─ tool: customer & pet lookup ──► Supabase
  ├─ tool: escalate to vet ────────► Supabase (escalations)
  │
  └─ call-ended webhook ───────────► voice_calls
                                        │
                                        ▼
                           Next.js operations dashboard
                           /dashboard/calls · /dashboard/voice/[callId]
```

## Tech stack

| Area | Technologies |
|---|---|
| Voice agent | Node.js 22, Hono, ElevenLabs Conversational AI, Twilio |
| Dashboard | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Data | Supabase, PostgreSQL, RLS policies, 50+ migrations |
| AI | ElevenLabs, OpenAI via Vercel AI SDK |
| Testing | Vitest, Testing Library, integration tests against local Supabase |
| Deployment | Fly.io (agent), Vercel (dashboard), GitHub Actions CI |

## Repository structure

```text
agent/            Voice-agent service (Node.js + Hono) — tools, webhooks, SMS jobs
app/              Operations dashboard (Next.js)
packages/shared/  Shared TypeScript package (types, pricing, SMS templates)
supabase/         Migrations and local config
docs/             Architecture, deployment status, RLS matrix, checklists
```

## Run locally

Prerequisites: Node.js ≥ 20, Supabase CLI, Twilio and ElevenLabs accounts.

```bash
git clone https://github.com/ido318/voxly-vet.git
cd voxly-vet
npm install

# Local database
cd supabase && supabase start && cd ..

# Dashboard
cd app
cp .env.example .env.local     # fill in from `supabase status`
npm run seed:all
npm run dev                    # http://localhost:3001

# Voice agent (separate terminal)
cd agent
cp .env.example .env
npm run dev
```

```bash
npm run test:all        # agent + app
npm run typecheck:all
npm run lint:all
npm run build:all
```

## Engineering notes

- **Multi-service monorepo** — agent, dashboard and shared package as npm workspaces over one Supabase project.
- **Agent tools as HTTP endpoints** — bearer-authenticated, return Hebrew-language results the LLM can read back to the caller.
- **Atomic DB operations** — RPCs for visit opening and inventory adjustments; overlap conflicts mapped to 409.
- **Security by default** — RLS per clinic, sanitized login redirects, CSP and security headers, private recording buckets.
- **Idempotent background jobs** — bounded SMS batches with rate limiting and idempotency keys.

Operational details (deployment, environment variables, Twilio routing) live in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Status

Active and deployed in production for a real clinic. Client details, phone numbers, credentials and data are intentionally kept out of this repository.

## Author

Ido Amsalem — [GitHub](https://github.com/ido318) · [LinkedIn](https://www.linkedin.com/in/idoam)
