import { LLMRouter, ClassifyResult, EvaluatedResult, parseLLMTaskRequest, LLMTaskRequest, PrivacyLevel } from '../../llm/src/index.js';
import { SesEmailInput, formatSesEmailInput, SES_CATEGORIES } from './sesEmail.js';
import { SES_SYSTEM_PROMPT } from './sesSystemPrompt.js';

export interface ClassifySesEmailOptions {
  /** SES案件情報・スキルシートは個人情報/契約情報を含むため、既定値は 'high'（spec section 11）。 */
  privacyLevel?: PrivacyLevel;
}

/**
 * Domain-specific validator (the "Validator" box in the spec's Phase 1
 * pipeline): confirms the model actually returned one of the categories
 * this domain knows about. The generic Evaluator has no idea what "ses"
 * categories look like, so that check belongs here, next to the domain.
 */
function validateSesCategory(evaluated: EvaluatedResult<ClassifyResult>): EvaluatedResult<ClassifyResult> {
  if ((SES_CATEGORIES as readonly string[]).includes(evaluated.output.category)) {
    return evaluated;
  }
  return {
    ...evaluated,
    verified: false,
    needsHumanReview: true,
    notes: [
      ...evaluated.notes,
      `model returned category "${evaluated.output.category}", which is not one of the known SES categories (${SES_CATEGORIES.join(', ')})`,
    ],
  };
}

/**
 * First real Local Model use case for Light One (spec section 6/7,
 * Phase 1): LLM Task -> Router -> ses-classifier -> Structured Output ->
 * Validator -> Evaluator -> Result. No fine-tuning yet — this is a base
 * local model plus an SES-specific system prompt.
 */
export async function classifySesEmail(
  router: LLMRouter,
  email: SesEmailInput,
  options: ClassifySesEmailOptions = {},
): Promise<EvaluatedResult<ClassifyResult>> {
  const request: LLMTaskRequest = {
    task_type: 'classify',
    domain: 'ses',
    input: formatSesEmailInput(email),
    requirements: {
      privacy: options.privacyLevel ?? 'high',
      accuracy: 'medium',
      latency: 'low',
    },
  };
  const task = parseLLMTaskRequest(request);
  const evaluated = await router.executeClassify(task, { systemPrompt: SES_SYSTEM_PROMPT });
  return validateSesCategory(evaluated);
}
