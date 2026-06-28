import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { value, source = 'manual' } = await req.json();
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
  const reading = await prisma.glucoseReading.create({
    data: { userId: session.user.id, value: v, source },
  });
  return NextResponse.json({ reading });
}
