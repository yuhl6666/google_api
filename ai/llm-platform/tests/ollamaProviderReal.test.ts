import { describe, expect, it } from 'vitest';
import { OllamaProvider } from '../llm/src/providers/local/ollamaProvider.js';
import { ModelUnavailableError } from '../llm/src/interfaces/errors.js';

/**
 * Unlike localModel.test.ts (which mocks `fetch` to exercise every branch
 * of OllamaProvider's parsing logic), this file makes a real network call
 * to an Ollama endpoint that is genuinely not running in this environment
 * (see docs/ai/remote-environment-limitation.md) — no fetch mocking at
 * all. It proves the graceful-error contract holds against a real
 * connection-refused, not just a simulated one, which matters because
 * that is exactly what happens on a real machine before `ollama serve`
 * has been started or before a model has been pulled.
 *
 * If a real Ollama instance ever *is* reachable at this address when
 * these run (e.g. on the target Light One Linux server), these tests
 * should be skipped rather than failed — they intentionally assert on the
 * "nothing is listening" case.
 */
describe('OllamaProvider against a real, unreachable endpoint', () => {
  const UNREACHABLE_ENDPOINT = 'http://127.0.0.1:11434';

  it('reports isAvailable() as false without needing a mock', async () => {
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b', endpoint: UNREACHABLE_ENDPOINT });
    await expect(provider.isAvailable()).resolves.toBe(false);
  });

  it('classify() rejects with ModelUnavailableError, not an unhandled network exception', async () => {
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b', endpoint: UNREACHABLE_ENDPOINT, defaultTimeoutMs: 3_000 });
    await expect(provider.classify({ input: '件名: テスト案件のご紹介' })).rejects.toThrow(ModelUnavailableError);
  });

  it('generate() rejects with ModelUnavailableError, not an unhandled network exception', async () => {
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b', endpoint: UNREACHABLE_ENDPOINT, defaultTimeoutMs: 3_000 });
    await expect(provider.generate({ input: 'hello' })).rejects.toThrow(ModelUnavailableError);
  });
});
