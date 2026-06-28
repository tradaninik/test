'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { REGION_LABELS } from '@mi/food-db';
import type { CuisineRegion } from '@mi/engine';

const STEPS = ['Account', 'Personal', 'Body', 'Health', 'Lifestyle', 'Goals'] as const;

type FormData = {
  email: string;
  password: string;
  name: string;
  age: string;
  gender: string;
  country: string;
  region: CuisineRegion;
  heightCm: string;
  weightKg: string;
  waistCm: string;
  bodyFatPct: string;
  hba1c: string;
  fastingGlucose: string;
  systolicBp: string;
  diastolicBp: string;
  totalCholesterol: string;
  sleepHours: string;
  activityLevel: string;
  occupation: string;
  smoking: string;
  alcohol: string;
  conditions: string[];
  medications: string[];
  familyHistory: string[];
  goals: string[];
};

const initial: FormData = {
  email: '', password: '', name: '',
  age: '', gender: '', country: 'India', region: 'south_indian',
  heightCm: '', weightKg: '', waistCm: '', bodyFatPct: '',
  hba1c: '', fastingGlucose: '', systolicBp: '', diastolicBp: '', totalCholesterol: '',
  sleepHours: '7', activityLevel: 'light', occupation: '', smoking: 'never', alcohol: 'occasional',
  conditions: [], medications: [], familyHistory: [], goals: [],
};

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary (little/no exercise)' },
  { value: 'light', label: 'Light (1-3 days/week)' },
  { value: 'moderate', label: 'Moderate (3-5 days/week)' },
  { value: 'active', label: 'Active (6-7 days/week)' },
  { value: 'very_active', label: 'Very active (daily/training)' },
];

