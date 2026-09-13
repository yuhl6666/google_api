# Runtime Dependency Boundary

Written for the move to Light One's real Linux server, where Ollama and
real models will actually be reachable (this repo's remote development
sandbox blocks egress to `ollama.com`/`huggingface.co` by organization
policy — see the root README's "Remote environment limitation" section).
This documents exactly what depends on what, so nothing is a surprise when
`MockLocalModel` is swapped for `OllamaProvider` against a real server.

## Ollama dependency — isolated to one file

Only `llm/src/providers/local/ollamaProvider.ts` knows Ollama exists. It
talks to Ollama purely over its HTTP API (`fetch` to `/api/generate`,
`/api/tags`, `/api/embeddings`) — no Ollama SDK, no child-process spawning,
no assumption about how Ollama itself is installed or launched. Everything
above it (`LLMRouter`, `ModelRegistry`, `models/ses/*`) only ever sees the
`LocalModel`/`LLMProvider` interface. Swapping runtimes later (llama.cpp
server, vLLM's OpenAI-compatible endpoint, a future Light One-native
engine) means writing one new provider class, not touching the Router or
any domain model.

## Model download dependency — none in this codebase

This codebase never downloads model weights. `ollama pull <model>` (or
Ollama's own auto-pull-on-first-use behavior, if enabled) is entirely
Ollama's responsibility. `OllamaProvider` just asks Ollama for a model tag
and reports `ModelUnavailableError` if Ollama says it doesn't have it (see
the 404 branch in `callOllama()`). This means:

- The remote sandbox correctly does **no** network calls to any model
  registry — there is nothing to disable, since the code never attempted
  one in the first place.
- On the real Linux server, whoever provisions it runs `ollama pull
  <model>` once, and the model name is picked up from the Registry (see
  "Provider configuration" below) — no code change needed either way.

## GPU dependency — none in this codebase, entirely internal to Ollama

Ollama auto-detects a GPU and uses it if present, falling back to CPU
otherwise — this is Ollama's own behavior, invisible to `OllamaProvider`.
Nothing in this repo checks for a GPU, sets CUDA flags, or picks a
different code path based on hardware. The only place hardware matters to
*this* codebase is choosing which model tag to put in `models.json` (a
CPU-only box wants a smaller/more aggressively quantized model than a
GPU box) and interpreting benchmark latency numbers — see
`scripts/check-local-ai.sh` for a hardware report to inform that choice.

## CPU fallback — implicit, not a separate code path

There is no `if (gpu) {...} else {...}` anywhere in this codebase for a
reason: Ollama already handles the GPU/CPU decision, so `OllamaProvider`
sends the same request either way. The only consequence on this side is
latency, which is exactly what the benchmark runner
(`models/ses/benchmark/runBenchmark.ts`) measures and reports (average/p50/
p95) so a CPU-only deployment's real latency is visible, not assumed.

## Environment variables

| Variable | Read by | Default | Purpose |
|---|---|---|---|
| `OLLAMA_HOST` | `OllamaProvider` constructor | `http://localhost:11434` | Where Ollama's HTTP API is listening |
| `SES_CLASSIFIER_MODEL` | `models/ses/benchmark/runBenchmark.ts` only | the Registry's `ses-classifier.runtime.model` | Convenience override to try a different model against the benchmark without editing `models.json` |
| `ANTHROPIC_API_KEY` | `ClaudeProvider` | unset | If unset, `ClaudeProvider` throws `ModelUnavailableError` rather than silently failing |
| `OPENAI_API_KEY` | `OpenAIProvider` | unset | Same pattern as above |
| `GEMINI_API_KEY` | `GeminiProvider` | unset | Same pattern as above |

None of these are required for the Mock-based test suite (`npm test`) to
pass — they only matter once something tries to reach a real provider.

## Provider configuration — driven entirely by the Registry, never hardcoded

Every call site that constructs a provider (the benchmark runner, and the
usage example in the root README) reads the model name from a
`ModelDescriptor`'s `runtime` field, e.g.:

```ts
const descriptor = registry.get('ses-classifier');
if (descriptor.runtime.kind === 'ollama') {
  new OllamaProvider({ modelId: descriptor.runtime.model, name: descriptor.id });
}
```

Nothing in `llm/` or `models/` contains a literal model tag string outside
of `llm/src/registry/models.json` itself. Changing which Ollama model
backs `ses-classifier` is a one-line JSON edit (or the `SES_CLASSIFIER_MODEL`
env override for a quick benchmark run) — see the root README's "Swapping
the SES model" section.
