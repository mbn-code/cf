import { listProblems } from '@/lib/cf';
import { NextResponse } from 'next/server';

export async function GET() {
  const problems = await listProblems();
  return NextResponse.json(problems);
}
