"use client";

import { useEffect, useMemo, useState } from "react";
import { countTokens } from "../lib/tokenizers";
import {
  findModel,
  loadPricingModels,
  modelsByProvider,
  PRICE_TABLE_CSV_URL,
  PRICE_UPDATE_DATE,
  PRICE_SOURCE_LINKS,
  PROVIDER_LABELS,
  type ModelPricing,
  type ProviderId,
} from "../data/pricing";
import { formatUSD } from "../lib/money";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "openai", label: PROVIDER_LABELS.openai },
  { id: "claude", label: PROVIDER_LABELS.claude },
  { id: "gemini", label: PROVIDER_LABELS.gemini },
  { id: "openrouter", label: PROVIDER_LABELS.openrouter },
];

export default function Page() {
  const [models, setModels] = useState<ModelPricing[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [modelsError, setModelsError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setIsLoadingModels(true);
        setModelsError("");
        const loaded = await loadPricingModels();
        if (cancelled) return;
        setModels(loaded);
      } catch (e: unknown) {
        if (cancelled) return;
        setModelsError(e instanceof Error ? e.message : String(e));
      } finally {
        if (cancelled) return;
        setIsLoadingModels(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const availableProviders = useMemo(() => {
    const s = new Set(models.map((m) => m.provider));
    return PROVIDERS.filter((p) => s.has(p.id));
  }, [models]);

  const [provider, setProvider] = useState<ProviderId>("openai");
  const providerModels = useMemo(() => modelsByProvider(models, provider), [models, provider]);

  // If the current provider has no models (e.g. OpenRouter not in the CSV), fall back.
  useEffect(() => {
    if (availableProviders.length === 0) return;
    if (availableProviders.some((p) => p.id === provider)) return;
    setProvider(availableProviders[0].id);
  }, [availableProviders, provider]);

  const [modelId, setModelId] = useState<string>("");

  useEffect(() => {
    // When provider/models change, reset to the first model under that provider.
    // (Keep it simple since we don't persist settings.)
    if (providerModels.length > 0 && !providerModels.some((m) => m.id === modelId)) {
      setModelId(providerModels[0].id);
    }
  }, [modelId, providerModels]);

  const model = useMemo(() => findModel(models, modelId), [models, modelId]);

  const [systemText, setSystemText] = useState<string>("");
  const [userText, setUserText] = useState<string>("");
  const [outputText, setOutputText] = useState<string>("");
  const [runs, setRuns] = useState<number>(1000);

  const [inputTokens, setInputTokens] = useState<number | null>(null);
  const [outputTokens, setOutputTokens] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const perRunCost = useMemo(() => {
    if (!model || inputTokens === null || outputTokens === null) return null;
    const inputCost = inputTokens * model.inputPerToken;
    const outputCost = outputTokens * model.outputPerToken;
    return inputCost + outputCost;
  }, [model, inputTokens, outputTokens]);

  const totalCost = useMemo(() => {
    if (perRunCost === null) return null;
    if (!Number.isFinite(runs) || runs < 0) return null;
    return perRunCost * runs;
  }, [perRunCost, runs]);

  async function onCount() {
    setError("");
    if (!model) {
      setError("Please select a model");
      return;
    }

    try {
      setIsCounting(true);
      const inputText = [systemText.trim(), userText.trim()].filter(Boolean).join("\n\n");
      const [inTok, outTok] = await Promise.all([
        countTokens(model.tokenizer, inputText),
        countTokens(model.tokenizer, outputText.trim()),
      ]);
      setInputTokens(inTok);
      setOutputTokens(outTok);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCounting(false);
    }
  }

  return (
    <main className="container">
      <h1 className="h1">Token Calculator</h1>
      <p className="sub">
        Counts plain-text tokens only (no chat message template overhead). Prices in USD per token.
      </p>
      <p className="sub" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px" }}>
        <span>Price table updated: {PRICE_UPDATE_DATE}</span>
        <span className="small">
          (
          <a href={PRICE_SOURCE_LINKS.gemini} target="_blank" rel="noopener noreferrer">Gemini</a>
          {" · "}
          <a href={PRICE_SOURCE_LINKS.openai} target="_blank" rel="noopener noreferrer">OpenAI</a>
          {" · "}
          <a href={PRICE_SOURCE_LINKS.claude} target="_blank" rel="noopener noreferrer">Claude</a>
          {" · "}
          <a href={PRICE_SOURCE_LINKS.openrouter} target="_blank" rel="noopener noreferrer">OpenRouter</a>
          {" · "}
          <a href={PRICE_TABLE_CSV_URL} target="_blank" rel="noopener noreferrer">Price table CSV</a>
          )
        </span>
      </p>

      <div className="grid">
        <section className="card">
          <div className="row">
            <div>
              <label className="label">Provider</label>
              <select
                className="select"
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderId)}
                disabled={isLoadingModels || availableProviders.length === 0}
              >
                {(availableProviders.length > 0 ? availableProviders : PROVIDERS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Model</label>
              <select
                className="select"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={isLoadingModels || providerModels.length === 0}
              >
                {providerModels.map((m, i) => (
                  <option key={`${m.id}-${i}`} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }} className="row">
            <div>
              <label className="label">System (optional)</label>
              <textarea
                className="textarea"
                placeholder="Optional: system prompt"
                value={systemText}
                onChange={(e) => setSystemText(e.target.value)}
              />
            </div>
            <div>
              <label className="label">User (input)</label>
              <textarea
                className="textarea"
                placeholder="Paste your user prompt"
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="label">Output</label>
            <textarea
              className="textarea"
              placeholder="Paste model reply to count output tokens"
              value={outputText}
              onChange={(e) => setOutputText(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 12 }} className="row">
            <div>
              <label className="label">Runs</label>
              <input
                className="input"
                type="number"
                min={0}
                value={Number.isFinite(runs) ? runs : 0}
                onChange={(e) => setRuns(Number(e.target.value))}
              />
              <div className="small" style={{ marginTop: 6 }}>
                e.g. 1000, 10000 — multiplies per-run cost by number of calls.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button className="btn" onClick={onCount} disabled={isLoadingModels || isCounting || !model}>
                {isLoadingModels ? "Loading prices…" : isCounting ? "Counting…" : "Count tokens & cost"}
              </button>
            </div>
          </div>

          {modelsError ? <div className="error">Failed to load price table: {modelsError}</div> : null}
          {isLoadingModels ? <div className="small">Loading price table ({PRICE_TABLE_CSV_URL})…</div> : null}
          {error ? <div className="error">{error}</div> : null}
        </section>

        <aside className="card">
          <div className="kpi">
            <div className="kpiBox">
              <div className="kpiTitle">Input tokens (system + user)</div>
              <div className="kpiValue">{inputTokens ?? "-"}</div>
              <div className="kpiSub">
                Price: {model ? formatUSD(model.inputPerToken) : "-"} / token
              </div>
            </div>

            <div className="kpiBox">
              <div className="kpiTitle">Output tokens</div>
              <div className="kpiValue">{outputTokens ?? "-"}</div>
              <div className="kpiSub">
                Price: {model ? formatUSD(model.outputPerToken) : "-"} / token
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }} className="kpiBox">
            <div className="kpiTitle">Per-run cost</div>
            <div className="kpiValue">{perRunCost === null ? "-" : formatUSD(perRunCost)}</div>
            <div className="kpiSub">
              inputTokens × inputPerToken + outputTokens × outputPerToken
            </div>
          </div>

          <div style={{ marginTop: 12 }} className="kpiBox">
            <div className="kpiTitle">Total cost (runs = {Number.isFinite(runs) ? runs : "-"})</div>
            <div className="kpiValue">{totalCost === null ? "-" : formatUSD(totalCost)}</div>
          </div>

          <div style={{ marginTop: 14 }} className="small">
            {model?.note ? `Note: ${model.note}` : ""}
          </div>
        </aside>
      </div>
    </main>
  );
}
