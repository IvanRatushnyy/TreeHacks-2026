# Model Training
This directory covers custom model training and has several utility scripts for this purpose.


## Inference
```bash
uv run infer.py "censor: hello my name is Jane Doe and my phone is 415-555-1234"
```

uv run merge_lora.py --lora ./lfm2-350m-lora --out ./lfm2-350m-merged