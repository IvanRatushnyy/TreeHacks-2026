# TreeHacks 2026


Project initialized on February 13, 2026.

## File Structure
- `/ai-models` This folder contains all code relating to AI models.
    - `/pii` This folder contains all model scripts that deal with personally identifiable information. 
        - `/lfm2-browser-demo` This is a small demo I used to test the personally identifiable information models.
        - `/onnx-export` Liquid AI models have a special structure and thus need custom harnesses for exportation.
    - `codegen.py` This is a claude script that generates synthetic data for transfer learning.
    - `fine_tune.py` This is a fine-tuning script that looks at the `synthetic_train.jsonl` and does the LORA tune.
    -  `infer.py` An inference script that loads the model and the adapter and runs the model on the prompt, logging the output. Used to test various experimental models.
        - *Usage:* `uv run infer.py "censor: hello my name is Jane Doe and my phone is 415-555-1234"`
    - `merge_lora.py` Merges the LORA adapter onto the model itself and exports it to a file.
        - *Usage:*

## AI Format
The AI format is really simple.

## Running the frontend
The front-end is written in React. It is a single page application and can be run with the following shell script:
```bash
chmod +x run-frontend.sh && ./run-frontend.sh
```

## Running the API
The api is the server api which is deployed to a remote server. It is written primarily in Python:
```bash
chmod +x run-api.sh && ./run-api.sh
```
