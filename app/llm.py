from abc import ABC, abstractmethod

from ollama import chat


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> str:
        pass


class OllamaProvider(LLMProvider):
    def __init__(self, model: str = "qwen3:0.6b"):
        self.model = model

    def generate(self, prompt: str) -> str:
        response = chat(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        )

        return response.message.content


class DummyLLM(LLMProvider):
    def generate(self, prompt: str) -> str:
        return f"LLM received: {prompt}"