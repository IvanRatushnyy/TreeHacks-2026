import argparse
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

BASE_MODEL = "LiquidAI/LFM2-350M"
LORA_PATH = "./lfm2-350m-lora"   # path to your saved adapter


def load_model():
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True)

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        device_map="auto",
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
    )

    print(f'Lora Path: {LORA_PATH}')
    model = PeftModel.from_pretrained(base_model, LORA_PATH)
    model.eval()

    return model, tokenizer


def generate(model, tokenizer, text, max_new_tokens=200):
    prompt = f"### Instruction:\n{text}\n\n### Response:\n"

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
    ).to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            temperature=0.0,
            top_p=1.0,
        )

    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract only the response part
    if "### Response:" in decoded:
        decoded = decoded.split("### Response:")[-1].strip()

    return decoded


def main():
    parser = argparse.ArgumentParser(description="Run LoRA PII model inference")
    parser.add_argument(
        "text",
        nargs="?",
        help="Input text to process"
    )
    parser.add_argument(
        "--text",
        dest="text_flag",
        help="Input text (alternative flag style)"
    )
    parser.add_argument(
        "--max_tokens",
        type=int,
        default=200,
        help="Maximum new tokens to generate"
    )

    args = parser.parse_args()

    input_text = args.text_flag if args.text_flag else args.text

    if not input_text:
        print("Error: You must provide input text.")
        print("Example: python infer.py \"hello my name is Jane Doe\"")
        return

    model, tokenizer = load_model()
    output = generate(model, tokenizer, input_text, args.max_tokens)

    print("\n=== OUTPUT ===\n")
    print(output)


if __name__ == "__main__":
    main()
