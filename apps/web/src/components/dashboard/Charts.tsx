'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts';

const tooltipStyle = {
  background: 'rgba(20,20,20,0.92)',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

export function GlucoseChart({ data }: { data: { t: number; value: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        {/* Target band 70-140 mg/dL */}
        <ReferenceArea y1={70} y2={140} fill="#16b077" fillOpacity={0.08} />
        <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} minTickGap={20} />
        <YAxis domain={[60, 220]} tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} mg/dL`, 'Glucose']} />
        <Line type="monotone" dataKey="value" stroke="#16b077" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeightChart({ data }: { data: { t: number; kg: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} minTickGap={20} />
        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} kg`, 'Weight']} />
        <Line type="monotone" dataKey="kg" stroke="#3fcb93" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ForecastChart({ data }: { data: { day: number; value: number; low: number; high: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: d.day === 0 ? 'Now' : `+${d.day}d` }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <ReferenceArea y1="dataMin" y2="dataMax" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} minTickGap={24} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(1)} />
        <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.3} dot={false} />
        <Line type="monotone" dataKey="low" stroke="#3fcb93" strokeWidth={1} strokeOpacity={0.3} dot={false} />
        <Line type="monotone" dataKey="value" stroke="#0a8e5f" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
