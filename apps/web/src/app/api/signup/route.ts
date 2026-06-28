import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const pwd = String(password || '');

    if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    if (pwd.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(pwd, 10);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, name: name || null },
    });

    return NextResponse.json({ id: user.id, email: user.email });
  } catch (e) {
    return NextResponse.json({ error: 'Sign-up failed.' }, { status: 500 });
  }
}
