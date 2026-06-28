import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { loadDashboardData } from '@/lib/engine-service';
import AppShell from '@/components/AppShell';

export default async function InsightsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/insights');
  const data = await loadDashboardData(session.user.id);
  if (!data) redirect('/onboarding');

  const cards = data.insights;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Patterns auto-discovered from your logged history. Educational, not medical advice.
        </p>

        {cards.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
            <p className="text-neutral-500">No insights yet.</p>
            <p className="mt-2 text-sm text-neutral-400">
              Log meals, sleep, and glucose for ~5 days and patterns will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {cards.map((c) => (
              <div key={c.id} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{c.title}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                    c.confidence > 0.6 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'
                  }`}>
                    {Math.round(c.confidence * 100)}% conf
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{c.body}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.evidence.map((e, i) => (
                    <span key={i} className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-900">{e}</span>
                  ))}
                </div>
                <div className="mt-3 text-xs">
                  Effect:{' '}
                  <span className={c.effectPct > 0 ? 'text-red-600' : 'text-brand-600'}>
                    {c.effectPct > 0 ? '+' : ''}{c.effectPct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
