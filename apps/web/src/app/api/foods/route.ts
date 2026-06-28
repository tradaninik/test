import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
  const region = url.searchParams.get('region'); // optional filter
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100);

  // Search name + aliases (aliases stored as JSON string).
  // For SQLite we use contains-style matching; aliases are matched via a JSON like check.
  const foods = await prisma.food.findMany({
    where: {
      ...(region && region !== 'all' ? { region } : {}),
      OR: q
        ? [{ name: { contains: q } }, { aliases: { contains: q } }]
        : undefined,
    },
    take: limit,
    orderBy: { name: 'asc' },
  });

  // Rank: exact prefix match first.
  const ranked = foods.sort((a, b) => {
    const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return ap - bp;
  });

  return NextResponse.json({ foods: ranked });
}
