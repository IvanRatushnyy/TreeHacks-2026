"""
Generate synthetic prompt/response training pairs using a Claude API key.

- Put a few seed examples in SEED_EXAMPLES at the top
- Run:  python synth_data_claude.py
- Output: ./synthetic_train.jsonl  (each line: {"prompt": "...", "response": "..."})

Install:
  pip install anthropic tenacity

Env:
  export ANTHROPIC_API_KEY="sk-ant-...."
"""

import os
import json
import time
import random
from typing import List, Dict

import anthropic
from tenacity import retry, wait_exponential_jitter, stop_after_attempt

# ----------------- CONFIG -----------------
MODEL = "claude-sonnet-4-20250514"  # change to the Claude model you have access to
OUT_PATH = "./synthetic_train.jsonl"

NUM_EXAMPLES_TO_GENERATE = 2000
BATCH_SIZE = 10  # how many pairs Claude returns per call
SLEEP_BETWEEN_CALLS_SEC = 0.0  # gentle rate limiting

# Your task/domain. Make this specific (helps quality a lot).
DOMAIN_INSTRUCTIONS = """
You generate high-quality supervised fine-tuning data as (prompt, response) pairs.

Rules:
- Make prompts realistic and varied.
- Responses must be correct, helpful, and consistent with the domain.
- Don’t include copyrighted passages.
- Return ONLY valid JSON matching the schema.
"""

# Put your few examples here:
SEED_EXAMPLES: List[Dict[str, str]] = [
    {
        "prompt": "censor: hello my name is Jane Doe, I live at 123 Palo Alto Way.",
        "response": "hello my name is [NAME], I love at [ADDRESS]."
    },
    {
        "prompt": "censor: my social security is 123458393, my cousin george lives here.",
        "response": "my social security is [SSN], my cousin [NAME] lives here."
    },
]

# Optional: If you want a specific style/format in outputs, describe it here.
STYLE_GUIDE = """
- Keep prompts self-contained.
- Prefer concise answers unless the prompt asks for depth.
- If code is requested, include runnable code blocks.
"""

# ----------------- CLAUDE CALL -----------------

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


def build_generation_prompt(seed_examples: List[Dict[str, str]], n: int) -> str:
    # Include a few seeds verbatim so the model mirrors your format/quality.
    seed_block = json.dumps(seed_examples, ensure_ascii=False, indent=2)

    return f"""
{DOMAIN_INSTRUCTIONS}

STYLE GUIDE:
{STYLE_GUIDE}

SEED EXAMPLES (for style + task calibration):
{seed_block}

Now generate {n} NEW training examples as JSON.
Schema:
{{
  "examples": [
    {{"prompt": "...", "response": "..."}},
    ...
  ]
}}

Hard requirements:
- Output MUST be valid JSON (no markdown, no commentary).
- All examples must be NEW (not copies of seeds).
- Make them diverse (different topics, difficulty, lengths, formats).
""".strip()


# @retry(wait=wait_exponential_jitter(initial=1, max=20), stop=stop_after_attempt(5))
def generate_batch(n: int) -> List[Dict[str, str]]:
    prompt = build_generation_prompt(SEED_EXAMPLES, n)

    # Anthropic Messages API call pattern (stateless messages list) :contentReference[oaicite:0]{index=0}
    print("Calling...")
    msg = client.messages.create(
        model=MODEL,
        max_tokens=3000,
        temperature=0.9,
        messages=[
            {"role": "user", "content": prompt}
        ],
    )
    print("Called...")

    # The SDK returns content blocks; we want the concatenated text
    text = ""
    for block in msg.content:
        if block.type == "text":
            text += block.text

    print(text)
    data = json.loads(text)
    examples = data.get("examples", [])
    if not isinstance(examples, list):
        raise ValueError("Bad JSON schema: 'examples' is not a list")

    cleaned = []
    for ex in examples:
        if not isinstance(ex, dict):
            continue
        p = (ex.get("prompt") or "").strip()
        r = (ex.get("response") or "").strip()
        if p and r:
            cleaned.append({"prompt": p, "response": r})

    if len(cleaned) == 0:
        raise ValueError("Model returned zero usable examples")
    return cleaned


def dedupe(examples: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen = set()
    out = []
    for ex in examples:
        key = (ex["prompt"].strip(), ex["response"].strip())
        if key in seen:
            continue
        seen.add(key)
        out.append(ex)
    return out


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("Set ANTHROPIC_API_KEY in your environment.")

    all_examples: List[Dict[str, str]] = []
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, 'r') as fi:
            for ro in fi.readlines():
                exa = json.loads(ro)
                all_examples.append(exa)
    calls = 0

    while len(all_examples) < NUM_EXAMPLES_TO_GENERATE:
        remaining = NUM_EXAMPLES_TO_GENERATE - len(all_examples)
        n = min(BATCH_SIZE, remaining)

        batch = generate_batch(n)
        print("Generated a batch")

        # light shuffle to avoid clumping similar items
        random.shuffle(batch)

        all_examples.extend(batch)
        all_examples = dedupe(all_examples)

        calls += 1
        print(f"[{calls}] total saved so far: {len(all_examples)}")
        
        with open(OUT_PATH, "w", encoding="utf-8") as f:
            for ex in all_examples[:NUM_EXAMPLES_TO_GENERATE]:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")

        time.sleep(SLEEP_BETWEEN_CALLS_SEC)

    # Write JSONL
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        for ex in all_examples[:NUM_EXAMPLES_TO_GENERATE]:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    print("Wrote:", OUT_PATH)
    print("Example line:", json.dumps(all_examples[0], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
