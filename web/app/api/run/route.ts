import { runCfCommand, saveSolution, saveProblemText, getProblemsDir } from '@/lib/cf';
import { NextResponse } from 'next/server';
import path from 'path';

export async function POST(request: Request) {
  const { problem, code, input, sample, problemText } = await request.json();
  
  const problemsDir = getProblemsDir();
  const problemDir = path.join(problemsDir, problem);
  
  if (code) await saveSolution(problem, code);
  if (problemText) await saveProblemText(problem, problemText);

  // If input is provided, we use it as stdin. 
  // We don't pass the problem name as an argument to avoid it being treated as an input file,
  // unless we want sample extraction.
  
  const args: string[] = [];
  if (input) {
    args.push('--stdin');
  } else {
    // Pass problem.txt explicitly to ensure sample extraction works correctly
    args.push('problem.txt');
    if (sample) args.push('--sample', sample.toString());
  }
  
  const result = await runCfCommand(args, { cwd: problemDir, input });
  return NextResponse.json(result);
}
