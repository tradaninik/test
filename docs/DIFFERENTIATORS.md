# Differentiators — Indian Metabolic Intelligence

## The market gap

| Competitor type | Examples | What they do | The gap |
|---|---|---|---|
| Calorie trackers | MyFitnessPal, HealthifyMe | Count macros; "you ate 80g carbs" | Ignore *how your body responds* to those carbs |
| US-centric glucose apps | Levels, Signos, January AI | Personalized glucose response | Treat "rice" as one food; weak on Indian cuisine |
| Diabetes logging | mySugr, BeatO | Log glucose + meds | Reactive logging, not predictive personalization |
| CGM-first coaching | Fitterfly, Sugar.fit | CGM + coach (often human) | Costly; coach doesn't scale; thin on regional food science |

## Our wedge

> "When **you** eat idli, your glucose typically rises 38 mg/dL. With 10 min of walking
> after, it drops to 19 mg/dL. Your neighbour's dosa response is different."

One meal → different prediction per user, because the engine starts from regional
population priors and then personalizes from the user's own logged history.

## Concrete differentiators in v1

1. **Regional cuisine modeling** — South Indian, North Indian, Bengali, Gujarati, Punjabi,
   Telugu, Tamil, Kerala, Maharashtrian, Rajasthani. Each food carries a regional glycemic
   prior (a dosa ≠ a chapati ≠ a luchi ≠ a thepla).

2. **Per-user regional defaults** — onboarding selects the user's region; food scoring
   starts from that region's population priors, then adapts as the user logs meals +
   glucose. No generic "rice = bad".

3. **Indian portion conventions** — katori / serving / "plate" mapped to grams. Users
   don't have to weigh food; the engine knows a standard katori of dal ≈ 150 g.

4. **Festive & seasonal intelligence** — Diwali sweets, Pongal, Onam sadya, Ramadan iftar,
   Makar Sankranti. Context-aware scoring (a single laddu on Diwali isn't a "failure").

5. **Local-context activity** — post-meal walk, yoga, household activity framed in
   regional terms and integrated into the spike prediction.

6. **Regional language readiness** — i18n scaffold so Phase 2 voice/multilingual support
   drops in cleanly.

## How it's built (no external AI required)

- `packages/food-db` carries each food's **regional glycemic index (GI)**, carb density,
  and typical portion in grams — sourced from published nutrition tables (IFCT, USDA).
- `packages/engine`'s `estimateGlucoseSpike` multiplies: `carbLoad × foodGI ×
  userSensitivity`, then adjusts for prior activity, sleep, and time of day.
- `learnSensitivity` fits the user's personal multiplier from their logged
  (meal, glucose) pairs via ordinary least squares, falling back to a population prior
  scaled by HbA1c and BMI until enough data exists.

## Phase 2+ extensions (designed, not built)

- OpenAI Vision food recognition (swap-in point already isolated).
- Voice coach + multilingual TTS.
- Regional food recognition CV model trained on Indian dishes.
