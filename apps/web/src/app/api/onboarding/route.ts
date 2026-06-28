import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      age, gender, ethnicity, country, region,
      heightCm, weightKg, waistCm, bodyFatPct,
      hba1c, fastingGlucose, systolicBp, diastolicBp, totalCholesterol,
      sleepHours, activityLevel, occupation, smoking, alcohol,
      conditions, medications, familyHistory, goals,
    } = body;

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingComplete: true,
        age: num(age), gender: str(gender), ethnicity: str(ethnicity), country: str(country), region: str(region),
        heightCm: num(heightCm), weightKg: num(weightKg), waistCm: num(waistCm), bodyFatPct: num(bodyFatPct),
        hba1c: num(hba1c), fastingGlucose: num(fastingGlucose), systolicBp: int(systolicBp), diastolicBp: int(diastolicBp), totalCholesterol: num(totalCholesterol),
        sleepHours: num(sleepHours), activityLevel: str(activityLevel), occupation: str(occupation), smoking: str(smoking), alcohol: str(alcohol),
        conditions: JSON.stringify(conditions ?? []),
        medications: JSON.stringify(medications ?? []),
        familyHistory: JSON.stringify(familyHistory ?? []),
        goals: JSON.stringify(goals ?? []),
      },
    });

    // Seed an initial weight entry so charts have a starting point.
    const w = num(weightKg);
    if (w !== null && w > 0) {
      await prisma.weightEntry.create({
        data: { userId: session.user.id, kg: w, takenAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true, region: updated.region });
  } catch (e) {
    return NextResponse.json({ error: 'Onboarding save failed.' }, { status: 500 });
  }
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
function int(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n);
}
function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}
