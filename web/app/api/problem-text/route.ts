import { getProblemText, saveProblemText } from '@/lib/cf';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const problem = searchParams.get('problem');
  if (!problem) return NextResponse.json({ error: 'Missing problem' }, { status: 400 });
  const text = await getProblemText(problem);
  return NextResponse.json({ text });
}

export async function POST(request: Request) {
  const { problem, text } = await request.json();
  await saveProblemText(problem, text);
  return NextResponse.json({ success: true });
}
