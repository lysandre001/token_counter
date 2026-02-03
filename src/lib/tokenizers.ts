import type { TokenizerId } from "../data/pricing";

/** Compatible with @lenml PreTrainedTokenizer: _encode_text returns string[] | null. */
type Tokenizer = {
  _encode_text: (text: string) => number[] | string[] | null;
};

const cache: Partial<Record<TokenizerId, Promise<Tokenizer>>> = {};

export async function getTokenizer(id: TokenizerId): Promise<Tokenizer> {
  if (!cache[id]) {
    cache[id] = (async () => {
      if (id === "claude") {
        const mod = await import("@lenml/tokenizer-claude");
        return mod.fromPreTrained();
      }
      if (id === "gemini") {
        const mod = await import("@lenml/tokenizer-gemini");
        return mod.fromPreTrained();
      }
      // gpt4o (OpenAI o200k-ish)
      const mod = await import("@lenml/tokenizer-gpt4o");
      return mod.fromPreTrained();
    })();
  }

  return cache[id]!;
}

export async function countTokens(tokenizerId: TokenizerId, text: string): Promise<number> {
  const tokenizer = await getTokenizer(tokenizerId);
  // Pure-text token count, no chat template overhead. Library may return string[] | null.
  const tokens = tokenizer._encode_text(text);
  return (tokens ?? []).length;
}
