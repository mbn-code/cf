import { runCfCommand, saveSolution, saveProblemText, getProblemsDir } from '@/lib/cf';
import { NextResponse } from 'next/server';
import path from 'path';

export async function POST(request: Request) {
  const { problem, code, problemText } = await request.json();
  
  const problemDir = path.join(getProblemsDir(), problem);

  if (code) await saveSolution(problem, code);
  if (problemText) await saveProblemText(problem, problemText);

  const result = await runCfCommand(['test'], { cwd: problemDir });
  return NextResponse.json(result);
}
