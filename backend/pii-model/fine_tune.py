import os
import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

MODEL_ID = "LiquidAI/LFM2-350M"
OUT_DIR = "./lfm2-350m-lora"

def main():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        device_map="auto",
        dtype="auto",
    )

    # If you don't know the exact module names, keep this as the common safe default.
    # Liquid's TRL page shows targeting attention projections like q/k/v/o. :contentReference[oaicite:6]{index=6}
    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        task_type="CAUSAL_LM",
    )

    # Example dataset (swap for your own)
    # For your task: format examples as chat turns (system/user/assistant) for best results.
    dataset = load_dataset("HuggingFaceTB/smoltalk", "all")  # quick sanity-check dataset

    args = SFTConfig(
        output_dir=OUT_DIR,
        num_train_epochs=1,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        logging_steps=10,
        save_steps=200,
        bf16=torch.cuda.is_available(),  # safe default; you can force fp16 if needed
    )

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=dataset["train"],
        tokenizer=tokenizer,
        peft_config=peft_config,
    )

    trainer.train()
    trainer.save_model(OUT_DIR)
    tokenizer.save_pretrained(OUT_DIR)
    print("Saved LoRA adapter to:", OUT_DIR)

if __name__ == "__main__":
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    main()
