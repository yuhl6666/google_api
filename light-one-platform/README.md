# Light One — Local LLM Platform (Phase 1)

Foundation for running **multiple task-specific Local/API models** behind
one Router, instead of one general-purpose LLM for everything. This is a
new, self-contained package inside the repo — it does not touch
`app/`, `frontend/`, `functions/`, `supabase/`, or `insurance-risk-diagnosis/`.

```
User / Automation Engine
        │
     LLM Task            { task_type, domain, input, requirements }
        │
    LLM Router            rule-based: deterministic → local → cheap API → premium API,
        │                 with privacy_level as a hard constraint
        ▼
 ┌──────┴───────┬─────────────┬─────────────┬─────────────┐
 Deterministic   Local Model   Claude        GPT           Gemini
 (empty input,   (Ollama)      Provider      Provider      Provider
  pure Python-   e.g.
  style checks)  ses-classifier
        │
 Structured Output (JSON: category / confidence / reason)
        │
   Validator (domain-specific: is this a category the domain knows about?)
        │
   Evaluator (domain-agnostic: never trust confidence as a probability)
        │
      Result   { output, verified, needsHumanReview, notes, trace }
```

## Repository layout

```
light-one-platform/
├── docs/
│   ├── architecture/runtime-comparison.md   Ollama vs llama.cpp vs vLLM vs Transformers
│   └── ai/ses-classifier.md                 SES model's Phase 1-4 plan
├── llm/src/
│   ├── schemas/        TaskMetadata, LLMTask (wire format + internal), result types
│   ├── interfaces/      LLMProvider, LocalModel, typed error hierarchy
│   ├── providers/
│   │   ├── local/       OllamaProvider (real adapter), MockLocalModel (test double)
│   │   ├── claude/, openai/, gemini/   thin fetch-based API providers, same interface
│   │   └── shared/       JSON structured-output parsing shared by every provider
│   ├── registry/        models.json (data) + ModelRegistry (loader/query)
│   ├── deterministic/    rules that must never go through an LLM
│   ├── router/           LLMRouter (rule-based routing + classify pipeline)
│   └── evaluator/        confidence clamping / human-review flagging
├── models/ses/           first domain model: prompt, input formatting, validator
└── tests/                router / local-model / SES / integration test suites
```

## Running it

```bash
cd light-one-platform
npm install
npm run typecheck
npm test
```

Everything above runs with **no external services** — tests use
`MockLocalModel`, a deterministic in-memory stand-in for `LocalModel`.

To actually run the SES classifier against a real local model:

```bash
# once, on a machine with Ollama installed (https://ollama.com):
ollama pull llama3.1:8b
ollama serve   # if not already running as a service
```

```ts
import { ModelRegistry, LLMRouter, OllamaProvider } from './llm/src/index.js';
import { classifySesEmail } from './models/ses/sesClassifier.js';

const registry = ModelRegistry.loadDefault();
const router = new LLMRouter(registry, (descriptor) => {
  if (descriptor.runtime.kind === 'ollama') {
    return new OllamaProvider({ modelId: descriptor.runtime.model, name: descriptor.id });
  }
  throw new Error(`no provider wired up for runtime kind "${descriptor.runtime.kind}" yet`);
});

const result = await classifySesEmail(router, {
  subject: '【急募】AWSインフラエンジニア案件のご紹介',
  body: '単価80万円、東京(リモート可)、AWS/Terraform/Kubernetes必須、週5日稼働',
  sender: 'project-info@ses-agency.example.com',
});
console.log(result);
// { output: { category: 'project', confidence: 0.9, reason: '...' },
//   verified: true, needsHumanReview: false, notes: [], trace: {...} }
```

An Automation Engine calls the same flow via the wire-format `LLMTaskRequest`
(spec section 8) through `parseLLMTaskRequest` + `router.executeClassify`.

---

## Final report

### 1. What was implemented

A first-class **multi-model foundation**: a typed task/result schema, an
`LLMProvider`/`LocalModel` interface every model (local or API) implements,
a JSON-backed Model Registry, a rule-based Router that picks a model from
task metadata, a domain-agnostic Evaluator, and the first real domain
model — an SES email classifier — running Phase 1 (base model + prompt +
structured output + validation, no fine-tuning yet). 23 tests cover
routing rules, `OllamaProvider`'s error handling, the SES classifier, and
the full task→result pipeline.

### 2. File structure

See "Repository layout" above — it mirrors the structure the task spec
recommended (`docs/`, `llm/`, `models/`, `tests/`) almost exactly, wrapped
in one `light-one-platform/` root so it stays a clearly separate, addable
package rather than restructuring anything already in the repo.

### 3. Runtime selection reasoning

Full comparison in `docs/architecture/runtime-comparison.md`. Short
version: this repo currently has **zero Python and zero GPU-serving
infrastructure**, and the spec explicitly rules out standing up heavy new
infra for Phase 1. Ollama is the only one of the four candidates that gets
"a local model actually answering requests" running today with none of
that — one binary, a REST API on `localhost:11434`, JSON in/out. The
`OllamaProvider` adapter is a ~150-line `fetch` wrapper with zero SDK
dependency, isolated behind the `LocalModel` interface so a future
llama.cpp/vLLM/ONNX Runtime adapter (or a Light One-native engine) is a new
class, not a rewrite.

### 4. Model selection reasoning

