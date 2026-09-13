/** Base class for every failure a provider can raise. Routers/callers can
 * branch on `.code` without needing to know which provider threw it. */
export class LLMProviderError extends Error {
  constructor(message: string, public readonly code: string, public readonly providerName: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ModelUnavailableError extends LLMProviderError {
  constructor(providerName: string, message = 'model is unavailable') {
    super(message, 'MODEL_UNAVAILABLE', providerName);
  }
}

export class ModelTimeoutError extends LLMProviderError {
  constructor(providerName: string, timeoutMs: number) {
    super(`request timed out after ${timeoutMs}ms`, 'TIMEOUT', providerName);
  }
}

/** The model responded, but not with something we can use (bad JSON, missing fields, ...). */
export class MalformedOutputError extends LLMProviderError {
  constructor(providerName: string, message: string, public readonly raw?: string) {
    super(message, 'MALFORMED_OUTPUT', providerName);
  }
}

export class InvalidInputError extends LLMProviderError {
  constructor(providerName: string, message: string) {
    super(message, 'INVALID_INPUT', providerName);
  }
}
