// Deterministic, explainable AI Health Coach.
//
// Answers questions by reasoning over the user's own profile, learned sensitivity,
// food history, and recent context. Every answer includes citations — which facts the
// answer used — so the response is never a black box.
//
// Swap-in point: a real LLM (OpenAI) can replace this for richer prose; the same
// (question, context) → cited-facts interface is preserved.
import type {
  Food,
  FoodScoreResult,
  GlucosePoint,
  LearnedModel,
  MealEntry,
  SleepRecord,
  UserProfile,
} from './types';
import { macrosForGrams, netCarbsG, portionToGrams } from './nutrition';
import { estimateGlucoseSpike } from './glucose';
import { scoreFood } from './scoring';

export interface CoachContext {
  profile: UserProfile;
  sensitivity: number;
  learned: LearnedModel;
  foodIndex: Record<string, Food>;
  recentMeals: MealEntry[];
  recentGlucose: GlucosePoint[];
  recentSleep: SleepRecord[];
  /** steps today */
  stepsToday?: number;
}

export interface CoachAnswer {
  text: string;
  citations: string[];
  /** whether the coach was able to ground this in the user's data */
  grounded: boolean;
}

interface ParsedQuestion {
  intent: 'can_i_eat' | 'why_did_glucose_rise' | 'what_to_eat' | 'general';
  foodId?: string;
  foodName?: string;
}

