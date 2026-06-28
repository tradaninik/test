# Architecture

## Monorepo layout

```
ZCodeProject/
├─ apps/
│  ├─ web/        Next.js 15 (App Router) + TypeScript + Tailwind — deployable product + PWA
│  └─ mobile/     Expo (React Native) scaffold — native binary built later via EAS
├─ packages/
│  ├─ engine/     Personal Metabolic Model — pure TS, zero deps, unit-tested
│  └─ food-db/    Indian regional + global food nutrition dataset
└─ docs/
```

Managed with **npm workspaces**. The engine is imported by both `apps/web` and
`apps/mobile`, so glucose/forecast/insight math is byte-identical across web and the
future native app.

## Why a pure-TS engine package

The engine has no I/O and no external API calls. Everything is deterministic functions:

```ts
estimateGlucoseSpike(user, meal, context) → { deltaMgDl, timeToPeakMin, auc }
learnSensitivity(user, history)            → per-user carb-sensitivity coefficient
scoreFood(user, food)                      → 'green' | 'yellow' | 'red'
forecast(user, history, horizonDays)       → { weight, hba1c, glucose }[] with CIs
discoverInsights(history)                  → InsightCard[] with confidence
healthScore(user, history)                 → 0..100 composite
```

Consequences:
- Runs identically on server (Next API route) and client (instant UI) and in Expo.
- Fully unit-testable — the math is proven correct, not "looks right".
- Zero per-call cost, runs offline, no API keys. Swap-in points for OpenAI Vision (food
  image parsing) and LLM (coach prose) are isolated behind interfaces; v1 uses the
  deterministic implementations.

## Web stack

- **Next.js 15 App Router** — server components for data, client islands for interactivity.
- **Prisma + SQLite** locally (file at `apps/web/prisma/dev.db`). At deploy, swap the
  `DATABASE_URL` to **Turso (libSQL)** or **Postgres** — schema is identical.
- **Tailwind CSS** for styling; dark/light mode.
- **Recharts** for the Health Timeline and forecast charts.
- **NextAuth** (Credentials provider) for v1 auth; MFA is stubbed behind an interface.
- **next-pwa** for installable PWA + offline shell (Android deliverable, no SDK required).

## Data model (summary — see Prisma schema for full detail)

Core entities:

- **User** — account + onboarding profile (body metrics, health metrics, lifestyle, goals)
- **FoodEntry** — a logged meal: foodId, portion (katori/serving/grams), time, photoPath
- **GlucoseReading** — time-series glucose (manual or CGM-imported)
- **ActivityEntry**, **SleepEntry**, **WeightEntry**, **BloodPressureEntry**
- **UserLearnedModel** — per-user learned sensitivity (cache of `learnSensitivity`)
- **InsightCard** — materialized insights (recomputed on a schedule / on new data)
- **CoachThread / CoachMessage** — coach conversations
- **CareRelationship** — family-monitoring links (caregiver ↔ ward)
- **DoctorPatientLink** — doctor portal links
- **Achievement / Streak** — gamification

## Non-clinical labelling

Every prediction surface (forecast, score, coach answer, insight) carries the
"educational, not medical advice" label in both UI and API responses.
