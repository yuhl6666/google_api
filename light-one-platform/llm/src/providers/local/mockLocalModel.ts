import { LocalModel } from '../../interfaces/localModel.js';
import { ClassifyRequest, EmbedRequest, GenerateRequest } from '../../interfaces/llmProvider.js';
import { InvalidInputError, MalformedOutputError, ModelTimeoutError, ModelUnavailableError } from '../../interfaces/errors.js';
import { ClassifyResult, EmbedResult, GenerateResult } from '../../schemas/results.js';

export type MockScenario =
  | { kind: 'success'; result: ClassifyResult }
  | { kind: 'timeout' }
  | { kind: 'unavailable' }
  | { kind: 'malformed'; raw?: string }
  | { kind: 'invalid_json'; raw?: string };

/**
 * In-memory stand-in for a LocalModel, used by router/integration tests and
 * anywhere else exercising the routing/validation/evaluation pipeline
 * without needing a real Ollama server running. `OllamaProvider` has its
 * own tests (mocking `fetch`) that prove the real adapter maps the same
 * failure modes correctly.
 */
export class MockLocalModel implements LocalModel {
  readonly providerKind = 'local' as const;

  constructor(
    public readonly name: string,
    public readonly modelId: string,
    private scenario: MockScenario = { kind: 'success', result: { category: 'other', confidence: 0.5 } },
    private available = true,
  ) {}

  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    return { text: `[mock:${this.modelId}] ${request.input}` };
  }

  async classify(request: ClassifyRequest): Promise<ClassifyResult> {
    if (!request.input || request.input.trim().length === 0) {
      throw new InvalidInputError(this.name, 'input must not be empty');
    }
    switch (this.scenario.kind) {
      case 'success':
        return this.scenario.result;
      case 'timeout':
        throw new ModelTimeoutError(this.name, 1_000);
      case 'unavailable':
        throw new ModelUnavailableError(this.name);
      case 'malformed':
        throw new MalformedOutputError(this.name, 'model output is missing a non-empty "category" field', this.scenario.raw ?? '{"conf":0.9}');
      case 'invalid_json':
        throw new MalformedOutputError(this.name, 'model output was not valid JSON', this.scenario.raw ?? 'not-json{{{');
    }
  }

  async embed(request: EmbedRequest): Promise<EmbedResult> {
    if (!request.input || request.input.trim().length === 0) {
      throw new InvalidInputError(this.name, 'input must not be empty');
    }
    return { vector: [request.input.length] };
  }
}