const CONDITIONS = ['type_2_diabetes', 'prediabetes', 'hypertension', 'obesity', 'fatty_liver', 'pcos', 'high_cholesterol'];
const MEDS = ['metformin', 'insulin', 'statins', 'bp_medication', 'none'];
const FAMILY = ['diabetes', 'hypertension', 'heart_disease', 'obesity'];
const GOALS = ['lower_hba1c', 'weight_loss', 'better_energy', 'fat_loss', 'prevent_diabetes', 'muscle_gain'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function toggle(list: 'conditions' | 'medications' | 'familyHistory' | 'goals', value: string) {
    setData((d) => {
      const arr = d[list];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...d, [list]: next };
    });
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      // 1. create the account
      const signupRes = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password, name: data.name }),
      });
      if (!signupRes.ok) {
        const j = await signupRes.json().catch(() => ({}));
        throw new Error(j.error || 'Could not create account.');
      }

      // 2. sign in
      const ok = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (!ok || ok.error) throw new Error('Account created, but sign-in failed. Try logging in.');

      // 3. save onboarding profile
      const onbRes = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!onbRes.ok) throw new Error('Profile saved partially — please finish in settings.');

      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  const canAdvance =
    step === 0 ? data.email && data.password.length >= 8 :
    step === 1 ? data.age && data.gender && data.region :
    step === 2 ? data.heightCm && data.weightKg :
    true;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-brand-500" aria-hidden />
        <span className="font-semibold tracking-tight">Metabolic Intelligence</span>
      </Link>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
            <span className={`text-[10px] uppercase tracking-wide ${i === step ? 'text-brand-600 font-semibold' : 'text-neutral-400'}`}>{s}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800 sm:p-8">
        {step === 0 && (
          <Section title="Create your account" desc="We build a personal model from your data. Your data stays in your account.">
            <Field label="Name"><Input value={data.name} onChange={(v) => set('name', v)} placeholder="Your name" /></Field>
            <Field label="Email"><Input type="email" value={data.email} onChange={(v) => set('email', v)} placeholder="you@example.com" /></Field>
            <Field label="Password (min 8 chars)"><Input type="password" value={data.password} onChange={(v) => set('password', v)} placeholder="••••••••" /></Field>
          </Section>
        )}

        {step === 1 && (
          <Section title="Tell us about you" desc="Region drives the cuisine priors for your model.">
            <Field label="Age"><Input type="number" value={data.age} onChange={(v) => set('age', v)} placeholder="45" /></Field>
            <Field label="Gender">
              <Select value={data.gender} onChange={(v) => set('gender', v)} options={[{value:'',label:'Select…'},{value:'male',label:'Male'},{value:'female',label:'Female'},{value:'other',label:'Other'}]} />
            </Field>
            <Field label="Country"><Input value={data.country} onChange={(v) => set('country', v)} placeholder="India" /></Field>
            <Field label="Preferred cuisine region (powers your Indian Metabolic Intelligence)">
              <Select value={data.region} onChange={(v) => set('region', v as CuisineRegion)} options={Object.entries(REGION_LABELS).map(([value, label]) => ({ value, label }))} />
            </Field>
          </Section>
        )}

        {step === 2 && (
          <Section title="Body metrics" desc="Used for BMI, energy needs, and weight tracking.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Height (cm)"><Input type="number" value={data.heightCm} onChange={(v) => set('heightCm', v)} placeholder="170" /></Field>
              <Field label="Weight (kg)"><Input type="number" value={data.weightKg} onChange={(v) => set('weightKg', v)} placeholder="82" /></Field>
              <Field label="Waist (cm)"><Input type="number" value={data.waistCm} onChange={(v) => set('waistCm', v)} placeholder="98" /></Field>
              <Field label="Body fat (%)"><Input type="number" value={data.bodyFatPct} onChange={(v) => set('bodyFatPct', v)} placeholder="28" /></Field>
            </div>
          </Section>
        )}

        {step === 3 && (
          <Section title="Health metrics" desc="Optional but improves your model. Leave blank if unknown.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="HbA1c (%)"><Input type="number" value={data.hba1c} onChange={(v) => set('hba1c', v)} placeholder="7.2" /></Field>
              <Field label="Fasting glucose (mg/dL)"><Input type="number" value={data.fastingGlucose} onChange={(v) => set('fastingGlucose', v)} placeholder="110" /></Field>
              <Field label="Systolic BP"><Input type="number" value={data.systolicBp} onChange={(v) => set('systolicBp', v)} placeholder="120" /></Field>
              <Field label="Diastolic BP"><Input type="number" value={data.diastolicBp} onChange={(v) => set('diastolicBp', v)} placeholder="80" /></Field>
              <Field label="Total cholesterol"><Input type="number" value={data.totalCholesterol} onChange={(v) => set('totalCholesterol', v)} placeholder="180" /></Field>
            </div>
          </Section>
        )}

        {step === 4 && (
          <Section title="Lifestyle" desc="Sleep, activity, and habits shape your glucose response.">
            <Field label="Average sleep (hours)"><Input type="number" value={data.sleepHours} onChange={(v) => set('sleepHours', v)} placeholder="7" /></Field>
            <Field label="Activity level"><Select value={data.activityLevel} onChange={(v) => set('activityLevel', v)} options={ACTIVITY_OPTIONS} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Occupation"><Input value={data.occupation} onChange={(v) => set('occupation', v)} placeholder="office" /></Field>
              <Field label="Smoking"><Select value={data.smoking} onChange={(v) => set('smoking', v)} options={[{value:'never',label:'Never'},{value:'former',label:'Former'},{value:'current',label:'Current'}]} /></Field>
            </div>
            <Field label="Alcohol"><Select value={data.alcohol} onChange={(v) => set('alcohol', v)} options={[{value:'none',label:'None'},{value:'occasional',label:'Occasional'},{value:'regular',label:'Regular'}]} /></Field>
            <ChipGroup label="Conditions" options={CONDITIONS} selected={data.conditions} onToggle={(v) => toggle('conditions', v)} />
            <ChipGroup label="Medications" options={MEDS} selected={data.medications} onToggle={(v) => toggle('medications', v)} />
            <ChipGroup label="Family history" options={FAMILY} selected={data.familyHistory} onToggle={(v) => toggle('familyHistory', v)} />
          </Section>
        )}

        {step === 5 && (
          <Section title="Your goals" desc="What matters most to you? We tune recommendations accordingly.">
            <ChipGroup label="Select all that apply" options={GOALS} selected={data.goals} onToggle={(v) => toggle('goals', v)} />
          </Section>
        )}

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? router.push('/') : setStep((s) => s - 1))}
            className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={submit}
              className="rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Building your model…' : 'Build my metabolic model'}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-neutral-500">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-600 hover:underline">Sign in</Link>
      </p>
    </main>
  );
}

/* ---------- small UI helpers (kept local to onboarding) ---------- */

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{desc}</p>}
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
function Input({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-brand-500 dark:border-neutral-700"
    />
  );
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-brand-500 dark:border-neutral-700"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
function ChipGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition ${active ? 'border-brand-500 bg-brand-500 text-white' : 'border-neutral-300 hover:border-brand-400 dark:border-neutral-700'}`}
            >
              {o.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
