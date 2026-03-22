import type {
  NormalizedFoodItem,
  NutritionProvider,
  UpcDebugResponse,
} from "@/server/nutrition/types";
import {
  normalize_edamam_serving,
  type EdamamServingNormalization,
} from "@/server/nutrition/providers/edamam-serving-normalizer";

const EDAMAM_PARSER_URL = "https://api.edamam.com/api/food-database/v2/parser";

type EdamamFood = {
  foodId?: string;
  label?: string;
  brand?: string;
  brandLabel?: string;
  nutrients?: Record<string, unknown>;
};

type EdamamMeasure = {
  label?: string;
  weight?: number;
};

type EdamamParsedItem = {
  food?: EdamamFood;
  measure?: EdamamMeasure;
};

type EdamamHintItem = {
  food?: EdamamFood;
  measures?: EdamamMeasure[];
};

type EdamamParserResponse = {
  parsed?: EdamamParsedItem[];
  hints?: EdamamHintItem[];
};

type NormalizedEdamamFood = {
  item: NormalizedFoodItem;
  normalization: EdamamServingNormalization;
};

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

function build_edamam_nutrients(food: EdamamFood | undefined) {
  const nutrients = food?.nutrients ?? {};

  return {
    calories: get_number(nutrients.ENERC_KCAL) ?? 0,
    protein_g: get_number(nutrients.PROCNT) ?? 0,
    carbs_g: get_number(nutrients.CHOCDF) ?? 0,
    fat_g: get_number(nutrients.FAT) ?? 0,
    fiber_g: get_number(nutrients.FIBTG),
    sugar_g: get_number(nutrients.SUGAR),
    sodium_mg: get_number(nutrients.NA),
  };
}

function normalize_edamam_food(
  food: EdamamFood | undefined,
  measure: EdamamMeasure | undefined,
  upc: string | null,
): NormalizedEdamamFood | null {
  if (!food) {
    return null;
  }

  const serving_size = get_number(measure?.weight);
  const serving_unit = get_string(measure?.label) ?? "g";

  // Edamam branded items can expose nutrient values per 100g while keeping
  // serving metadata in named units (for example "Bar"). Normalize only when
  // heuristic confidence is high, otherwise keep the raw values.
  const normalization = normalize_edamam_serving({
    source: "edamam",
    serving_size,
    serving_unit,
    nutrients: build_edamam_nutrients(food),
  });

  const normalized = normalization.normalized;

  return {
    item: {
      name: get_string(food.label) ?? "Unknown Food Item",
      brand: get_string(food.brandLabel) ?? get_string(food.brand),
      upc,
      serving_size,
      serving_unit,
      serving_size_label:
        serving_size !== null ? `1 ${serving_unit} (${Math.round(serving_size)} g)` : null,
      calories: Math.round(normalized.calories),
      protein_g: round_to_tenth(normalized.protein_g),
      carbs_g: round_to_tenth(normalized.carbs_g),
      fat_g: round_to_tenth(normalized.fat_g),
      fiber_g: round_optional_to_tenth(normalized.fiber_g),
      sugar_g: round_optional_to_tenth(normalized.sugar_g),
      sodium_mg: round_optional_to_tenth(normalized.sodium_mg),
      source: "edamam",
      source_ref: get_string(food.foodId),
    },
    normalization,
  };
}

