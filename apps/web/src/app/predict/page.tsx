import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { loadDashboardData } from '@/lib/engine-service';
import AppShell from '@/components/AppShell';
import { ForecastChart } from '@/components/dashboard/Charts';

export default async function PredictPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/predict');
  const data = await loadDashboardData(session.user.id);
  if (!data) redirect('/onboarding');

  const weightF = data.forecast.filter((p) => p.metric === 'weight_kg');
  const glucoseF = data.forecast.filter((p) => p.metric === 'glucose_mgdl');
  const hba1cF = data.forecast.filter((p) => p.metric === 'hba1c');
  const w30 = weightF.at(-1);
  const g30 = glucoseF.at(-1);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight">Prediction Engine</h1>
        <p className="mt-1 text-sm text-amber-600">⚠️ Educational forecasts, not medical predictions.</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 className="text-sm font-semibold">30-day weight forecast</h2>
            {w30 && (
              <p className="mt-1 text-xs text-neutral-500">
                Projected: <strong>{data.profile.weightKg.toFixed(1)} → {w30.value.toFixed(1)} kg</strong>
                &nbsp;(range {w30.low.toFixed(1)}–{w30.high.toFixed(1)})
              </p>
            )}
            <div className="mt-3"><ForecastChart data={weightF} /></div>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 className="text-sm font-semibold">30-day glucose forecast</h2>
            {g30 && (
              <p className="mt-1 text-xs text-neutral-500">
                Projected: <strong>{g30.value.toFixed(0)} mg/dL</strong> (range {g30.low.toFixed(0)}–{g30.high.toFixed(0)})
              </p>
            )}
            <div className="mt-3"><ForecastChart data={glucoseF} /></div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">HbA1c trajectory (weekly)</h2>
          <div className="mt-3"><ForecastChart data={hba1cF} /></div>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold">90-day risk outlook</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {data.risks.map((r) => (
              <div key={r.metric} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium capitalize">{r.metric.replace(/_/g, ' ')}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${levelColor(r.level)}`}>
                    {r.level.toUpperCase()}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div className={`h-full ${barColor(r.level)}`} style={{ width: `${Math.round(r.probability * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{Math.round(r.probability * 100)}% (heuristic)</p>
                </div>
                {r.drivers.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {r.drivers.map((d, i) => <li key={i} className="text-[11px] text-neutral-500">• {d}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function levelColor(l: string) {
  return l === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
    : l === 'moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
    : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300';
}
function barColor(l: string) {
  return l === 'high' ? 'bg-red-500' : l === 'moderate' ? 'bg-amber-500' : 'bg-brand-500';
}