/** Detect the question's intent and any food it mentions (by name or alias). */
export function parseQuestion(q: string, foodIndex: Record<string, Food>): ParsedQuestion {
  const lower = q.toLowerCase().trim();

  // Find any food whose name or alias appears in the question.
  let foodId: string | undefined;
  let foodName: string | undefined;
  for (const f of Object.values(foodIndex)) {
    const names = [f.name, ...(f.aliases ?? [])].map((n) => n.toLowerCase());
    if (names.some((n) => lower.includes(n))) {
      foodId = f.id;
      foodName = f.name;
      break;
    }
  }

  // "what to eat" must be checked BEFORE "can_i_eat", since "what should I eat" contains
  // both "should" and "eat". what_to_eat never names a specific food to permit.
  if (lower.startsWith('what') && /\b(eat|have|dinner|lunch|breakfast|snack)\b/.test(lower)) {
    return { intent: 'what_to_eat' };
  }

  const eatIntent =
    /^(can i|should i|is it ok|may i|shall i|ok to|lets|let's).*(eat|have|try|order|grab)/.test(lower) ||
    lower.startsWith('can i eat');
  if (eatIntent) {
    return { intent: 'can_i_eat', foodId, foodName };
  }
  if (lower.includes('why') && (lower.includes('glucose') || lower.includes('sugar') || lower.includes('spike'))) {
    return { intent: 'why_did_glucose_rise', foodId, foodName };
  }
  return { intent: 'general', foodId, foodName };
}

/** Answer a user question using their data. */
export function answerQuestion(question: string, ctx: CoachContext): CoachAnswer {
  const parsed = parseQuestion(question, ctx.foodIndex);
  switch (parsed.intent) {
    case 'can_i_eat':
      return answerCanIEat(parsed, ctx);
    case 'why_did_glucose_rise':
      return answerWhyRise(parsed, ctx);
    case 'what_to_eat':
      return answerWhatToEat(ctx);
    default:
      return answerGeneral(ctx);
  }
}

function answerCanIEat(parsed: ParsedQuestion, ctx: CoachContext): CoachAnswer {
  if (!parsed.foodId || !parsed.foodName) {
    return {
      text: 'Tell me which food and I can score it against your model — e.g. "Can I eat biryani today?"',
      citations: [],
      grounded: false,
    };
  }
  const food = ctx.foodIndex[parsed.foodId];
  const lastMealAt = ctx.recentMeals.length
    ? ctx.recentMeals[ctx.recentMeals.length - 1].loggedAt
    : undefined;

  // Score for a typical portion, factoring in recent sleep.
  const lastSleep = ctx.recentSleep[ctx.recentSleep.length - 1]?.hours;
  const result: FoodScoreResult = scoreFood(food, ctx.profile, ctx.sensitivity, 'serving', 1, {
    sleepHoursPrior: lastSleep,
    mealAt: Date.now(),
  });

  // Look at how this food affected the user historically.
  const past = ctx.recentMeals.filter((m) => m.foodId === food.id);
  const pastNote =
    past.length > 0
      ? ` You've logged ${food.name} ${past.length} time${past.length > 1 ? 's' : ''} before.`
      : ` You haven't logged ${food.name} yet, so I'm using your population prior.`;

  // Activity suggestion if yellow/red.
  const activityTip =
    result.score === 'green'
      ? ' Go ahead.'
      : result.score === 'yellow'
        ? ' If you walk 10-15 min afterward, expect roughly half that rise.'
        : ' Consider a smaller portion, or a 15-20 min walk to blunt the spike.';

  return {
    text: `${result.reason}${pastNote}${activityTip}`,
    citations: [
      `Your sensitivity: ${ctx.sensitivity.toFixed(2)} mg/dL per g carb (${ctx.learned.isPrior ? 'prior estimate' : `learned from ${ctx.learned.sampleSize} meals`})`,
      `${food.name} GI: ${food.gi}, portion ≈ ${food.servingGrams} g`,
      lastSleep != null ? `Last night's sleep: ${lastSleep.toFixed(1)} h` : 'No recent sleep logged',
    ],
    grounded: true,
  };
}

function answerWhyRise(parsed: ParsedQuestion, ctx: CoachContext): CoachAnswer {
  // Most-recent glucose jump.
  if (ctx.recentGlucose.length < 2) {
    return {
      text: 'Log a couple of glucose readings and I can tell you what likely drove the change.',
      citations: [],
      grounded: false,
    };
  }
  const sorted = [...ctx.recentGlucose].sort((a, b) => a.takenAt - b.takenAt);
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const delta = last.value - prev.value;
  if (delta <= 5) {
    return {
      text: `Your glucose went from ${prev.value} to ${last.value} mg/dL — essentially flat. Nothing concerning there.`,
      citations: [`Last two readings: ${prev.value} → ${last.value} mg/dL`],
      grounded: true,
    };
  }

  // Find meals in the window between prev and last.
  const betweenMeals = ctx.recentMeals.filter(
    (m) => m.loggedAt >= prev.takenAt && m.loggedAt <= last.takenAt,
  );
  const lastSleep = ctx.recentSleep[ctx.recentSleep.length - 1]?.hours;

  const reasons: string[] = [];
  if (betweenMeals.length > 0) {
    const top = betweenMeals.reduce((acc, m) => {
      const f = ctx.foodIndex[m.foodId];
      if (!f) return acc;
      const grams = portionToGrams(f, m.portionType, m.portionValue);
      const macros = macrosForGrams(f, grams);
      const nc = netCarbsG(macros.carbsG, macros.fiberG);
      const spike = estimateGlucoseSpike({
        carbsG: nc,
        gi: f.gi,
        sensitivity: ctx.sensitivity,
      });
      acc.push({ name: f.name, delta: spike.deltaMgDl });
      return acc;
    }, [] as { name: string; delta: number }[]);
    top.sort((a, b) => b.delta - a.delta);
    if (top.length > 0) {
      reasons.push(
        `Likely driver: ${top[0].name} (predicted ~${top[0].delta.toFixed(0)} mg/dL rise at your sensitivity)`,
      );
    }
  }
  if (lastSleep != null && lastSleep < 6) {
    reasons.push(`Poor sleep last night (${lastSleep.toFixed(1)} h) raises insulin resistance`);
  }
  if (ctx.stepsToday != null && ctx.stepsToday < 2000) {
    reasons.push(`Low activity today (${ctx.stepsToday} steps) blunts glucose disposal`);
  }
  if (reasons.length === 0) {
    reasons.push('No logged meal between those readings — consider logging meals right after eating.');
  }

  return {
    text: `Your glucose went from ${prev.value} to ${last.value} mg/dL (+${delta}). ${reasons.join('. ')}.`,
    citations: [
      `Readings: ${prev.value} → ${last.value} mg/dL`,
      `Sensitivity: ${ctx.sensitivity.toFixed(2)} mg/dL per g carb`,
      `Meals in window: ${betweenMeals.length}`,
    ],
    grounded: true,
  };
}

function answerWhatToEat(ctx: CoachContext): CoachAnswer {
  // Score everything in the index and pick the lowest-impact foods.
  const all = Object.values(ctx.foodIndex)
    .slice(0, 200)
    .map((f) => ({ f, r: scoreFood(f, ctx.profile, ctx.sensitivity, 'serving', 1, { mealAt: Date.now() }) }))
    .sort((a, b) => a.r.predictedDeltaMgDl - b.r.predictedDeltaMgDl);

  if (all.length === 0) {
    return {
      text: 'No foods loaded yet — add foods to your database and I can recommend the best picks for you.',
      citations: [],
      grounded: false,
    };
  }

  // Prefer green; if none, fall back to the lowest-impact yellow foods.
  const green = all.filter((x) => x.r.score === 'green');
  const picks = green.length > 0 ? green.slice(0, 3) : all.slice(0, 3);
  const bestBand = green.length > 0 ? 'green' : 'the lowest-impact available';

  const names = picks.map((x) => x.f.name).join(', ');
  const suffix =
    green.length > 0
      ? 'These are predicted to keep your glucose rise under your green threshold.'
      : 'No foods hit your green band right now — these are the gentlest available; pair them with protein or a short walk.';

  return {
    text: `For your metabolism right now, lean toward: ${names}. ${suffix}`,
    citations: [
      `Bands used: green ${ctx.profile.diabetic ? '≤30' : '≤20'} mg/dL; recommended from ${bestBand}`,
      `Sensitivity: ${ctx.sensitivity.toFixed(2)} mg/dL per g carb`,
    ],
    grounded: true,
  };
}

function answerGeneral(ctx: CoachContext): CoachAnswer {
  return {
    text: `I can answer questions like "Can I eat biryani today?", "Why did my glucose rise?", or "What should I eat for dinner?" using your own logged history. Your current sensitivity is ${ctx.sensitivity.toFixed(2)} mg/dL per gram of carb.`,
    citations: [
      `Sensitivity: ${ctx.sensitivity.toFixed(2)} mg/dL per g carb (${ctx.learned.isPrior ? 'prior' : `${ctx.learned.sampleSize} meals`})`,
    ],
    grounded: true,
  };
}
