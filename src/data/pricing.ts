import { parseCsv, rowsToObjects } from "../lib/csv";

export type ProviderId = "openai" | "claude" | "gemini" | "openrouter";

export type TokenizerId = "gpt4o" | "claude" | "gemini";

export type ModelPricing = {
  id: string;
  label: string;
  provider: ProviderId;
  tokenizer: TokenizerId;
  // USD per 1M tokens (kept for reference; UI uses USD/token)
  inputPer1M: number;
  outputPer1M: number;
  // USD per token
  inputPerToken: number;
  outputPerToken: number;
  // optional note like "as of 2026-02-03"
  note?: string;
};

/** Last update date of the price table (for display) */
export const PRICE_UPDATE_DATE = "2026-04-24";

/** CSV table path (copied to out/ on static export) */
export const PRICE_TABLE_CSV_URL = "/pricing_models.csv";

/** Price source links (for display) */
export const PRICE_SOURCE_LINKS: Record<ProviderId, string> = {
  openai: "https://openai.com/api/pricing/",
  claude: "https://claude.com/pricing#api",
  gemini: "https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn",
  openrouter: "https://openrouter.ai/docs#models",
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  openrouter: "OpenRouter",
};

type PricingCsvRow = {
  sourceUrl: string;
  providerRaw: string;
  modelName: string;
  inputPer1M: number | null;
  outputPer1M: number | null;
  inputPerToken: number | null;
  outputPerToken: number | null;
};

function parseMaybeNumber(value: string | undefined): number | null {
  const v = (value ?? "").trim();
  if (!v || v === "-" || v.toLowerCase() === "n/a") return null;
  if (v.toLowerCase() === "free") return 0;
  // allow "$1.25" / "1.25" / "1,250" etc
  const cleaned = v.replace(/\$/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeProvider(providerRaw: string): ProviderId | null {
  const p = providerRaw.trim().toLowerCase();
  if (p === "openai") return "openai";
  if (p === "anthropic" || p === "claude") return "claude";
  if (p === "google" || p === "gemini") return "gemini";
  if (p === "openrouter") return "openrouter";
  return null;
}

function providerToTokenizer(provider: ProviderId): TokenizerId {
  if (provider === "claude") return "claude";
  if (provider === "gemini") return "gemini";
  // OpenAI/OpenRouter: use gpt4o tokenizer as an approximation for "pure text token" counting
  return "gpt4o";
}

const EXCLUDE_FROM_CALC_RE = /(cached|caching|prompt\s*caching|training|fine[-\s]?tuning)/i;

export function isSupportedForCalculator(row: PricingCsvRow): boolean {
  // MVP only: token-based (both input+output), not caching/training/multimodal.
  if (EXCLUDE_FROM_CALC_RE.test(row.modelName)) return false;
  if (row.inputPer1M === null || row.outputPer1M === null) return false;
  // For non-token units (per second / per image), we typically don't have per-token unit prices.
  if (row.inputPerToken === null || row.outputPerToken === null) return false;
  return true;
}

let cachedRowsPromise: Promise<PricingCsvRow[]> | null = null;
let cachedModelsPromise: Promise<ModelPricing[]> | null = null;

export async function loadPricingTableRows(): Promise<PricingCsvRow[]> {
  if (cachedRowsPromise) return cachedRowsPromise;

  cachedRowsPromise = (async () => {
    const res = await fetch(PRICE_TABLE_CSV_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load price table: ${PRICE_TABLE_CSV_URL} (HTTP ${res.status})`);
    }

    const csvText = await res.text();
    const rows = parseCsv(csvText);
    const objs = rowsToObjects(rows);

    // CSV columns (header): 官网链接, 供应商, 模型名称, 输入价格(...), 输出价格(...), 单位输入价格(...), 单位输出价格(...)
    return objs.map((o) => ({
      sourceUrl: o["官网链接"] ?? "",
      providerRaw: o["供应商"] ?? "",
      modelName: o["模型名称"] ?? "",
      inputPer1M: parseMaybeNumber(o["输入价格(USD/1M tokens or per-unit)"]),
      outputPer1M: parseMaybeNumber(o["输出价格(USD/1M tokens or per-unit)"]),
      inputPerToken: parseMaybeNumber(o["单位输入价格(USD/token)"]),
      outputPerToken: parseMaybeNumber(o["单位输出价格(USD/token)"]),
    }));
  })();

  return cachedRowsPromise;
}

export async function loadPricingModels(): Promise<ModelPricing[]> {
  if (cachedModelsPromise) return cachedModelsPromise;

  cachedModelsPromise = (async () => {
    const rows = await loadPricingTableRows();

    const models: ModelPricing[] = [];
    const idCount = new Map<string, number>();

    for (const r of rows) {
      const provider = normalizeProvider(r.providerRaw);
      if (!provider) continue;
      if (!isSupportedForCalculator(r)) continue;

      const baseId = `${provider}/${slugify(r.modelName)}`;
      const n = (idCount.get(baseId) ?? 0) + 1;
      idCount.set(baseId, n);
      const id = n === 1 ? baseId : `${baseId}-${n}`;

      models.push({
        id,
        label: `${PROVIDER_LABELS[provider]} · ${r.modelName}`,
        provider,
        tokenizer: providerToTokenizer(provider),
        inputPer1M: r.inputPer1M!,
        outputPer1M: r.outputPer1M!,
        inputPerToken: r.inputPerToken!,
        outputPerToken: r.outputPerToken!,
        note: r.sourceUrl ? `as of ${PRICE_UPDATE_DATE} · ${r.sourceUrl}` : `as of ${PRICE_UPDATE_DATE}`,
      });
    }

    // Stable ordering: provider then label
    models.sort((a, b) => {
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.label.localeCompare(b.label);
    });

    return models;
  })();

  return cachedModelsPromise;
}

export function modelsByProvider(models: ModelPricing[], provider: ProviderId): ModelPricing[] {
  return models.filter((m) => m.provider === provider);
}

export function findModel(models: ModelPricing[], modelId: string): ModelPricing | undefined {
  return models.find((m) => m.id === modelId);
}
