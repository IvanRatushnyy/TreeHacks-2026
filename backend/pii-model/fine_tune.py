import os
import torch
from datasets import load_dataset, DatasetDict
from transformers import AutoModelForCausalLM, AutoTokenizer, EarlyStoppingCallback
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

MODEL_ID = "LiquidAI/LFM2-350M"
OUT_DIR = "./lfm2-350m-lora"
TRAIN_FILE = "./synthetic_train.jsonl"

def main():
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        device_map="auto",
        torch_dtype="auto",
    )

    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        task_type="CAUSAL_LM",
    )

    # Load JSONL with columns: prompt, response
    train_ds = load_dataset("json", data_files=TRAIN_FILE)["train"]
    split = train_ds.train_test_split(test_size=0.02, seed=42)
    ds = DatasetDict(train=split["train"], validation=split["test"])

    # Build a single text field (must be a STRING)
    def to_text(ex):
        prompt = (ex.get("prompt") or "").strip()
        response = (ex.get("response") or "").strip()
        text = f"### Instruction:\n{prompt}\n\n### Response:\n{response}{tokenizer.eos_token}"
        return {"text": text}

    ds = ds.map(to_text, remove_columns=ds["train"].column_names)

    args = SFTConfig(
        output_dir=OUT_DIR,
        num_train_epochs=10,          # set high; early stopping will cut it short
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,

        eval_strategy="steps",
        eval_steps=200,

        logging_strategy="steps",
        logging_steps=10,

        save_strategy="steps",
        save_steps=200,

        load_best_model_at_end=True,  # required for best checkpoint behavior
        metric_for_best_model="eval_loss",
        greater_is_better=False,

        report_to="none",
        bf16=torch.cuda.is_available(),
        max_length=512,
        packing=True,
        dataset_text_field="text",
    )

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=ds["train"],
        eval_dataset=ds["validation"],
        peft_config=peft_config,
    )

    trainer.train()
    trainer.save_model(OUT_DIR)
    tokenizer.save_pretrained(OUT_DIR)
    print("Saved LoRA adapter to:", OUT_DIR)

if __name__ == "__main__":
    main()
