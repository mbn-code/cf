import { getSolution, saveSolution } from '@/lib/cf';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const problem = searchParams.get('problem');
  if (!problem) return NextResponse.json({ error: 'Missing problem' }, { status: 400 });
  const code = await getSolution(problem);
  return NextResponse.json({ code });
}

export async function POST(request: Request) {
  const { problem, code } = await request.json();
  await saveSolution(problem, code);
  return NextResponse.json({ success: true });
}
