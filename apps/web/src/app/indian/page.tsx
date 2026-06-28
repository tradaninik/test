import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { scoreFood, priorSensitivity, type UserProfile } from '@mi/engine';
import { FOODS, REGION_LABELS } from '@mi/food-db';
import AppShell from '@/components/AppShell';

export default async function IndianPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/indian');
  const u = await prisma.user.findUnique({
    where: { id: session.user.id }, include: { learnedModel: true },
  });
  if (!u) redirect('/onboarding');

  const conditions: string[] = u.conditions ? safeParse(u.conditions) : [];
  const diabetic = conditions.some((c) => c.includes('diabetes'));
  const profile: UserProfile = {
    age: u.age ?? 40, gender: (u.gender as UserProfile['gender']) || 'other',
    heightCm: u.heightCm ?? 170, weightKg: u.weightKg ?? 70,
    activityLevel: (u.activityLevel as UserProfile['activityLevel']) || 'light',
    region: (u.region as UserProfile['region']) || 'south_indian', diabetic: diabetic || undefined,
  };
  if (u.hba1c) profile.hba1c = u.hba1c;
  const sensitivity = u.learnedModel?.sensitivityMgDlPerGCarb ?? priorSensitivity(profile);

  // Score all Indian foods for this user, grouped by region.
  const indianRegions = Object.keys(REGION_LABELS).filter((r) => r !== 'global') as UserProfile['region'][];
  const byRegion = indianRegions.map((r) => {
    const foods = FOODS.filter((f) => f.region === r)
      .map((f) => ({ food: f, result: scoreFood(f, profile, sensitivity, 'serving', 1, { mealAt: Date.now() }) }))
      .sort((a, b) => a.result.predictedDeltaMgDl - b.result.predictedDeltaMgDl);
    const green = foods.filter((f) => f.result.score === 'green').length;
    const red = foods.filter((f) => f.result.score === 'red').length;
    return { region: r, foods, green, red, total: foods.length };
  });

  const userRegion = (u.region as UserProfile['region']) || 'south_indian';

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight">Indian Metabolic Intelligence</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every regional dish scored for <strong>your</strong> model. A dosa ≠ a chapati ≠ a luchi.
          Scores adapt as you log meals.
        </p>

        <div className="mt-4 rounded-xl border border-brand-300 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
          <strong>Your default region:</strong> {REGION_LABELS[userRegion]} · sensitivity {sensitivity.toFixed(2)} mg/dL per g carb
          {u.learnedModel?.isPrior !== false ? ' (prior — log meals to personalize)' : ' (personalized)'}
        </div>

        {byRegion.map(({ region: r, foods, green, red, total }) => (
          <section key={r} className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{REGION_LABELS[r as keyof typeof REGION_LABELS]}</h2>
                <p className="text-xs text-neutral-500">
                  <span className="text-brand-600">{green} green</span> ·{' '}
                  <span className="text-red-600">{red} red</span> · {total} foods
                </p>
              </div>
              {r === userRegion && (
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white">YOUR REGION</span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {foods.map(({ food, result }) => (
                <div key={food.id} className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium">{food.name}</div>
                      <div className="text-[11px] text-neutral-500">GI {food.gi} · {food.servingGrams}g serving</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">+{Math.round(result.predictedDeltaMgDl)} mg/dL</span>
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          result.score === 'green' ? 'bg-brand-500' : result.score === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                      </div>
                    </div>
                  </div>
                  {result.score !== 'green' && (
                    <div className="mt-2 rounded-md bg-neutral-50 p-2 text-[11px] text-neutral-600 dark:bg-neutral-900/50 dark:text-neutral-400">
                      <strong>💡 AI Suggestion:</strong> {result.score === 'yellow' ? 'Add 15 min walk after eating or pair with extra dal/paneer to lower spike.' : 'High spike risk. Consider a half-portion, swap with a low-GI alternative, or ensure 30+ min of brisk activity post-meal.'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

function safeParse(s: string | null): any[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
