import { NextRequest, NextResponse } from "next/server";
import { require_api_user_id } from "@/lib/auth-api";
import { get_search_nutrition_provider_chain } from "@/server/nutrition/provider";
import type { NormalizedFoodItem } from "@/server/nutrition/types";

const BEVERAGE_TERMS = [
  "beer",
  "ale",
  "lager",
  "ipa",
  "stout",
  "porter",
  "seltzer",
  "cider",
  "wine",
  "vodka",
  "whiskey",
  "whisky",
  "rum",
  "tequila",
  "gin",
];

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function build_query_variants(query: string): string[] {
  const variants = new Set<string>();
  const normalized = query.trim().replace(/\s+/g, " ");
  const punctuation_stripped = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

  if (normalized) {
    variants.add(normalized);
  }

  if (punctuation_stripped && punctuation_stripped !== normalized) {
    variants.add(punctuation_stripped);
  }

  const lower = normalized.toLowerCase();
  const has_beverage_word = BEVERAGE_TERMS.some((term) => lower.includes(term));

  if (!has_beverage_word && lower.length > 0) {
    variants.add(`${normalized} beer`);
  }

  return Array.from(variants);
}

function item_dedupe_key(item: NormalizedFoodItem): string {
  if (item.source_ref) {
    return `${item.source}:${item.source_ref}`;
  }

  if (item.upc) {
    return `${item.source}:upc:${item.upc}`;
  }

  return `${item.source}:${item.name.toLowerCase()}::${item.brand?.toLowerCase() ?? ""}`;
}

function score_item(item: NormalizedFoodItem, query: string): number {
  const query_normalized = query.trim().toLowerCase();
  const tokens = tokenize(query_normalized);
  const name = item.name.toLowerCase();
  const haystack = `${item.name} ${item.brand ?? ""}`.toLowerCase();
  let score = 0;

  if (haystack === query_normalized) {
    score += 300;
  }

  if (name.startsWith(query_normalized)) {
    score += 220;
  }

  if (haystack.includes(query_normalized)) {
    score += 140;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 28;
      continue;
    }

    score -= 14;
  }

  if (item.upc) {
    score += 8;
  }

  if (item.source === "edamam") {
    score += 4;
  }

  if (item.source === "usda") {
    score += 6;
  }

  return score;
}

function sort_items(items: NormalizedFoodItem[], query: string): NormalizedFoodItem[] {
  return [...items].sort((a, b) => score_item(b, query) - score_item(a, query));
}

function has_strong_match(items: NormalizedFoodItem[], query: string): boolean {
  const tokens = tokenize(query);

  return items.some((item) => {
    const haystack = `${item.name} ${item.brand ?? ""}`.toLowerCase();
    const token_match_count = tokens.filter((token) => haystack.includes(token)).length;
    const all_tokens_present = tokens.length > 0 && token_match_count === tokens.length;

    return all_tokens_present || score_item(item, query) >= 180;
  });
}

export async function GET(request: NextRequest) {
  const { error_response } = await require_api_user_id();

  if (error_response) {
    return error_response;
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit_raw = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limit_raw) || 20, 1), 50);

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters." },
      { status: 400 },
    );
  }

  const providers = get_search_nutrition_provider_chain();
  const query_variants = build_query_variants(query);
  const merged_by_key = new Map<string, NormalizedFoodItem>();

  for (let provider_index = 0; provider_index < providers.length; provider_index += 1) {
    const provider = providers[provider_index];

    for (let variant_index = 0; variant_index < query_variants.length; variant_index += 1) {
      const variant = query_variants[variant_index];

      try {
        const results = await provider.search_foods(variant, Math.min(limit, 25));

        for (const item of results) {
          const key = item_dedupe_key(item);

          if (!merged_by_key.has(key)) {
            merged_by_key.set(key, item);
          }
        }
      } catch {
        continue;
      }

      const merged_items = sort_items(Array.from(merged_by_key.values()), query);
      const has_enough_items = merged_items.length >= Math.min(limit, 6);

      if (has_enough_items && has_strong_match(merged_items, query)) {
        return NextResponse.json({ items: merged_items.slice(0, limit) }, { status: 200 });
      }
    }
  }

  const items = sort_items(Array.from(merged_by_key.values()), query).slice(0, limit);

  return NextResponse.json({ items }, { status: 200 });
}
