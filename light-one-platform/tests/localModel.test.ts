import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from '../llm/src/providers/local/ollamaProvider.js';
import { InvalidInputError, MalformedOutputError, ModelTimeoutError, ModelUnavailableError } from '../llm/src/interfaces/errors.js';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('OllamaProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('classifies normally when Ollama returns a well-formed JSON response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ response: JSON.stringify({ category: 'project', confidence: 0.94, reason: 'AWS案件の募集要項が記載' }) }),
    );
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b' });

    const result = await provider.classify({ input: '件名: AWS案件募集' });

    expect(result).toEqual({ category: 'project', confidence: 0.94, reason: 'AWS案件の募集要項が記載' });
  });

  it('throws MalformedOutputError when the model response is not valid JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: 'これはプロジェクト案件だと思います' }));
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b' });

    await expect(provider.classify({ input: 'hello' })).rejects.toThrow(MalformedOutputError);
  });

  it('throws MalformedOutputError when the JSON is well-formed but missing required fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: JSON.stringify({ confidence: 0.9 }) }));
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b' });

    await expect(provider.classify({ input: 'hello' })).rejects.toThrow(/missing a non-empty "category"/);
  });

  it('throws ModelUnavailableError when Ollama cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b' });

    await expect(provider.classify({ input: 'hello' })).rejects.toThrow(ModelUnavailableError);
  });

  it('throws ModelUnavailableError when Ollama does not have the model pulled (404)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 404));
    const provider = new OllamaProvider({ modelId: 'not-pulled:8b' });

    await expect(provider.classify({ input: 'hello' })).rejects.toThrow(/not pulled in Ollama/);
  });

  it('throws ModelTimeoutError when the request does not complete before the deadline', async () => {
    fetchMock.mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b' });

    await expect(provider.classify({ input: 'hello', timeoutMs: 20 })).rejects.toThrow(ModelTimeoutError);
  });

  it('rejects empty input before ever calling Ollama', async () => {
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b' });

    await expect(provider.classify({ input: '   ' })).rejects.toThrow(InvalidInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isAvailable reflects whether the model is present in Ollama', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ models: [{ name: 'llama3.1:8b' }] }));
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b' });
    await expect(provider.isAvailable()).resolves.toBe(true);
  });

  it('isAvailable returns false when Ollama is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const provider = new OllamaProvider({ modelId: 'llama3.1:8b' });
    await expect(provider.isAvailable()).resolves.toBe(false);
  });
});
