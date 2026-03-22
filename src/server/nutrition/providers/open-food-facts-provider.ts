import type {
  NormalizedFoodItem,
  NutritionProvider,
  UpcDebugResponse,
} from "@/server/nutrition/types";

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

function round_to_tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function round_optional_to_tenth(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return round_to_tenth(value);
}

function parse_serving_size(raw_value: string | null): { size: number | null; unit: string | null } {
  if (!raw_value) {
    return { size: null, unit: null };
  }

  const parenthesized_match = raw_value.match(/\(([\d.]+)\s*([a-zA-Z]+)\)/);

  if (parenthesized_match) {
    return {
      size: Number(parenthesized_match[1]),
      unit: parenthesized_match[2] ?? null,
    };
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

  const serving_size_label = get_string(product.serving_size);
  const parsed_serving = parse_serving_size(serving_size_label);
  const serving_quantity = get_number(product.serving_quantity);
  const serving_quantity_unit = get_string(product.serving_quantity_unit);

  const sodium_g = pick_number(nutriments, ["sodium_serving", "sodium_100g"]);

  return {
    name:
      get_string(product.product_name) ??
      get_string(product.product_name_en) ??
      "Unknown Food Item",
    brand: get_string(product.brands),
    upc: get_string(product.code),
    serving_size: serving_quantity ?? parsed_serving.size,
    serving_unit: serving_quantity_unit ?? parsed_serving.unit,
    serving_size_label,
    calories: Math.round(
      pick_number(nutriments, ["energy-kcal_serving", "energy-kcal_100g", "energy-kcal"], 0) ?? 0,
    ),
    protein_g: round_to_tenth(pick_number(nutriments, ["proteins_serving", "proteins_100g"], 0) ?? 0),
    carbs_g: round_to_tenth(
      pick_number(nutriments, ["carbohydrates_serving", "carbohydrates_100g"], 0) ?? 0,
    ),
    fat_g: round_to_tenth(pick_number(nutriments, ["fat_serving", "fat_100g"], 0) ?? 0),
    fiber_g: round_optional_to_tenth(pick_number(nutriments, ["fiber_serving", "fiber_100g"])),
    sugar_g: round_optional_to_tenth(pick_number(nutriments, ["sugars_serving", "sugars_100g"])),
    sodium_mg: round_optional_to_tenth(sodium_g !== null ? sodium_g * 1000 : null),
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
        "serving_quantity",
        "serving_quantity_unit",
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

  async lookup_by_upc_debug(upc: string): Promise<UpcDebugResponse | null> {
    const response = await fetch(`${OFF_PRODUCT_BASE_URL}/${encodeURIComponent(upc)}.json`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      status?: number;
      product?: Record<string, unknown>;
    };

    return {
      provider: "open_food_facts",
      upc,
      normalized_item:
        payload.status === 1 && payload.product ? normalize_product(payload.product) : null,
      raw_payload: payload,
      debug_summary: {
        status: payload.status ?? null,
        serving_size: payload.product ? get_string(payload.product.serving_size) : null,
        serving_quantity: payload.product ? get_number(payload.product.serving_quantity) : null,
        serving_quantity_unit: payload.product
          ? get_string(payload.product.serving_quantity_unit)
          : null,
      },
    };
  }
}
