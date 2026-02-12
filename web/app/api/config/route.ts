import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    startProblem: process.env.CF_START_PROBLEM || null,
    problemsDir: process.env.CF_PROBLEMS_DIR || null,
  });
}
