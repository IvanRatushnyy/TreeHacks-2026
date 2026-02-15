import argparse
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="LiquidAI/LFM2-350M")
    ap.add_argument("--lora", required=True, help="Path to LoRA adapter folder")
    ap.add_argument("--out", required=True, help="Output folder for merged model")
    args = ap.parse_args()

    tok = AutoTokenizer.from_pretrained(args.base, use_fast=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    # Merge on CPU to avoid GPU VRAM spikes
    base = AutoModelForCausalLM.from_pretrained(
        args.base,
        device_map="cpu",
        torch_dtype=torch.float16,
    )

    model = PeftModel.from_pretrained(base, args.lora)
    model = model.merge_and_unload()
    model.eval()

    model.save_pretrained(args.out, safe_serialization=True)
    tok.save_pretrained(args.out)

    print("Merged model saved to:", args.out)

if __name__ == "__main__":
    main()
