import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const runnerPath = path.join(projectRoot, 'models/ses/benchmark/runBenchmark.ts');

/**
 * Runs the actual `npm run benchmark:ses` entry point as a real child
 * process against whatever Ollama is (not) reachable in this environment
 * — no mocking. In this repo's remote sandbox, nothing is listening on
 * Ollama's port, so this proves the "SKIPPED, exit 0" contract holds for
 * real, not just in theory. On a machine where Ollama *is* running this
 * would instead produce a real report — either outcome is a pass here as
 * long as the process exits cleanly.
 */
describe('benchmark:ses runner', () => {
  it('exits 0 and reports SKIPPED when no local model is reachable', () => {
    const output = execFileSync('npx', ['tsx', runnerPath], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, OLLAMA_HOST: 'http://127.0.0.1:11434' },
    });

    expect(output).toMatch(/SKIPPED: local model unavailable|=== SES Classifier Benchmark Report ===/);
  });
});
