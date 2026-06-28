# Data Model

Authoritative source: [`apps/web/prisma/schema.prisma`](../apps/web/prisma/schema.prisma).
This document is a readable summary.

## Entities

### User
Account + onboarding profile. Single table holds auth identity and the rich profile
captured during onboarding.

Key fields: `email`, `passwordHash`, `name`, `role` (member | caregiver | doctor),
then onboarding columns: `age`, `gender`, `ethnicity`, `country`, `region` (cuisine),
`heightCm`, `weightKg`, `waistCm`, `bodyFatPct`, `hba1c`, `fastingGlucose`,
`systolicBp`, `diastolicBp`, `totalCholesterol`, `sleepHours`, `activityLevel`,
`occupation`, `smoking`, `alcohol`, `conditions` (JSON), `medications` (JSON),
`familyHistory` (JSON), `goals` (JSON), `onboardingComplete`.

### Food
Reference table, seeded from `packages/food-db`. Fields: `name`, `aliases`, `region`
(cuisine), `category`, `servingGrams`, `katoriGrams`, `kcalPer100g`, `carbsPer100g`,
`proteinPer100g`, `fatPer100g`, `gi` (glycemic index, regional), `fiberPer100g`.

### FoodEntry
A logged meal. `userId`, `foodId`, `portionType` (katori | serving | grams),
`portionValue`, `grams`, `photoPath?`, `loggedAt`, `notes?`.

### GlucoseReading
Time-series. `userId`, `value` (mg/dL), `source` (manual | cgm), `takenAt`.

### ActivityEntry / SleepEntry / WeightEntry / BloodPressureEntry
Time-series lifestyle inputs feeding the engine.

### UserLearnedModel
Cache of `learnSensitivity(user, history)`: `userId`, `sensitivityMgDlPerGCarb`,
`sampleSize`, `updatedAt`. Recomputed when new (meal, glucose) pairs arrive.

### InsightCard
Materialized insight. `userId`, `type`, `title`, `body`, `effectPct`, `confidence`,
`evidence` (JSON), `createdAt`, `dismissed`.

### CoachThread / CoachMessage
Coach conversations. Messages carry `role` (user | coach), `content`, and `citations`
(JSON — which user-history facts the answer used).

### CareRelationship
Family monitoring: `caregiverId`, `wardId`, `relation`, `alertGlucoseHigh`,
`alertGlucoseLow`, `alertMissedMeds`.

### DoctorPatientLink
Doctor portal: `doctorId`, `patientId`, `adherenceScore`, `riskFlags` (JSON).

### Achievement / Streak
Gamification: streaks, badges, weekly challenges.

## Migrations

Local dev uses `prisma db push` (fast schema sync). For production with Postgres, switch
to `prisma migrate` for versioned migrations.