function dedupe_foods(items: NormalizedFoodItem[]): NormalizedFoodItem[] {
  const seen = new Set<string>();
  const result: NormalizedFoodItem[] = [];

  for (const item of items) {
    const key = item.source_ref ?? `${item.name.toLowerCase()}::${item.brand ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

export class EdamamProvider implements NutritionProvider {
  private readonly app_id: string | null;
  private readonly app_key: string | null;

  constructor() {
    this.app_id = process.env.EDAMAM_APPID ?? process.env.EDAMAM_APP_ID ?? null;
    this.app_key = process.env.EDAMAM_APIKEY ?? process.env.EDAMAM_APP_KEY ?? null;
  }

  private has_credentials(): boolean {
    return Boolean(this.app_id && this.app_key);
  }

  private get_auth_params(): URLSearchParams {
    return new URLSearchParams({
      app_id: this.app_id ?? "",
      app_key: this.app_key ?? "",
    });
  }

  private async fetch_parser_payload(
    params: URLSearchParams,
    revalidate_seconds: number,
  ): Promise<EdamamParserResponse | null> {
    const response = await fetch(`${EDAMAM_PARSER_URL}?${params.toString()}`, {
      next: { revalidate: revalidate_seconds },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as EdamamParserResponse;
  }

  async lookup_by_upc(upc: string): Promise<NormalizedFoodItem | null> {
    if (!this.has_credentials()) {
      return null;
    }

    const params = this.get_auth_params();
    params.set("upc", upc);

    const payload = await this.fetch_parser_payload(params, 3600);

    if (!payload) {
      return null;
    }

    const first_parsed = payload.parsed?.[0];
    const first_hint = payload.hints?.[0];

    const normalized_result =
      normalize_edamam_food(first_parsed?.food, first_parsed?.measure, upc) ??
      normalize_edamam_food(first_hint?.food, first_hint?.measures?.[0], upc);

    return normalized_result?.item ?? null;
  }

  async lookup_by_upc_debug(upc: string): Promise<UpcDebugResponse | null> {
    if (!this.has_credentials()) {
      return {
        provider: "edamam",
        upc,
        normalized_item: null,
        raw_payload: null,
        debug_summary: {
          error: "Missing Edamam credentials in server environment.",
        },
      };
    }

    const params = this.get_auth_params();
    params.set("upc", upc);

    const payload = await this.fetch_parser_payload(params, 0);

    if (!payload) {
      return null;
    }

    const first_parsed = payload.parsed?.[0];
    const first_hint = payload.hints?.[0];

    const normalized_result =
      normalize_edamam_food(first_parsed?.food, first_parsed?.measure, upc) ??
      normalize_edamam_food(first_hint?.food, first_hint?.measures?.[0], upc);

    const hint_measure_options =
      payload.hints?.slice(0, 8).map((hint, index) => ({
        hint_index: index,
        food_label: hint.food?.label ?? null,
        brand_label: hint.food?.brandLabel ?? hint.food?.brand ?? null,
        measures:
          hint.measures?.map((measure) => ({
            label: measure.label ?? null,
            weight_g: measure.weight ?? null,
          })) ?? [],
      })) ?? [];

    return {
      provider: "edamam",
      upc,
      normalized_item: normalized_result?.item ?? null,
      raw_payload: payload,
      debug_summary: {
        parsed_count: payload.parsed?.length ?? 0,
        hints_count: payload.hints?.length ?? 0,
        first_parsed_measure_label: first_parsed?.measure?.label ?? null,
        first_parsed_measure_weight_g: first_parsed?.measure?.weight ?? null,
        normalization: normalized_result
          ? {
              normalization_applied: normalized_result.normalization.normalization_applied,
              normalization_reason: normalized_result.normalization.normalization_reason,
              nutrients_basis: normalized_result.normalization.nutrients_basis,
              raw_nutrients: normalized_result.normalization.raw.nutrients,
              normalized_nutrients: normalized_result.normalization.normalized,
              heuristic: normalized_result.normalization.heuristic,
              display_preview: {
                calories: Math.round(normalized_result.normalization.normalized.calories),
                protein_g: Number(normalized_result.normalization.normalized.protein_g.toFixed(1)),
                carbs_g: Number(normalized_result.normalization.normalized.carbs_g.toFixed(1)),
                fat_g: Number(normalized_result.normalization.normalized.fat_g.toFixed(1)),
                fiber_g:
                  normalized_result.normalization.normalized.fiber_g !== null
                    ? Number(normalized_result.normalization.normalized.fiber_g.toFixed(1))
                    : null,
                sugar_g:
                  normalized_result.normalization.normalized.sugar_g !== null
                    ? Number(normalized_result.normalization.normalized.sugar_g.toFixed(1))
                    : null,
                sodium_mg:
                  normalized_result.normalization.normalized.sodium_mg !== null
                    ? Number(normalized_result.normalization.normalized.sodium_mg.toFixed(1))
                    : null,
              },
            }
          : null,
        hint_measure_options,
      },
    };
  }

  async search_foods(query: string, limit = 20): Promise<NormalizedFoodItem[]> {
    if (!this.has_credentials()) {
      return [];
    }

    const params = this.get_auth_params();
    params.set("ingr", query);

    const payload = await this.fetch_parser_payload(params, 900);

    if (!payload) {
      return [];
    }

    const parsed_items =
      payload.parsed
        ?.map((item) => normalize_edamam_food(item.food, item.measure, null)?.item ?? null)
        .filter((item): item is NormalizedFoodItem => Boolean(item)) ?? [];

    const hint_items =
      payload.hints
        ?.map((item) => normalize_edamam_food(item.food, item.measures?.[0], null)?.item ?? null)
        .filter((item): item is NormalizedFoodItem => Boolean(item)) ?? [];

    return dedupe_foods([...parsed_items, ...hint_items]).slice(0, limit);
  }
}
