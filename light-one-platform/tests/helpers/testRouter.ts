import { ModelRegistry, ModelDescriptor, LLMRouter, ProviderFactory } from '../../llm/src/index.js';
import { MockLocalModel, MockScenario } from '../../llm/src/providers/local/mockLocalModel.js';

/**
 * Wires an LLMRouter against the real bundled registry, but with every
 * model backed by a MockLocalModel instead of a real Ollama/API call —
 * lets router/pipeline tests control model behavior precisely without a
 * network dependency. `scenarios` maps model id -> canned behavior;
 * anything not listed defaults to a generic low-confidence "success".
 */
export function createTestRouter(scenarios: Record<string, MockScenario> = {}) {
  const registry = ModelRegistry.loadDefault();
  const providers = new Map<string, MockLocalModel>();

  const providerFactory: ProviderFactory = (descriptor: ModelDescriptor) => {
    const existing = providers.get(descriptor.id);
    if (existing) return existing;
    const scenario: MockScenario = scenarios[descriptor.id] ?? { kind: 'success', result: { category: 'other', confidence: 0.5 } };
    const model = new MockLocalModel(descriptor.id, descriptor.id, scenario);
    providers.set(descriptor.id, model);
    return model;
  };

  const router = new LLMRouter(registry, providerFactory);
  return { router, registry, providers };
}
