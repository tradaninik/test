'use client';

export default function HealthScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = circ * (1 - pct);

  const color = score >= 75 ? '#16b077' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'Good' : score >= 50 ? 'Fair' : 'Needs attention';

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-neutral-200 dark:text-neutral-800" />
        <circle
          cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="-mt-[88px] flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      </div>
      <div className="mt-12" />
    </div>
  );
}
