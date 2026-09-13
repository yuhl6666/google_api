from ollama import chat

response = chat(
    model="qwen3:4b",
    messages=[
        {
            "role": "user",
            "content": "Light One AI Automation Engineとは何か、1文で説明してください。",
        }
    ],
)

print(response.message.content)
