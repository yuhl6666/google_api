# SES Classifier — Phase Plan

Light One's first real Local Model use case (spec section 6/7). Classifies
an incoming SES-related email into `project` / `engineer` / `sales` /
`other`.

## Phase 1 — done in this change

```
Base local model (general-local's runtime, e.g. llama3.1:8b via Ollama)
  -> SES system prompt (models/ses/sesSystemPrompt.ts)
  -> Structured Output (JSON: category/confidence/reason)
  -> Validator (models/ses/sesClassifier.ts: category ∈ known SES taxonomy)
  -> Evaluator (llm/src/evaluator/evaluator.ts: confidence clamping/threshold)
  -> Result
```

No fine-tuning. `ses-classifier` in the Registry points at the same base
model tag as `general-local` — the only thing that makes it "SES" right
now is the system prompt and the domain-specific validator. This is
intentional: it proves the Router/Registry/Provider/Evaluator plumbing end
to end before spending effort on a dataset or training run.

## Phase 2 — data collection (next)

To move past prompting, we need labeled examples of the same kind of
email this classifier already sees in production:

- Raw email fields already defined in `models/ses/sesEmail.ts`
  (`subject`, `body`, `sender`, `attachmentNames`) — collect these as-is,
  attachment *contents* are never needed for this task.
- A human-assigned label in `{project, engineer, sales, other}` per email
  — ideally from whoever currently triages these emails manually, since
  they're the ground truth this model is trying to approximate.
- Coverage across the harder cases, not just the obvious ones: emails that
  mix an engineer profile with a sales pitch, forwarded/quoted project
  postings, non-Japanese emails, emails with no clear signal either way
  (these should end up labeled `other`).
- A minimum viable set is a few hundred labeled emails per category before
  fine-tuning is worth attempting; until then, Phase 1's prompt-only
  approach plus the Evaluator's human-review flag is the safety net.
- Every `needsHumanReview: true` result the Evaluator produces in
  production is itself a candidate labeled example once a human confirms
  or corrects it — this is the cheapest ongoing source of Phase 2 data and
  doesn't require a separate collection effort.

## Phase 3 — LoRA / fine-tuning

Once a labeled dataset exists: fine-tune (LoRA on top of the same base
model family already running in Ollama, to keep the deployment story
identical) a dedicated `ses-classifier` weight set, register it in
`models.json` with its own `runtime.model` tag, and drop the system prompt
down to a short instruction (the fine-tune carries most of what the long
Phase 1 prompt currently spells out).

## Phase 4 — quantization / speed

Quantize the fine-tuned model (e.g. Q4/Q5 GGUF) for faster local inference
once accuracy at full precision is validated — this is a pure deployment
optimization and shouldn't change the `LocalModel` interface at all.
