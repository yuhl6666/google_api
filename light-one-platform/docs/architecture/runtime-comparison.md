# Local Inference Runtime Comparison

Evaluated for "first local runtime to wire up an Adapter for" — not a
permanent choice. The `LocalModel` interface (`llm/src/interfaces/localModel.ts`)
exists specifically so this can change later without touching the Router,
Registry, or any domain model.

| | Ollama | llama.cpp (server) | vLLM | Transformers (Python) |
|---|---|---|---|---|
| CPU-only inference | Yes, first-class | Yes, first-class | Poor (GPU-oriented) | Yes, but slow without GPU |
| GPU support | Yes (auto-detected) | Yes (build flag) | Yes, its whole reason to exist | Yes |
| Memory footprint | Manages model files/quantization for you | Small, you manage GGUF files yourself | High (built for throughput, not footprint) | High (full Python + framework stack) |
| Latency (single request, our use case) | Low | Low | Low only at batch/concurrency — overkill for one request at a time | Medium-high (Python overhead, cold start) |
| Model compatibility | Wide (GGUF via its own model library + pull-based registry) | Wide (GGUF), but you fetch/convert models yourself | Narrower (needs vLLM-supported architectures, wants GPU) | Widest (any HF model), heaviest to run |
| Deployment complexity | **Lowest** — one binary, `ollama serve`, `ollama pull`, REST API on `localhost:11434` | Low-medium — build/obtain a server binary, manage GGUF files and prompt templates yourself | High — Python + CUDA + GPU + config for something built for serving many concurrent requests | Medium-high — Python env, framework version pinning, no built-in serving layer (need to add one) |
| Runtime dependency for *this repo* | None beyond a running Ollama process — talked to over plain `fetch` | None beyond a running server binary, but our adapter would need to speak its API instead | Would add a Python service most contributors can't casually run today | Would add a Python runtime to a repo that currently has none |

## Decision: start with Ollama

Ollama wins on the one criterion that matters most for Phase 1: **simplest
path to "a local model actually answering requests today"**, in a repo that
today has zero Python and zero GPU-serving infrastructure (spec section 13
explicitly rules out standing up Kubernetes/heavy infra for this). It also
happens to expose almost exactly the shape this spec asks for — a local
HTTP server, JSON in/out, a pull-based model registry of its own — so the
`OllamaProvider` adapter (`llm/src/providers/local/ollamaProvider.ts`) is a
thin `fetch` wrapper with no SDK dependency.

llama.cpp's server mode is the natural second choice and the most likely
next Adapter to add (same GGUF models Ollama uses under the hood, more
control over quantization/context settings). vLLM and raw Transformers are
overkill for "one domain-specific classifier answering requests from one
process" — both are justified once Light One is running many concurrent
local models that need to share a GPU efficiently, which is explicitly out
of scope for Phase 1 (spec section 13: no independent inference engine, no
GPU kernels, no over-built infra).

## Adapter boundary

Nothing outside `llm/src/providers/local/ollamaProvider.ts` knows Ollama
exists. The Registry (`llm/src/registry/models.json`) records
`runtime: { kind: "ollama", model: "llama3.1:8b" }` per model; a future
runtime gets its own `kind` and its own provider class implementing the
same `LocalModel` interface. Swapping runtimes, or running two runtimes
side by side for different models, is a Registry + wiring change — see
`llm/src/router/llmRouter.ts`'s `ProviderFactory` type, which is exactly
"given a descriptor, hand back something implementing `LLMProvider`".
