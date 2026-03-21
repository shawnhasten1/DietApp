import type { NormalizedFoodItem, NutritionProvider } from "@/server/nutrition/types";

const OFF_PRODUCT_BASE_URL = "https://world.openfoodfacts.org/api/v2/product";
const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

function get_string(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function get_number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parse_serving_size(raw_value: string | null): { size: number | null; unit: string | null } {
  if (!raw_value) {
    return { size: null, unit: null };
  }

  const match = raw_value.match(/([\d.]+)\s*([a-zA-Z]+)?/);

  if (!match) {
    return { size: null, unit: raw_value };
  }

  return {
    size: Number(match[1]),
    unit: match[2] ?? null,
  };
}

function pick_number(
  record: Record<string, unknown>,
  keys: string[],
  fallback: number | null = null,
): number | null {
  for (const key of keys) {
    const value = get_number(record[key]);
    if (value !== null) {
      return value;
    }
  }

  return fallback;
}

function normalize_product(product: Record<string, unknown>): NormalizedFoodItem {
  const nutriments = (product.nutriments as Record<string, unknown> | undefined) ?? {};

  const serving_size = get_string(product.serving_size);
  const parsed_serving = parse_serving_size(serving_size);

  const sodium_g = pick_number(nutriments, ["sodium_serving", "sodium_100g"]);

  return {
    name:
      get_string(product.product_name) ??
      get_string(product.product_name_en) ??
      "Unknown Food Item",
    brand: get_string(product.brands),
    upc: get_string(product.code),
    serving_size: parsed_serving.size,
    serving_unit: parsed_serving.unit,
    calories: Math.round(
      pick_number(nutriments, ["energy-kcal_serving", "energy-kcal_100g", "energy-kcal"], 0) ?? 0,
    ),
    protein_g: pick_number(nutriments, ["proteins_serving", "proteins_100g"], 0) ?? 0,
    carbs_g: pick_number(nutriments, ["carbohydrates_serving", "carbohydrates_100g"], 0) ?? 0,
    fat_g: pick_number(nutriments, ["fat_serving", "fat_100g"], 0) ?? 0,
    fiber_g: pick_number(nutriments, ["fiber_serving", "fiber_100g"]),
    sugar_g: pick_number(nutriments, ["sugars_serving", "sugars_100g"]),
    sodium_mg: sodium_g !== null ? sodium_g * 1000 : null,
    source: "open_food_facts",
    source_ref: get_string(product._id) ?? get_string(product.code),
  };
}

export class OpenFoodFactsProvider implements NutritionProvider {
  async lookup_by_upc(upc: string): Promise<NormalizedFoodItem | null> {
    const response = await fetch(`${OFF_PRODUCT_BASE_URL}/${encodeURIComponent(upc)}.json`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      status?: number;
      product?: Record<string, unknown>;
    };

    if (payload.status !== 1 || !payload.product) {
      return null;
    }

    return normalize_product(payload.product);
  }

  async search_foods(query: string, limit = 20): Promise<NormalizedFoodItem[]> {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: String(limit),
      fields: [
        "_id",
        "code",
        "product_name",
        "product_name_en",
        "brands",
        "serving_size",
        "nutriments",
      ].join(","),
    });

    const response = await fetch(`${OFF_SEARCH_URL}?${params.toString()}`, {
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      products?: Record<string, unknown>[];
    };

    if (!Array.isArray(payload.products)) {
      return [];
    }

    return payload.products.map(normalize_product);
  }
}
