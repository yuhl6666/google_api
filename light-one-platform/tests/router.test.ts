import { describe, expect, it } from 'vitest';
import { ModelRegistry, TaskMetadata } from '../llm/src/index.js';
import { LLMRouter } from '../llm/src/router/llmRouter.js';

function metadata(overrides: Partial<TaskMetadata>): TaskMetadata {
  return {
    taskType: 'classify',
    domain: 'general',
    complexity: 'low',
    latencyRequirement: 'medium',
    accuracyRequirement: 'medium',
    privacyLevel: 'medium',
    expectedInputSize: 100,
    ...overrides,
  };
}

// route() is a pure decision function, so these tests don't need any
// provider wired up — a stub factory that's never called is enough.
function makeRouter() {
  const registry = ModelRegistry.loadDefault();
  return new LLMRouter(registry, () => {
    throw new Error('provider factory should not be called by route()');
  });
}

describe('LLMRouter.route', () => {
  it('routes SES classification to ses-classifier', () => {
    const router = makeRouter();
    const decision = router.route(metadata({ domain: 'ses', privacyLevel: 'high' }));
    expect(decision.descriptor.id).toBe('ses-classifier');
  });

  it('routes to a local model when privacy is high, even for a high-complexity task', () => {
    const router = makeRouter();
    const decision = router.route(
      metadata({ domain: 'general', complexity: 'high', accuracyRequirement: 'high', privacyLevel: 'high' }),
    );
    expect(decision.descriptor.provider).toBe('local');
  });

  it('routes simple classification to a local model', () => {
    const router = makeRouter();
    const decision = router.route(metadata({ domain: 'general', complexity: 'low', accuracyRequirement: 'low' }));
    expect(decision.descriptor.provider).toBe('local');
    expect(decision.descriptor.id).toBe('general-local');
  });

  it('routes complex reasoning to an API model', () => {
    const router = makeRouter();
    const decision = router.route(
      metadata({ taskType: 'reason', domain: 'general', complexity: 'high', accuracyRequirement: 'high', privacyLevel: 'low' }),
    );
    expect(decision.descriptor.provider).not.toBe('local');
    expect(decision.descriptor.id).toBe('claude-sonnet');
  });

  it('prefers the domain-specific model over the general one when both are eligible', () => {
    const router = makeRouter();
    const decision = router.route(metadata({ domain: 'ses' }));
    expect(decision.descriptor.domain).toBe('ses');
  });

  it('throws when no active model can satisfy the requested privacy level for a capability', () => {
    const router = makeRouter();
    // 'reasoning' capability only exists on claude-sonnet (privacyClass "low"),
    // so a privacy="high" reasoning task has no eligible model in the registry.
    expect(() => router.route(metadata({ taskType: 'reason', domain: 'general', privacyLevel: 'high' }))).toThrow(
      /no active model can satisfy privacy_level="high"/,
    );
  });
});
