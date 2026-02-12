import { runCfCommand } from '@/lib/cf';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { name } = await request.json();
  const result = await runCfCommand(['template', name]);
  return NextResponse.json(result);
}
