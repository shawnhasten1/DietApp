import type {
  NormalizedFoodItem,
  NutritionProvider,
  SearchDebugResponse,
  UpcDebugResponse,
} from "@/server/nutrition/types";
import {
  normalize_edamam_serving,
  type EdamamServingNormalization,
} from "@/server/nutrition/providers/edamam-serving-normalizer";

const EDAMAM_PARSER_URL = "https://api.edamam.com/api/food-database/v2/parser";
const EDAMAM_NUTRIENTS_URL = "https://api.edamam.com/api/food-database/v2/nutrients";

type EdamamFood = {
  foodId?: string;
  label?: string;
  brand?: string;
  brandLabel?: string;
  nutrients?: Record<string, unknown>;
};

type EdamamMeasure = {
  uri?: string;
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

type EdamamNutrientsResponse = {
  calories?: unknown;
  totalNutrients?: Record<string, { quantity?: unknown } | undefined>;
  totalWeight?: unknown;
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

function build_edamam_selection_ref(
  food_id: string | null,
  measure_uri: string | null,
): string | null {
  if (!food_id) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("food_id", food_id);

  if (measure_uri) {
    params.set("measure_uri", measure_uri);
  }

  return `edamam:${params.toString()}`;
}

function parse_edamam_selection_ref(
  value: string | null | undefined,
): { food_id: string | null; measure_uri: string | null } {
  if (!value) {
    return {
      food_id: null,
      measure_uri: null,
    };
  }

  if (!value.startsWith("edamam:")) {
    return {
      food_id: get_string(value),
      measure_uri: null,
    };
  }

  const raw = value.slice("edamam:".length);
  const params = new URLSearchParams(raw);

  return {
    food_id: get_string(params.get("food_id")),
    measure_uri: get_string(params.get("measure_uri")),
  };
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

function get_total_nutrient_quantity(
  total_nutrients: EdamamNutrientsResponse["totalNutrients"],
  key: string,
): number | null {
  if (!total_nutrients) {
    return null;
  }

  return get_number(total_nutrients[key]?.quantity);
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
  const food_id = get_string(food.foodId);
  const measure_uri = get_string(measure?.uri);

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
      selection_ref: build_edamam_selection_ref(food_id, measure_uri),
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
      source_ref: food_id,
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

function build_normalization_debug_summary(normalization: EdamamServingNormalization) {
  return {
    normalization_applied: normalization.normalization_applied,
    normalization_reason: normalization.normalization_reason,
    nutrients_basis: normalization.nutrients_basis,
    raw_nutrients: normalization.raw.nutrients,
    normalized_nutrients: normalization.normalized,
    heuristic: normalization.heuristic,
    display_preview: {
      calories: Math.round(normalization.normalized.calories),
      protein_g: Number(normalization.normalized.protein_g.toFixed(1)),
      carbs_g: Number(normalization.normalized.carbs_g.toFixed(1)),
      fat_g: Number(normalization.normalized.fat_g.toFixed(1)),
      fiber_g:
        normalization.normalized.fiber_g !== null
          ? Number(normalization.normalized.fiber_g.toFixed(1))
          : null,
      sugar_g:
        normalization.normalized.sugar_g !== null
          ? Number(normalization.normalized.sugar_g.toFixed(1))
          : null,
      sodium_mg:
        normalization.normalized.sodium_mg !== null
          ? Number(normalization.normalized.sodium_mg.toFixed(1))
          : null,
    },
  };
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

  private async fetch_nutrients_payload(
    params: URLSearchParams,
    food_id: string,
    measure_uri: string,
  ): Promise<EdamamNutrientsResponse | null> {
    const response = await fetch(`${EDAMAM_NUTRIENTS_URL}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ingredients: [
          {
            quantity: 1,
            measureURI: measure_uri,
            foodId: food_id,
          },
        ],
      }),
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as EdamamNutrientsResponse;
  }

  private async resolve_measure_uri_from_parser(
    food_id: string,
    item: NormalizedFoodItem,
  ): Promise<string | null> {
    const params = this.get_auth_params();

    if (item.upc) {
      params.set("upc", item.upc);
    } else {
      params.set("ingr", item.name);
    }

    const payload = await this.fetch_parser_payload(params, 0);

    if (!payload) {
      return null;
    }

    const parsed_match = payload.parsed?.find((entry) => get_string(entry.food?.foodId) === food_id);
    const parsed_measure_uri = get_string(parsed_match?.measure?.uri);

    if (parsed_measure_uri) {
      return parsed_measure_uri;
    }

    const hint_match = payload.hints?.find((entry) => get_string(entry.food?.foodId) === food_id);
    const hint_measure_uri =
      hint_match?.measures?.map((measure) => get_string(measure.uri)).find(Boolean) ?? null;

    if (hint_measure_uri) {
      return hint_measure_uri;
    }

    return null;
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
            uri: measure.uri ?? null,
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
          ? build_normalization_debug_summary(normalized_result.normalization)
          : null,
        hint_measure_options,
      },
    };
  }

  async hydrate_item(item: NormalizedFoodItem): Promise<NormalizedFoodItem | null> {
    if (!this.has_credentials() || item.source !== "edamam") {
      return null;
    }

    const parsed_selection = parse_edamam_selection_ref(item.selection_ref);
    const food_id = parsed_selection.food_id ?? get_string(item.source_ref);

    if (!food_id) {
      return null;
    }

    let measure_uri = parsed_selection.measure_uri;

    if (!measure_uri) {
      measure_uri = await this.resolve_measure_uri_from_parser(food_id, item);
    }

    if (!measure_uri) {
      return null;
    }

    const params = this.get_auth_params();
    params.set("nutrition-type", "logging");

    const payload = await this.fetch_nutrients_payload(params, food_id, measure_uri);

    if (!payload) {
      return null;
    }

    const serving_size = item.serving_size ?? get_number(payload.totalWeight);
    const serving_unit = item.serving_unit ?? "serving";

    const normalization = normalize_edamam_serving({
      source: "edamam",
      serving_size,
      serving_unit,
      nutrients: {
        calories: get_number(payload.calories) ?? item.calories,
        protein_g: get_total_nutrient_quantity(payload.totalNutrients, "PROCNT") ?? item.protein_g,
        carbs_g: get_total_nutrient_quantity(payload.totalNutrients, "CHOCDF") ?? item.carbs_g,
        fat_g: get_total_nutrient_quantity(payload.totalNutrients, "FAT") ?? item.fat_g,
        fiber_g: get_total_nutrient_quantity(payload.totalNutrients, "FIBTG") ?? item.fiber_g,
        sugar_g: get_total_nutrient_quantity(payload.totalNutrients, "SUGAR") ?? item.sugar_g,
        sodium_mg: get_total_nutrient_quantity(payload.totalNutrients, "NA") ?? item.sodium_mg,
      },
    });

    const normalized = normalization.normalized;
    const serving_size_label =
      serving_size !== null ? `1 ${serving_unit} (${Math.round(serving_size)} g)` : item.serving_size_label;

    return {
      ...item,
      selection_ref: build_edamam_selection_ref(food_id, measure_uri),
      serving_size,
      serving_unit,
      serving_size_label,
      calories: Math.round(normalized.calories),
      protein_g: round_to_tenth(normalized.protein_g),
      carbs_g: round_to_tenth(normalized.carbs_g),
      fat_g: round_to_tenth(normalized.fat_g),
      fiber_g: round_optional_to_tenth(normalized.fiber_g),
      sugar_g: round_optional_to_tenth(normalized.sugar_g),
      sodium_mg: round_optional_to_tenth(normalized.sodium_mg),
      source_ref: food_id,
    };
  }

  async search_foods_debug(query: string, limit = 12): Promise<SearchDebugResponse | null> {
    if (!this.has_credentials()) {
      return {
        provider: "edamam",
        query,
        normalized_items: [],
        raw_payload: null,
        debug_summary: {
          error: "Missing Edamam credentials in server environment.",
        },
      };
    }

    const params = this.get_auth_params();
    params.set("ingr", query);

    const payload = await this.fetch_parser_payload(params, 0);

    if (!payload) {
      return null;
    }

    const capped_limit = Math.min(Math.max(limit, 1), 20);

    const parsed_preview =
      payload.parsed?.slice(0, capped_limit).map((item, index) => {
        const normalized_result = normalize_edamam_food(item.food, item.measure, null);

        return {
          source_bucket: "parsed",
          index,
          food_label: item.food?.label ?? null,
          brand_label: item.food?.brandLabel ?? item.food?.brand ?? null,
          measure_label: item.measure?.label ?? null,
          measure_uri: item.measure?.uri ?? null,
          measure_weight_g: item.measure?.weight ?? null,
          normalized_item: normalized_result?.item ?? null,
          normalization: normalized_result
            ? build_normalization_debug_summary(normalized_result.normalization)
            : null,
        };
      }) ?? [];

    const hint_preview =
      payload.hints?.slice(0, capped_limit).map((item, index) => {
        const first_measure = item.measures?.[0];
        const normalized_result = normalize_edamam_food(item.food, first_measure, null);

        return {
          source_bucket: "hint",
          index,
          food_label: item.food?.label ?? null,
          brand_label: item.food?.brandLabel ?? item.food?.brand ?? null,
          first_measure_label: first_measure?.label ?? null,
          first_measure_uri: first_measure?.uri ?? null,
          first_measure_weight_g: first_measure?.weight ?? null,
          measure_options:
            item.measures?.slice(0, 6).map((measure) => ({
              uri: measure.uri ?? null,
              label: measure.label ?? null,
              weight_g: measure.weight ?? null,
            })) ?? [],
          normalized_item: normalized_result?.item ?? null,
          normalization: normalized_result
            ? build_normalization_debug_summary(normalized_result.normalization)
            : null,
        };
      }) ?? [];

    const normalized_items = dedupe_foods([
      ...parsed_preview
        .map((entry) => entry.normalized_item)
        .filter((entry): entry is NormalizedFoodItem => Boolean(entry)),
      ...hint_preview
        .map((entry) => entry.normalized_item)
        .filter((entry): entry is NormalizedFoodItem => Boolean(entry)),
    ]).slice(0, capped_limit);

    return {
      provider: "edamam",
      query,
      normalized_items,
      raw_payload: payload,
      debug_summary: {
        parsed_count: payload.parsed?.length ?? 0,
        hints_count: payload.hints?.length ?? 0,
        parsed_preview,
        hint_preview,
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
