import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_id = "LiquidAI/LFM2-350M"

tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto",   # uses GPU if available
    dtype="auto",
)

messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Give me a 1-sentence summary of what LFM2 is."},
]

prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

with torch.no_grad():
    out = model.generate(
        **inputs,
        max_new_tokens=120,
        temperature=0.3,
        repetition_penalty=1.05,
        # min_p is recommended by Liquid for this model family
        # (Transformers support depends on version; if unsupported, just omit it)
    )

print(tokenizer.decode(out[0], skip_special_tokens=True))