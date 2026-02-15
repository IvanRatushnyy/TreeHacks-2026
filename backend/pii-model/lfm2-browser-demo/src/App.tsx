import { useEffect, useMemo, useRef, useState } from "react";
import { env, pipeline } from "@huggingface/transformers";

const MODEL_DIR = "/lfm2-350m-merged-ONNX";
const MODEL_FILE =
  "/root/TreeHacks-2026/backend/pii-model/lfm2-browser-demo/lfm2-350m-merged-ONNX/onnx/model_q4.onnx";

type Generator = (input: string, options?: Record<string, unknown>) => Promise<any>;

function regexRedact(text: string) {
  const rules = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    /\b(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b(?:\d[ -]*?){13,19}\b/g,
  ];

  let out = text;
  for (const re of rules) {
    out = out.replace(re, (m) => "█".repeat(Math.max(1, m.length)));
  }
  return out;
}

function parseGeneratedText(output: any): string {
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first.generated_text === "string") return first.generated_text;
    if (first && typeof first.text === "string") return first.text;
  }
  if (typeof output === "string") return output;
  return "";
}

export default function App() {
  const generatorRef = useRef<Generator | null>(null);

  const [loadingModel, setLoadingModel] = useState(true);
  const [status, setStatus] = useState("Loading local Q4 model on WebGPU...");

  const [inputText, setInputText] = useState(
    "Patient Jane Doe lives at 123 Main St. Her SSN is 123-45-6789 and email is jane.doe@example.com."
  );
  const [modelOutput, setModelOutput] = useState("");
  const [running, setRunning] = useState(false);

  const regexOutput = useMemo(() => regexRedact(inputText), [inputText]);

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        env.allowLocalModels = true;
        env.allowRemoteModels = false;
        env.useBrowserCache = false;

        setStatus(`Loading ${MODEL_FILE} with device=webgpu...`);

        const generator = (await pipeline("text-generation", MODEL_DIR, {
          device: "webgpu",
          dtype: "q4",
        })) as Generator;

        if (cancelled) return;
        generatorRef.current = generator;
        setStatus("Ready. WebGPU model loaded.");
      } catch (error: any) {
        if (cancelled) return;
        setStatus(`Failed to load model on WebGPU: ${error?.message ?? String(error)}`);
      } finally {
        if (!cancelled) {
          setLoadingModel(false);
        }
      }
    }

    loadModel();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runModelRedaction() {
    const generator = generatorRef.current;
    if (!generator) return;

    setRunning(true);
    setStatus("Generating redacted text with LFM2 (WebGPU)...");

    try {
      const prompt = `### Instruction:\ncensor: ${inputText}\n\n### Response:\n`


      const output = await generator(prompt, {
        max_new_tokens: 128,
        temperature: 0.01,
        do_sample: false,
      });

      const generated = parseGeneratedText(output);
      const redacted = generated.startsWith(prompt)
        ? generated.slice(prompt.length).trim()
        : generated.trim();

      setModelOutput(redacted || "(No output returned by model)");
      setStatus("Redaction complete.");
    } catch (error: any) {
      setStatus(`Generation failed: ${error?.message ?? String(error)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="app">
      <h1>LFM2 Browser Redaction Demo (WebGPU)</h1>
      <p>
        Model: <code>{MODEL_FILE}</code>
      </p>
      <p>
        <strong>Status:</strong> {status}
      </p>

      <h2>Input Text</h2>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        rows={10}
        style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 12, marginBottom: 20 }}>
        <button onClick={runModelRedaction} disabled={loadingModel || running || !generatorRef.current}>
          {running ? "Running..." : "Run LFM2 Redaction"}
        </button>
      </div>

      <h2>LFM2 Redacted Output</h2>
      <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        {modelOutput || "(Run the model to generate output)"}
      </pre>

      <h2>Regex Baseline Output</h2>
      <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        {regexOutput}
      </pre>
    </div>
  );
}
