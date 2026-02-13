import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const CF_SCRIPT = path.join(REPO_ROOT, 'scripts', 'cf');

export function getProblemsDir() {
  return process.env.CF_PROBLEMS_DIR || path.join(REPO_ROOT, 'src');
}

export type ParsedResult = {
  verdict: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Internal Error';
  passedCount: number;
  totalCount: number;
  runtime?: number;
  memory?: string;
  timestamp: string;
  samples: Array<{
    id: number;
    passed: boolean;
    input?: string;
    expected?: string;
    actual?: string;
  }>;
};

export function parseCfOutput(stdout: string, stderr: string, exitCode: number): ParsedResult {
  const result: ParsedResult = {
    verdict: exitCode === 0 ? 'Accepted' : 'Wrong Answer',
    passedCount: 0,
    totalCount: 0,
    samples: [],
    timestamp: new Date().toLocaleTimeString(),
  };

  // Strip ANSI escape codes and combine
  const combined = (stdout + "\n" + stderr).replace(/\x1B\[[0-9;]*[JKmsu]/g, '');

  // Parse resource usage (taking max over all runs)
  const usageMatches = Array.from(combined.matchAll(/RESOURCE_USAGE:\s*([\d.]+)\s*(\d+)/g));
  let maxRuntime = 0;
  let maxMemory = 0;
  let hasUsage = false;
  for (const m of usageMatches) {
    hasUsage = true;
    maxRuntime = Math.max(maxRuntime, Math.round(parseFloat(m[1]) * 1000));
    maxMemory = Math.max(maxMemory, parseInt(m[2]));
  }
  if (hasUsage) {
    result.runtime = maxRuntime;
    result.memory = (maxMemory / 1024).toFixed(1);
  }

  // Parse total counts: Total: 3 | Passed: 3 | Failed: 0
  const summaryMatch = combined.match(/Total:\s*(\d+)\s*\|\s*Passed:\s*(\d+)\s*\|\s*Failed:\s*(\d+)/);
  if (summaryMatch) {
    result.totalCount = parseInt(summaryMatch[1]);
    result.passedCount = parseInt(summaryMatch[2]);
    if (result.passedCount < result.totalCount) {
      result.verdict = 'Wrong Answer';
    }
  }

  // Parse individual samples
  const sampleRegex = /Sample #(\d+): (PASSED|FAILED)/g;
  let match;
  while ((match = sampleRegex.exec(combined)) !== null) {
    result.samples.push({
      id: parseInt(match[1]),
      passed: match[2] === 'PASSED',
    });
  }

  // If we only have 1 sample (e.g. from run command)
  if (result.totalCount === 0 && result.samples.length === 0) {
    const singlePassed = combined.includes("Output matches expected.");
    const singleFailed = combined.includes("Output does not match expected.");
    if (singlePassed || singleFailed) {
      result.totalCount = 1;
      result.passedCount = singlePassed ? 1 : 0;
      result.verdict = singlePassed ? 'Accepted' : 'Wrong Answer';
      result.samples.push({ id: 1, passed: singlePassed });
    }
  }

  if (stderr && exitCode !== 0 && !summaryMatch) {
    result.verdict = 'Runtime Error';
  }

  return result;
}

export async function runCfCommand(args: string[], options: { cwd?: string; input?: string } = {}): Promise<{ stdout: string; stderr: string; exitCode: number; parsed?: ParsedResult }> {
  return new Promise((resolve) => {
    const child = spawn(CF_SCRIPT, args, {
      cwd: options.cwd || REPO_ROOT,
      env: { ...process.env, CF_REPO_ROOT: REPO_ROOT, CF_NONINTERACTIVE: '1' },
    });

    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const exitCode = code ?? 0;
      const parsed = parseCfOutput(stdout, stderr, exitCode);
      resolve({ stdout, stderr, exitCode, parsed });
    });
  });
}

export async function listProblems() {
  const problemsDir = getProblemsDir();
  try {
    const entries = await fs.readdir(problemsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(name => !name.startsWith('.') && name !== 'include' && name !== 'build' && name !== 'web');
  } catch (e) {
    return [];
  }
}

export async function saveSolution(problem: string, code: string) {
  const problemDir = path.join(getProblemsDir(), problem);
  if (!(await fs.stat(problemDir).catch(() => null))) {
    await fs.mkdir(problemDir, { recursive: true });
  }
  const solutionFile = path.join(problemDir, 'solution.cpp');
  
  // Only write if content changed to prevent unnecessary overrides and preserve timestamps
  const current = await fs.readFile(solutionFile, 'utf-8').catch(() => null);
  if (current === code) return;
  
  await fs.writeFile(solutionFile, code);
}

export async function getSolution(problem: string) {
  const solutionFile = path.join(getProblemsDir(), problem, 'solution.cpp');
  try {
    return await fs.readFile(solutionFile, 'utf-8');
  } catch (e) {
    return '';
  }
}

export async function saveProblemText(problem: string, text: string) {
    const problemsDir = getProblemsDir();
    const problemDir = path.join(problemsDir, problem);
    if (!(await fs.stat(problemDir).catch(() => null))) {
        await fs.mkdir(problemDir, { recursive: true });
    }
    const problemFile = path.join(problemDir, 'problem.txt');

    // Only write if content changed
    const current = await fs.readFile(problemFile, 'utf-8').catch(() => null);
    if (current === text) return;

    await fs.writeFile(problemFile, text);
}

export async function getProblemText(problem: string) {
    const problemFile = path.join(getProblemsDir(), problem, 'problem.txt');
    try {
        return await fs.readFile(problemFile, 'utf-8');
    } catch (e) {
        return '';
    }
}