Phase 1 does not fine-tune anything (spec explicitly defers that to Phase
3), so `ses-classifier` in the Registry points at the same base model tag
as `general-local` (`llama3.1:8b`) — an 8B instruction-tuned model is small
enough to run CPU-only at usable latency for a synchronous email
classification call, while still following a JSON-output system prompt
reliably enough for Phase 1's purposes. What actually makes `ses-classifier`
"SES" today is the system prompt (`models/ses/sesSystemPrompt.ts`) and the
domain validator (`models/ses/sesClassifier.ts`) — not different weights
yet. `ses-normalizer`, `insurance-classifier`, and `succession-analyzer`
are registered as `status: "planned"` so the Router/Registry already know
they'll exist, without anyone having built or trained them (per spec
section 1: don't mass-produce models, build the foundation first).

### 5. Router design

Rule-based, in priority order, evaluated in `LLMRouter.route()`
(`llm/src/router/llmRouter.ts`):

1. **Deterministic gate first** (`llm/src/deterministic/deterministicGate.ts`) —
   e.g. empty input never reaches a model at all.
2. **Privacy is a hard constraint**, not a preference — only models whose
   `privacyClass` covers the task's `privacyLevel` are ever eligible, full
   stop (spec section 11). A privacy="high" task is never routed to an API
   provider even if that would otherwise be the "better" choice.
3. **Domain-specific model wins** over `general` when both are eligible.
4. **Cost-first**: a local model is used whenever it's sufficient
   (`complexity` and `accuracy_requirement` both ≤ "medium"); only a task
   that genuinely needs more — high complexity or high accuracy — is
   routed to an API model, and even then the cheapest capable one unless
   complexity is specifically "high" (which goes straight to the most
   capable/priciest option). This directly encodes spec section 10's
   "Deterministic → Local → cheap API → premium API" ordering.

### 6. Test results

```
✓ tests/localModel.test.ts (9 tests)     — OllamaProvider: normal inference,
                                            malformed JSON, missing fields,
                                            unreachable server, model not
                                            pulled (404), timeout, empty
                                            input, isAvailable() both ways
✓ tests/router.test.ts (6 tests)         — the 4 required routing scenarios
                                            plus domain-preference and a
                                            no-eligible-model error case
✓ tests/sesClassifier.test.ts (4 tests)  — verified/high-confidence path,
                                            low-confidence → human review,
                                            unknown category → human review,
                                            always routes through ses-classifier
✓ tests/integration.test.ts (4 tests)    — full Task→Router→Model→
                                            Evaluator→Result pipeline,
                                            deterministic short-circuit,
                                            confidence clamping, error
                                            propagation

Test Files  4 passed (4)
     Tests  23 passed (23)
```

`npm run typecheck` (strict TypeScript) also passes clean.

### 7. Current constraints

- **No existing "AI Automation Engine" was found in this repository** —
  the task spec assumed one exists to define a responsibility boundary
  against; `app/`/`config/` are an unrelated, unused Rails scaffold per the
  root `README.md`, and `frontend/`/`functions/`/`supabase/` belong to the
  succession-matching product. This package is therefore the first piece
  of AI infrastructure in the repo, not an addition to an existing engine;
  wiring an actual Automation Engine to `LLMTaskRequest` is future work.
- `ses-classifier` has no fine-tuned weights yet — it's a prompted base
  model, so accuracy depends entirely on prompt quality until Phase 2 data
  collection happens.
- No live end-to-end run against a real Ollama server was performed in
  this sandbox (no GPU/Ollama process available here) — `OllamaProvider`
  is verified against a mocked `fetch`, which exercises the exact HTTP
  request/response contract Ollama's API documents.
- `ses-normalizer`, `insurance-classifier`, and `succession-analyzer` are
  registry entries only (`status: "planned"`) — no prompts or providers
  built for them yet.
- Claude/OpenAI/Gemini providers are real, working `fetch` wrappers but
  untested against live APIs in this change (no API keys in this
  sandbox); they throw a clear `ModelUnavailableError` when no key is
  configured rather than failing silently.

### 8. Data needed for Phase 2 fine-tuning

See `docs/ai/ses-classifier.md` for the full plan. Short version: labeled
`{subject, body, sender, attachmentNames} → category` pairs, a few hundred
per category minimum, with deliberate coverage of ambiguous cases (mixed
engineer/sales signals, forwarded postings, non-Japanese emails). The
Evaluator's `needsHumanReview` flag is designed to double as an ongoing,
low-effort source of exactly this data once it's running in production.

### 9. Next tasks

1. Wire a real Automation Engine (or whatever calls this first) to
   `LLMTaskRequest`/`router.executeClassify` end to end against a live
   Ollama process.
2. Start Phase 2 data collection for SES (see above) — the sooner
   `needsHumanReview` results start getting confirmed/corrected, the
   sooner there's a real dataset.
3. Build the next domain model against the same foundation —
   `insurance-classifier` is already registered as `planned` and is the
   most likely next candidate given the existing `insurance-risk-diagnosis`
   product in this repo.
4. Add a second local runtime adapter (llama.cpp server is the natural
   next one) to prove the `LocalModel` interface boundary holds under a
   real second implementation, not just in theory.
5. Decide where Model Registry data should live long-term (`models.json`
   is fine for Phase 1; a DB-backed registry per spec section 5 becomes
   worth it once multiple teams are adding models independently).
