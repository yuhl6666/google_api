import { LLMProvider } from './llmProvider.js';

/**
 * Adapter boundary for local inference. Every local runtime (Ollama today;
 * llama.cpp / vLLM / ONNX Runtime tomorrow, or a future Light One-native
 * engine) implements this same shape so the Router and Registry never need
 * to know which runtime is behind a given model id — see
 * docs/architecture/runtime-comparison.md for why Ollama was picked first.
 */
export interface LocalModel extends LLMProvider {
  readonly providerKind: 'local';
  /** Runtime-specific identifier, e.g. the Ollama tag ("llama3.1:8b"). */
  readonly modelId: string;
  /** Cheap health check the Router/tests use to detect a model that isn't loaded/running. */
  isAvailable(): Promise<boolean>;
}
